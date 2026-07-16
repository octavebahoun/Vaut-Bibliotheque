"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { sendInviteEmail } from "@/lib/email";

export type InviteView = {
  id: string;
  code: string;
  email: string | null;
  used: boolean;
  usedByEmail: string | null;
  expiresAt: string | null;
  createdAt: string;
  emailSent?: boolean;
};

async function originFromRequest(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");
  if (user.role !== "admin") throw new Error("Réservé aux administrateurs");
  return user;
}

// Code lisible : 12 caractères alphanumériques majuscules sans ambiguïté.
function generateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

export async function listInvites(): Promise<InviteView[]> {
  await requireAdmin();
  const usedByUser = users;
  const rows = await db
    .select({
      id: invites.id,
      code: invites.code,
      email: invites.email,
      usedBy: invites.usedBy,
      usedByEmail: usedByUser.email,
      usedAt: invites.usedAt,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .leftJoin(usedByUser, eq(invites.usedBy, usedByUser.id))
    .orderBy(desc(invites.createdAt));

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    email: r.email,
    used: r.usedBy !== null,
    usedByEmail: r.usedByEmail,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createInvite(input: {
  email?: string;
  expiresInDays?: number;
}): Promise<InviteView> {
  const admin = await requireAdmin();

  const email = input.email?.trim().toLowerCase() || null;
  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  // Retente en cas de collision de code (quasi impossible).
  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [clash] = await db
      .select({ id: invites.id })
      .from(invites)
      .where(eq(invites.code, code))
      .limit(1);
    if (!clash) break;
    code = generateCode();
  }

  const [row] = await db
    .insert(invites)
    .values({ code, email, createdBy: admin.id, expiresAt })
    .returning();

  // Envoi de l'e-mail si une adresse est fournie (dégradé si Resend non configuré).
  let emailSent = false;
  if (email) {
    const origin = await originFromRequest();
    const url = `${origin}/register?code=${encodeURIComponent(row.code)}`;
    const res = await sendInviteEmail({ to: email, code: row.code, url });
    emailSent = res.sent;
  }

  revalidatePath("/invitations");
  return {
    id: row.id,
    code: row.code,
    email: row.email,
    used: false,
    usedByEmail: null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    emailSent,
  };
}

export async function revokeInvite(id: string): Promise<void> {
  await requireAdmin();
  // On ne supprime qu'une invitation non utilisée.
  await db
    .delete(invites)
    .where(and(eq(invites.id, id), isNull(invites.usedBy)));
  revalidatePath("/invitations");
}

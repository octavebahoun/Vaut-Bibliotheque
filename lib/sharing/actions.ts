"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { libraryShares, users, images, type Image } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { sendShareEmail } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ShareGrant = {
  id: string;
  email: string;
  hasAccount: boolean;
  createdAt: string;
};

export type SharedLibrary = {
  ownerId: string;
  ownerEmail: string;
  images: Image[];
};

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");
  return user;
}

async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Personnes que J'AI invitées à voir ma bibliothèque partageable.
export async function listMyGrants(): Promise<ShareGrant[]> {
  const me = await requireUser();
  const rows = await db
    .select({
      id: libraryShares.id,
      email: libraryShares.inviteeEmail,
      createdAt: libraryShares.createdAt,
      accountId: users.id,
    })
    .from(libraryShares)
    .leftJoin(users, eq(users.email, libraryShares.inviteeEmail))
    .where(eq(libraryShares.ownerId, me.id))
    .orderBy(desc(libraryShares.createdAt));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    hasAccount: r.accountId !== null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function inviteToLibrary(
  emailRaw: string,
): Promise<{ grant: ShareGrant; emailSent: boolean }> {
  const me = await requireUser();
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("Adresse e-mail invalide");
  if (email === me.email.toLowerCase())
    throw new Error("Vous ne pouvez pas vous inviter vous-même");

  // Insertion idempotente (unique owner+email).
  await db
    .insert(libraryShares)
    .values({ ownerId: me.id, inviteeEmail: email })
    .onConflictDoNothing();

  const [row] = await db
    .select()
    .from(libraryShares)
    .where(
      and(
        eq(libraryShares.ownerId, me.id),
        eq(libraryShares.inviteeEmail, email),
      ),
    )
    .limit(1);

  const [account] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // E-mail d'information (dégradé si Resend non configuré).
  const origin = await appOrigin();
  const res = await sendShareEmail({
    to: email,
    ownerEmail: me.email,
    url: account ? `${origin}/partage` : `${origin}/register`,
    hasAccount: !!account,
  });

  revalidatePath("/partage");
  return {
    grant: {
      id: row.id,
      email: row.inviteeEmail,
      hasAccount: !!account,
      createdAt: row.createdAt.toISOString(),
    },
    emailSent: res.sent,
  };
}

export async function revokeGrant(id: string): Promise<void> {
  const me = await requireUser();
  await db
    .delete(libraryShares)
    .where(and(eq(libraryShares.id, id), eq(libraryShares.ownerId, me.id)));
  revalidatePath("/partage");
}

// Bibliothèques partagées AVEC MOI (images partageables des owners qui m'ont invité).
export async function listSharedWithMe(): Promise<SharedLibrary[]> {
  const me = await requireUser();

  const owners = await db
    .select({ ownerId: libraryShares.ownerId, ownerEmail: users.email })
    .from(libraryShares)
    .innerJoin(users, eq(users.id, libraryShares.ownerId))
    .where(eq(libraryShares.inviteeEmail, me.email.toLowerCase()));

  const result: SharedLibrary[] = [];
  for (const o of owners) {
    const imgs = await db
      .select()
      .from(images)
      .where(and(eq(images.userId, o.ownerId), isNotNull(images.shareToken)))
      .orderBy(desc(images.createdAt));
    result.push({
      ownerId: o.ownerId,
      ownerEmail: o.ownerEmail,
      images: imgs,
    });
  }
  return result;
}

// Nombre de bibliothèques partagées avec moi (pour un badge éventuel).
export async function countSharedWithMe(): Promise<number> {
  const me = await requireUser();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(libraryShares)
    .where(eq(libraryShares.inviteeEmail, me.email.toLowerCase()));
  return n;
}

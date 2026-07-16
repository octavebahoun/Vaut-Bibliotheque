"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, invites } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "./password";
import {
  createSession,
  setSessionCookie,
  getSessionToken,
  invalidateSessionToken,
  clearSessionCookie,
} from "./session";

export type AuthState = { error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!EMAIL_RE.test(email)) return { error: "Adresse e-mail invalide" };
  if (password.length < 8)
    return { error: "Le mot de passe doit faire au moins 8 caractères" };

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) return { error: "Cet e-mail est déjà utilisé" };

  // Le tout premier compte devient admin et n'a pas besoin d'invitation.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const isFirstUser = count === 0;

  let inviteId: string | null = null;
  if (!isFirstUser) {
    if (!code) return { error: "Un code d'invitation est requis" };
    const [invite] = await db
      .select()
      .from(invites)
      .where(and(eq(invites.code, code), isNull(invites.usedBy)))
      .limit(1);
    if (!invite) return { error: "Code d'invitation invalide ou déjà utilisé" };
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now())
      return { error: "Ce code d'invitation a expiré" };
    if (invite.email && invite.email.toLowerCase() !== email)
      return { error: "Cette invitation est réservée à un autre e-mail" };
    inviteId = invite.id;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, role: isFirstUser ? "admin" : "member" })
    .returning({ id: users.id });

  // Marque l'invitation comme consommée (garde-fou anti-course : usedBy null).
  if (inviteId) {
    await db
      .update(invites)
      .set({ usedBy: user.id, usedAt: new Date() })
      .where(and(eq(invites.id, inviteId), isNull(invites.usedBy)));
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);
  redirect("/images");
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "E-mail et mot de passe requis" };

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Message générique pour ne pas révéler l'existence du compte
  const invalid = { error: "E-mail ou mot de passe incorrect" };
  if (!user) {
    // Coût constant : on hache quand même pour éviter le timing oracle
    await hashPassword(password).catch(() => {});
    return invalid;
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) return invalid;

  const token = await createSession(user.id);
  await setSessionCookie(token);
  redirect("/images");
}

export async function logout(): Promise<void> {
  const token = await getSessionToken();
  if (token) await invalidateSessionToken(token);
  await clearSessionCookie();
  redirect("/login");
}

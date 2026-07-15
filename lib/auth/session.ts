import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";

const COOKIE_NAME = "vault_session";
const SESSION_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// On stocke en base le SHA-256 du token : une fuite DB n'expose pas de token utilisable.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const id = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * MS_PER_DAY);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return token;
}

export async function validateSessionToken(
  token: string,
): Promise<{ user: User } | null> {
  const id = hashToken(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  // Prolongation glissante : si moins de la moitié de la durée restante
  const halfLife = (SESSION_DAYS / 2) * MS_PER_DAY;
  if (row.session.expiresAt.getTime() - Date.now() < halfLife) {
    const newExpiry = new Date(Date.now() + SESSION_DAYS * MS_PER_DAY);
    await db
      .update(sessions)
      .set({ expiresAt: newExpiry })
      .where(eq(sessions.id, id));
  }

  return { user: row.user };
}

export async function invalidateSessionToken(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

// ── Helpers cookie (Server Actions / Route Handlers) ──────────
export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value;
}

// Récupère l'utilisateur courant (ou null). À utiliser dans les Server Components.
export async function getCurrentUser(): Promise<User | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const result = await validateSessionToken(token);
  return result?.user ?? null;
}

export { COOKIE_NAME };

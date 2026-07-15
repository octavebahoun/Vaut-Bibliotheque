"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, secrets } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { User } from "@/lib/db/schema";

export type SecretView = { id: string; key: string; value: string };
export type ProjectView = {
  id: string;
  name: string;
  secrets: SecretView[];
};

// Nom de variable d'environnement valide : LETTRES/CHIFFRES/_ , ne commence pas par un chiffre.
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");
  return user;
}

async function assertProjectOwner(projectId: string, userId: string) {
  const [p] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  if (!p) throw new Error("Projet introuvable");
}

// Renvoie tous les projets de l'utilisateur avec leurs secrets déchiffrés.
export async function getProjects(): Promise<ProjectView[]> {
  const user = await requireUser();
  const projRows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, user.id))
    .orderBy(asc(projects.createdAt));

  const result: ProjectView[] = [];
  for (const p of projRows) {
    const secRows = await db
      .select()
      .from(secrets)
      .where(eq(secrets.projectId, p.id))
      .orderBy(asc(secrets.key));
    result.push({
      id: p.id,
      name: p.name,
      secrets: secRows.map((s) => ({
        id: s.id,
        key: s.key,
        value: safeDecrypt(s.valueEncrypted),
      })),
    });
  }
  return result;
}

function safeDecrypt(payload: string): string {
  try {
    return decryptSecret(payload);
  } catch {
    return "⚠︎ déchiffrement impossible";
  }
}

export async function createProject(name: string): Promise<ProjectView> {
  const user = await requireUser();
  const clean = name.trim();
  if (!clean) throw new Error("Nom de projet requis");
  const [p] = await db
    .insert(projects)
    .values({ userId: user.id, name: clean })
    .returning();
  revalidatePath("/keys");
  return { id: p.id, name: p.name, secrets: [] };
}

export async function renameProject(id: string, name: string): Promise<void> {
  const user = await requireUser();
  const clean = name.trim();
  if (!clean) throw new Error("Nom de projet requis");
  await assertProjectOwner(id, user.id);
  await db.update(projects).set({ name: clean }).where(eq(projects.id, id));
  revalidatePath("/keys");
}

export async function deleteProject(id: string): Promise<void> {
  const user = await requireUser();
  await assertProjectOwner(id, user.id);
  await db.delete(projects).where(eq(projects.id, id));
  revalidatePath("/keys");
}

// Crée ou met à jour une variable (clé unique par projet).
export async function upsertSecret(
  projectId: string,
  key: string,
  value: string,
  secretId?: string,
): Promise<SecretView> {
  const user = await requireUser();
  await assertProjectOwner(projectId, user.id);

  const cleanKey = key.trim();
  if (!KEY_RE.test(cleanKey)) {
    throw new Error(
      "Nom invalide : lettres, chiffres et _ uniquement (ex: DATABASE_URL)",
    );
  }
  const valueEncrypted = encryptSecret(value);

  if (secretId) {
    await db
      .update(secrets)
      .set({ key: cleanKey, valueEncrypted, updatedAt: new Date() })
      .where(and(eq(secrets.id, secretId), eq(secrets.projectId, projectId)));
    revalidatePath("/keys");
    return { id: secretId, key: cleanKey, value };
  }

  const [row] = await db
    .insert(secrets)
    .values({ projectId, key: cleanKey, valueEncrypted })
    .returning();
  revalidatePath("/keys");
  return { id: row.id, key: cleanKey, value };
}

export async function deleteSecret(
  projectId: string,
  secretId: string,
): Promise<void> {
  const user = await requireUser();
  await assertProjectOwner(projectId, user.id);
  await db
    .delete(secrets)
    .where(and(eq(secrets.id, secretId), eq(secrets.projectId, projectId)));
  revalidatePath("/keys");
}

// Importe un bloc .env collé : parse KEY=VALUE ligne par ligne (upsert).
export async function importEnv(
  projectId: string,
  raw: string,
): Promise<number> {
  const user = await requireUser();
  await assertProjectOwner(projectId, user.id);

  const existing = await db
    .select()
    .from(secrets)
    .where(eq(secrets.projectId, projectId));
  const byKey = new Map(existing.map((s) => [s.key, s.id]));

  let count = 0;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq0 = trimmed.indexOf("=");
    if (eq0 === -1) continue;
    const key = trimmed.slice(0, eq0).trim().replace(/^export\s+/, "");
    let value = trimmed.slice(eq0 + 1).trim();
    // retire les guillemets englobants
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!KEY_RE.test(key)) continue;
    const valueEncrypted = encryptSecret(value);
    const id = byKey.get(key);
    if (id) {
      await db
        .update(secrets)
        .set({ valueEncrypted, updatedAt: new Date() })
        .where(eq(secrets.id, id));
    } else {
      await db.insert(secrets).values({ projectId, key, valueEncrypted });
    }
    count++;
  }
  revalidatePath("/keys");
  return count;
}

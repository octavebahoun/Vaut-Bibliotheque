"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, images, projects, libraryShares } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

export type UserRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  imageCount: number;
  projectCount: number;
  isSelf: boolean;
};

export type AdminStats = {
  users: number;
  admins: number;
  images: number;
  projects: number;
  shares: number;
};

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");
  if (user.role !== "admin") throw new Error("Réservé aux administrateurs");
  return user;
}

async function countAdmins(): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));
  return n;
}

async function countRows(table: typeof users | typeof images | typeof projects | typeof libraryShares): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
  return row?.n ?? 0;
}

export async function getStats(): Promise<AdminStats> {
  await requireAdmin();
  const [usersCount, adminsCount, imagesCount, projectsCount, sharesCount] =
    await Promise.all([
      countRows(users),
      countAdmins(),
      countRows(images),
      countRows(projects),
      countRows(libraryShares),
    ]);

  return {
    users: usersCount,
    admins: adminsCount,
    images: imagesCount,
    projects: projectsCount,
    shares: sharesCount,
  };
}

export async function listUsers(): Promise<UserRow[]> {
  const me = await requireAdmin();

  // Requêtes simples (pas de sous-requêtes jointes) puis fusion en JS.
  const [userRows, imgCounts, projCounts] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt),
    db
      .select({ userId: images.userId, c: sql<number>`count(*)::int` })
      .from(images)
      .groupBy(images.userId),
    db
      .select({ userId: projects.userId, c: sql<number>`count(*)::int` })
      .from(projects)
      .groupBy(projects.userId),
  ]);

  const imgMap = new Map(imgCounts.map((r) => [r.userId, r.c]));
  const projMap = new Map(projCounts.map((r) => [r.userId, r.c]));

  return userRows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.createdAt.toISOString(),
    imageCount: imgMap.get(r.id) ?? 0,
    projectCount: projMap.get(r.id) ?? 0,
    isSelf: r.id === me.id,
  }));
}

export async function setUserRole(
  userId: string,
  role: "admin" | "member",
): Promise<void> {
  const me = await requireAdmin();
  if (role !== "admin" && role !== "member")
    throw new Error("Rôle invalide");

  // Empêche de retirer le dernier admin (y compris soi-même).
  if (role === "member") {
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (target?.role === "admin" && (await countAdmins()) <= 1) {
      throw new Error("Impossible de retirer le dernier administrateur");
    }
  }

  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/admin");
}

export async function deleteUser(userId: string): Promise<void> {
  const me = await requireAdmin();
  if (userId === me.id)
    throw new Error("Vous ne pouvez pas supprimer votre propre compte ici");

  const [target] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return;
  if (target.role === "admin" && (await countAdmins()) <= 1) {
    throw new Error("Impossible de supprimer le dernier administrateur");
  }

  // Cascade : images, projets, secrets, sessions, config Cloudinary suivent.
  await db.delete(users).where(and(eq(users.id, userId)));
  revalidatePath("/admin");
}

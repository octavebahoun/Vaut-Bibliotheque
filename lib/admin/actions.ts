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

export async function getStats(): Promise<AdminStats> {
  await requireAdmin();
  const [u] = await db
    .select({
      users: sql<number>`count(*)::int`,
      admins: sql<number>`count(*) filter (where ${users.role} = 'admin')::int`,
    })
    .from(users);
  const [i] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(images);
  const [p] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projects);
  const [s] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(libraryShares);

  return {
    users: u.users,
    admins: u.admins,
    images: i.n,
    projects: p.n,
    shares: s.n,
  };
}

export async function listUsers(): Promise<UserRow[]> {
  const me = await requireAdmin();

  const imgCounts = db
    .select({
      userId: images.userId,
      c: sql<number>`count(*)::int`.as("c"),
    })
    .from(images)
    .groupBy(images.userId)
    .as("img_counts");

  const projCounts = db
    .select({
      userId: projects.userId,
      c: sql<number>`count(*)::int`.as("c"),
    })
    .from(projects)
    .groupBy(projects.userId)
    .as("proj_counts");

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      imageCount: sql<number>`coalesce(${imgCounts.c}, 0)::int`,
      projectCount: sql<number>`coalesce(${projCounts.c}, 0)::int`,
    })
    .from(users)
    .leftJoin(imgCounts, eq(imgCounts.userId, users.id))
    .leftJoin(projCounts, eq(projCounts.userId, users.id))
    .orderBy(users.createdAt);

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.createdAt.toISOString(),
    imageCount: r.imageCount,
    projectCount: r.projectCount,
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

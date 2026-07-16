"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { images } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserCreds } from "@/lib/cloudinary-store";
import { destroyImage } from "@/lib/cloudinary";

export type UploadedImage = {
  publicId: string;
  url: string;
  name: string;
  size: number;
  width?: number;
  height?: number;
  format?: string;
  folder?: string;
};

export async function saveImage(img: UploadedImage) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const [row] = await db
    .insert(images)
    .values({
      userId: user.id,
      publicId: img.publicId,
      url: img.url,
      name: img.name,
      size: img.size ?? 0,
      width: img.width ?? null,
      height: img.height ?? null,
      format: img.format ?? null,
      folder: img.folder && img.folder.length > 0 ? img.folder : null,
    })
    .returning();

  revalidatePath("/images");
  return row;
}

export async function deleteImageAction(id: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const [img] = await db
    .select()
    .from(images)
    .where(and(eq(images.id, id), eq(images.userId, user.id)))
    .limit(1);
  if (!img) return;

  // Suppression réelle sur Cloudinary (best-effort) puis en base.
  try {
    const creds = await getUserCreds(user.id);
    if (creds) await destroyImage(creds, img.publicId);
  } catch {
    // on supprime quand même l'entrée locale
  }
  await db.delete(images).where(eq(images.id, id));
  revalidatePath("/images");
}

// Active/désactive le partage public et renvoie le token courant (ou null).
export async function toggleShareAction(
  id: string,
): Promise<{ shareToken: string | null }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const [img] = await db
    .select()
    .from(images)
    .where(and(eq(images.id, id), eq(images.userId, user.id)))
    .limit(1);
  if (!img) throw new Error("Image introuvable");

  const shareToken = img.shareToken
    ? null
    : randomBytes(12).toString("base64url");

  await db
    .update(images)
    .set({ shareToken })
    .where(and(eq(images.id, id), eq(images.userId, user.id)));

  revalidatePath("/images");
  return { shareToken };
}

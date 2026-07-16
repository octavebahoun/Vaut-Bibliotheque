"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { images } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserCreds } from "@/lib/cloudinary-store";
import { destroyImage, listCloudinaryImages } from "@/lib/cloudinary";
import type { Image } from "@/lib/db/schema";

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

// Importe les images déjà présentes sur le compte Cloudinary de l'utilisateur
// (uploadées hors de Vault). Dédoublonne par public_id.
export async function importFromCloudinary(): Promise<{
  imported: Image[];
  skipped: number;
  scanned: number;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");

  const creds = await getUserCreds(user.id);
  if (!creds)
    return {
      imported: [],
      skipped: 0,
      scanned: 0,
      error: "Cloudinary non configuré",
    };

  // public_id déjà connus pour cet utilisateur.
  const existing = await db
    .select({ publicId: images.publicId })
    .from(images)
    .where(eq(images.userId, user.id));
  const known = new Set(existing.map((e) => e.publicId));

  const toInsert: (typeof images.$inferInsert)[] = [];
  let scanned = 0;
  let skipped = 0;
  let cursor: string | undefined;
  const MAX_PAGES = 20; // garde-fou (~2000 images)

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const { resources, nextCursor } = await listCloudinaryImages(
        creds,
        cursor,
      );
      for (const r of resources) {
        scanned++;
        if (known.has(r.publicId)) {
          skipped++;
          continue;
        }
        known.add(r.publicId);
        toInsert.push({
          userId: user.id,
          publicId: r.publicId,
          url: r.url,
          name: r.name,
          size: r.size ?? 0,
          width: r.width ?? null,
          height: r.height ?? null,
          format: r.format ?? null,
          folder: r.folder && r.folder.length > 0 ? r.folder : null,
        });
      }
      if (!nextCursor) break;
      cursor = nextCursor;
    }
  } catch (e) {
    return {
      imported: [],
      skipped,
      scanned,
      error: e instanceof Error ? e.message : "Erreur Cloudinary",
    };
  }

  if (toInsert.length === 0) {
    return { imported: [], skipped, scanned };
  }

  const inserted = await db.insert(images).values(toInsert).returning();
  revalidatePath("/images");
  return { imported: inserted, skipped, scanned };
}

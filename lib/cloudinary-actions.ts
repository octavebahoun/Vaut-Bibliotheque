"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cloudinaryConfigs } from "@/lib/db/schema";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { pingCloudinary } from "@/lib/cloudinary";
import { getCurrentUser } from "@/lib/auth/session";

export type SaveResult = { ok: boolean; error?: string };

// Enregistre (ou met à jour) la config Cloudinary de l'utilisateur.
// Vérifie les identifiants via un ping avant de les stocker.
export async function saveCloudinaryConfig(
  _prev: SaveResult,
  formData: FormData,
): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  const cloudName = String(formData.get("cloudName") ?? "").trim();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  let apiSecret = String(formData.get("apiSecret") ?? "").trim();
  const folder = String(formData.get("folder") ?? "").trim() || "vault";

  // En mise à jour, un secret vide = on garde l'existant.
  if (!apiSecret) {
    const [existing] = await db
      .select({ enc: cloudinaryConfigs.apiSecretEncrypted })
      .from(cloudinaryConfigs)
      .where(eq(cloudinaryConfigs.userId, user.id))
      .limit(1);
    if (existing) {
      try {
        apiSecret = decryptSecret(existing.enc);
      } catch {
        return { ok: false, error: "Impossible de relire le secret existant" };
      }
    }
  }

  if (!cloudName || !apiKey || !apiSecret) {
    return { ok: false, error: "Cloud name, API key et API secret sont requis" };
  }

  const valid = await pingCloudinary({ cloudName, apiKey, apiSecret });
  if (!valid) {
    return {
      ok: false,
      error: "Identifiants refusés par Cloudinary — vérifiez-les",
    };
  }

  const apiSecretEncrypted = encryptSecret(apiSecret);
  await db
    .insert(cloudinaryConfigs)
    .values({ userId: user.id, cloudName, apiKey, apiSecretEncrypted, folder })
    .onConflictDoUpdate({
      target: cloudinaryConfigs.userId,
      set: { cloudName, apiKey, apiSecretEncrypted, folder, updatedAt: new Date() },
    });

  revalidatePath("/settings");
  revalidatePath("/images");
  return { ok: true };
}

export async function removeCloudinaryConfig(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié");
  await db
    .delete(cloudinaryConfigs)
    .where(eq(cloudinaryConfigs.userId, user.id));
  revalidatePath("/settings");
  revalidatePath("/images");
}

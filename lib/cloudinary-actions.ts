"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cloudinaryConfigs } from "@/lib/db/schema";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { verifyCloudinary } from "@/lib/cloudinary";
import { getCurrentUser } from "@/lib/auth/session";

export type SaveResult = { ok: boolean; error?: string; warning?: string };

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

  const verdict = await verifyCloudinary({ cloudName, apiKey, apiSecret });
  // On ne bloque que sur un refus d'authentification avéré (401/404).
  if (!verdict.ok && verdict.reason === "rejected") {
    return {
      ok: false,
      error:
        verdict.status === 404
          ? "Cloud name introuvable — vérifiez-le (Settings → API Keys)."
          : "API Key ou API Secret refusés par Cloudinary — vérifiez-les.",
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
  // Enregistré, mais la vérification n'a pas pu aboutir : on prévient.
  if (!verdict.ok) {
    return {
      ok: true,
      warning:
        "Enregistré, mais impossible de vérifier auprès de Cloudinary pour l'instant. Faites un test d'upload ; si ça échoue, revérifiez vos identifiants.",
    };
  }
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

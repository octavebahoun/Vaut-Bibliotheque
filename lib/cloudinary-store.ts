import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cloudinaryConfigs } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/crypto";
import type { CloudinaryCreds } from "@/lib/cloudinary";

// Identifiants complets (secret déchiffré) — usage SERVEUR uniquement.
export async function getUserCreds(
  userId: string,
): Promise<CloudinaryCreds | null> {
  const [row] = await db
    .select()
    .from(cloudinaryConfigs)
    .where(eq(cloudinaryConfigs.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    cloudName: row.cloudName,
    apiKey: row.apiKey,
    apiSecret: decryptSecret(row.apiSecretEncrypted),
    folder: row.folder,
  };
}

// Statut non sensible (jamais le secret) — pour l'affichage.
export type CloudinaryStatus = {
  configured: boolean;
  cloudName?: string;
  apiKey?: string;
  folder?: string;
};

export async function getCloudinaryStatus(
  userId: string,
): Promise<CloudinaryStatus> {
  const [row] = await db
    .select({
      cloudName: cloudinaryConfigs.cloudName,
      apiKey: cloudinaryConfigs.apiKey,
      folder: cloudinaryConfigs.folder,
    })
    .from(cloudinaryConfigs)
    .where(eq(cloudinaryConfigs.userId, userId))
    .limit(1);
  if (!row) return { configured: false };
  return {
    configured: true,
    cloudName: row.cloudName,
    apiKey: row.apiKey,
    folder: row.folder,
  };
}

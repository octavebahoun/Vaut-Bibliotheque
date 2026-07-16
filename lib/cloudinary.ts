import { v2 as cloudinary } from "cloudinary";

export type CloudinaryCreds = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

// Normalise un nom de collection/dossier : minuscules, [a-z0-9-_] et espaces→-.
// Retourne "" si rien d'exploitable (= racine). Empêche toute traversée de chemin.
export function sanitizeCollection(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 40);
}

// Signature d'un upload direct depuis le navigateur (upload signé),
// avec les identifiants Cloudinary de l'utilisateur.
export function signUpload(
  creds: CloudinaryCreds,
  params: Record<string, string | number>,
): { signature: string; apiKey: string; cloudName: string } {
  const signature = cloudinary.utils.api_sign_request(params, creds.apiSecret);
  return { signature, apiKey: creds.apiKey, cloudName: creds.cloudName };
}

// Suppression réelle sur Cloudinary via l'API REST (upload/destroy signé).
export async function destroyImage(
  creds: CloudinaryCreds,
  publicId: string,
): Promise<void> {
  const timestamp = Math.round(Date.now() / 1000);
  const toSign = { invalidate: true, public_id: publicId, timestamp };
  const signature = cloudinary.utils.api_sign_request(toSign, creds.apiSecret);

  const body = new URLSearchParams({
    public_id: publicId,
    invalidate: "true",
    timestamp: String(timestamp),
    api_key: creds.apiKey,
    signature,
  });

  await fetch(
    `https://api.cloudinary.com/v1_1/${creds.cloudName}/image/destroy`,
    { method: "POST", body },
  );
}

export type CloudinaryUsage = {
  plan?: string;
  creditsUsed?: number;
  creditsLimit?: number;
  storageBytes?: number;
  bandwidthBytes?: number;
  transformations?: number;
};

// Usage réel du compte via l'Admin API /usage (Basic auth).
export async function getCloudinaryUsage(
  creds: Omit<CloudinaryCreds, "folder">,
): Promise<CloudinaryUsage | null> {
  const auth = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString(
    "base64",
  );
  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${creds.cloudName}/usage`,
      { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as Record<string, unknown>;
    const credits = d.credits as
      | { usage?: number; limit?: number }
      | undefined;
    const storage = d.storage as { usage?: number } | undefined;
    const bandwidth = d.bandwidth as { usage?: number } | undefined;
    const transformations = d.transformations as
      | { usage?: number }
      | undefined;
    return {
      plan: typeof d.plan === "string" ? d.plan : undefined,
      creditsUsed: credits?.usage,
      creditsLimit: credits?.limit,
      storageBytes: storage?.usage,
      bandwidthBytes: bandwidth?.usage,
      transformations: transformations?.usage,
    };
  } catch {
    return null;
  }
}

// Vérifie des identifiants via l'endpoint /ping de l'Admin API (Basic auth).
export async function pingCloudinary(
  creds: Omit<CloudinaryCreds, "folder">,
): Promise<boolean> {
  const auth = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString(
    "base64",
  );
  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${creds.cloudName}/ping`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data?.status === "ok";
  } catch {
    return false;
  }
}

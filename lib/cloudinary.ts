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

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "rejected" | "unverified"; status?: number };

// Vérifie des identifiants via l'endpoint /ping de l'Admin API (Basic auth).
// On distingue un vrai refus d'authentification (401/403 avec erreur Cloudinary)
// d'une simple impossibilité de vérifier (réseau, réponse inattendue).
export async function verifyCloudinary(
  creds: Omit<CloudinaryCreds, "folder">,
): Promise<VerifyResult> {
  const auth = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString(
    "base64",
  );
  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${creds.cloudName}/ping`,
      { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" },
    );
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as {
        status?: string;
      } | null;
      if (data?.status === "ok") return { ok: true };
      return { ok: false, reason: "unverified", status: res.status };
    }
    // 401 = mauvaise API key/secret ; 404 = cloud name inexistant.
    if (res.status === 401 || res.status === 404) {
      return { ok: false, reason: "rejected", status: res.status };
    }
    // Autres statuts (403 proxy, 5xx…) : on ne peut pas conclure.
    return { ok: false, reason: "unverified", status: res.status };
  } catch {
    return { ok: false, reason: "unverified" };
  }
}

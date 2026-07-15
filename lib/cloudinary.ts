import { v2 as cloudinary } from "cloudinary";

export type CloudinaryCreds = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

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

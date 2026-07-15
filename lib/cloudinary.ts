import { v2 as cloudinary } from "cloudinary";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      "Cloudinary non configuré (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)",
    );
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
}

export const CLOUD_NAME = () => process.env.CLOUDINARY_CLOUD_NAME ?? "";
export const UPLOAD_FOLDER = () =>
  process.env.CLOUDINARY_UPLOAD_FOLDER || "vault";

// Signature d'un upload direct depuis le navigateur (upload signé).
export function signUpload(params: Record<string, string | number>): {
  signature: string;
  apiKey: string;
  cloudName: string;
} {
  ensureConfigured();
  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!,
  );
  return {
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
  };
}

// Suppression réelle sur Cloudinary.
export async function destroyImage(publicId: string): Promise<void> {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { invalidate: true });
}

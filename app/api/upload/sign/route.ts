import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { signUpload, UPLOAD_FOLDER } from "@/lib/cloudinary";

// Renvoie une signature d'upload Cloudinary à usage unique (upload signé).
// Nécessite une session valide.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = UPLOAD_FOLDER();
    const { signature, apiKey, cloudName } = signUpload({ timestamp, folder });
    return NextResponse.json({
      signature,
      timestamp,
      folder,
      apiKey,
      cloudName,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur de signature" },
      { status: 500 },
    );
  }
}

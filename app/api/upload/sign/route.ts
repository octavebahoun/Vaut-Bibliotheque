import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserCreds } from "@/lib/cloudinary-store";
import { signUpload } from "@/lib/cloudinary";

// Renvoie une signature d'upload Cloudinary avec les identifiants de l'utilisateur.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const creds = await getUserCreds(user.id);
  if (!creds) {
    return NextResponse.json(
      { error: "Cloudinary non configuré", code: "not_configured" },
      { status: 400 },
    );
  }

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = creds.folder;
    const { signature, apiKey, cloudName } = signUpload(creds, {
      timestamp,
      folder,
    });
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

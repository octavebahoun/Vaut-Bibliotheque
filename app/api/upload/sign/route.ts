import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserCreds } from "@/lib/cloudinary-store";
import { signUpload, sanitizeCollection } from "@/lib/cloudinary";

// Renvoie une signature d'upload Cloudinary avec les identifiants de l'utilisateur.
// Accepte une "collection" optionnelle → sous-dossier du dossier racine.
export async function POST(req: Request) {
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

  let collection = "";
  try {
    const body = (await req.json()) as { collection?: string };
    collection = sanitizeCollection(body?.collection ?? "");
  } catch {
    collection = "";
  }

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = collection ? `${creds.folder}/${collection}` : creds.folder;
    const { signature, apiKey, cloudName } = signUpload(creds, {
      timestamp,
      folder,
    });
    return NextResponse.json({
      signature,
      timestamp,
      folder,
      collection,
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

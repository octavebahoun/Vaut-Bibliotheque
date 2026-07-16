import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { images } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getCloudinaryStatus, getUserCreds } from "@/lib/cloudinary-store";
import { getCloudinaryUsage, type CloudinaryUsage } from "@/lib/cloudinary";
import CloudinarySettings from "@/components/settings/CloudinarySettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const status = await getCloudinaryStatus(user.id);

  // Stats locales (ce que Vault a enregistré pour cet utilisateur).
  const [local] = await db
    .select({
      count: sql<number>`count(*)::int`,
      bytes: sql<number>`coalesce(sum(${images.size}), 0)::bigint`,
    })
    .from(images)
    .where(eq(images.userId, user.id));

  // Usage réel Cloudinary (si configuré).
  let usage: CloudinaryUsage | null = null;
  if (status.configured) {
    const creds = await getUserCreds(user.id);
    if (creds) usage = await getCloudinaryUsage(creds);
  }

  return (
    <CloudinarySettings
      status={status}
      usage={usage}
      localStats={{ count: local.count, bytes: Number(local.bytes) }}
    />
  );
}

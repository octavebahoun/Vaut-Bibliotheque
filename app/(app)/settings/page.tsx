import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getCloudinaryStatus } from "@/lib/cloudinary-store";
import CloudinarySettings from "@/components/settings/CloudinarySettings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const status = await getCloudinaryStatus(user.id);
  return <CloudinarySettings status={status} />;
}

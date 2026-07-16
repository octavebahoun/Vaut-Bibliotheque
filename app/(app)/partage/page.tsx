import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyGrants, listSharedWithMe } from "@/lib/sharing/actions";
import SharingManager from "@/components/sharing/SharingManager";

export const dynamic = "force-dynamic";

export default async function PartagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [grants, shared] = await Promise.all([
    listMyGrants(),
    listSharedWithMe(),
  ]);
  return <SharingManager initialGrants={grants} sharedWithMe={shared} />;
}

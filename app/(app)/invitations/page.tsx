import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listInvites } from "@/lib/invites/actions";
import InvitesManager from "@/components/invites/InvitesManager";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/images");
  const invites = await listInvites();
  return <InvitesManager initialInvites={invites} />;
}

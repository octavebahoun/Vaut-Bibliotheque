import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStats, listUsers } from "@/lib/admin/actions";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/images");

  const [stats, users] = await Promise.all([getStats(), listUsers()]);
  return <AdminDashboard stats={stats} initialUsers={users} />;
}

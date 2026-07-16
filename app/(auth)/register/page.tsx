import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth/session";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/images");
  const { code } = await searchParams;
  return <AuthForm mode="register" initialCode={code ?? ""} />;
}

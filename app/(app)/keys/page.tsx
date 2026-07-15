import KeysManager from "@/components/keys/KeysManager";
import { getProjects } from "@/lib/keys/actions";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const projects = await getProjects();
  return <KeysManager initialProjects={projects} />;
}

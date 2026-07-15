import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { images } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import ImageStudio from "@/components/images/ImageStudio";

export const dynamic = "force-dynamic";

export default async function ImagesPage() {
  const user = await getCurrentUser();
  // Le layout (app) garantit déjà l'auth, mais on garde le garde-fou de type.
  const rows = user
    ? await db
        .select()
        .from(images)
        .where(eq(images.userId, user.id))
        .orderBy(desc(images.createdAt))
    : [];

  return <ImageStudio initialImages={rows} />;
}

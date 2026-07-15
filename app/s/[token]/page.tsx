import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { images } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [img] = await db
    .select()
    .from(images)
    .where(eq(images.shareToken, token))
    .limit(1);

  if (!img) notFound();

  return (
    <div className="share-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.url} alt={img.name} />
      <div className="share-meta">
        <div className="logo" style={{ marginBottom: 6 }}>
          Vault <span>/ partage</span>
        </div>
        <div className="stat-chip">{img.name}</div>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Visible dans les logs (Vercel) pour le diagnostic.
    console.error("Erreur de segment app:", error);
  }, [error]);

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="empty-state">
        <div className="empty-icon">!</div>
        <div className="empty-title">Une erreur est survenue</div>
        <p className="empty-sub" style={{ marginBottom: 20 }}>
          Quelque chose s&apos;est mal passé de notre côté.
          {error.digest ? ` (réf. ${error.digest})` : ""}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="btn-sm solid" onClick={() => reset()}>
            Réessayer
          </button>
          <Link className="btn-sm" href="/images">
            Retour aux images
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth/actions";

export default function AppHeader({ email }: { email: string }) {
  const pathname = usePathname();
  const is = (p: string) => pathname.startsWith(p);

  return (
    <header className="app-header">
      <div className="logo">
        Vault <span>/ atelier</span>
      </div>
      <div className="header-right">
        <Link
          href="/images"
          className={`nav-link ${is("/images") ? "active" : ""}`}
        >
          Images
        </Link>
        <Link
          href="/keys"
          className={`nav-link ${is("/keys") ? "active" : ""}`}
        >
          Clés / .env
        </Link>
        <span className="stat-chip" title={email}>
          {email}
        </span>
        <form action={logout}>
          <button className="btn-ghost-border" type="submit">
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  );
}

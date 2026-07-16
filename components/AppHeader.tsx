"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/auth/actions";

export default function AppHeader({
  email,
  isAdmin = false,
}: {
  email: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const is = (p: string) => pathname.startsWith(p);
  const close = () => setOpen(false);

  const links = [
    { href: "/images", label: "Images" },
    { href: "/keys", label: "Clés / .env" },
    { href: "/partage", label: "Partage" },
    { href: "/settings", label: "Réglages" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="app-header">
      <div className="logo">
        Vault <span>/ atelier</span>
      </div>

      <button
        className={`nav-toggle ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
      >
        <span />
        <span />
        <span />
      </button>

      {open && <div className="nav-scrim" onClick={close} />}

      <nav className={`header-right ${open ? "open" : ""}`}>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={close}
            className={`nav-link ${is(l.href) ? "active" : ""}`}
          >
            {l.label}
          </Link>
        ))}
        <span className="stat-chip nav-email" title={email}>
          {email}
        </span>
        <form action={logout}>
          <button className="btn-ghost-border" type="submit">
            Déconnexion
          </button>
        </form>
      </nav>
    </header>
  );
}

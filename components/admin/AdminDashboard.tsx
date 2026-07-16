"use client";

import { useState } from "react";
import Link from "next/link";
import {
  setUserRole,
  deleteUser,
  type UserRow,
  type AdminStats,
} from "@/lib/admin/actions";
import Toast, { useToast } from "@/components/Toast";

export default function AdminDashboard({
  stats,
  initialUsers,
}: {
  stats: AdminStats;
  initialUsers: UserRow[];
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast, show } = useToast();

  async function toggleRole(u: UserRow) {
    const next = u.role === "admin" ? "member" : "admin";
    setBusy(u.id);
    try {
      await setUserRole(u.id, next);
      setUsers((list) =>
        list.map((x) => (x.id === u.id ? { ...x, role: next } : x)),
      );
      show(
        next === "admin"
          ? `${u.email} est maintenant admin`
          : `${u.email} repasse membre`,
      );
    } catch (e) {
      show(e instanceof Error ? e.message : "Erreur", true);
    } finally {
      setBusy(null);
    }
  }

  async function onDelete(u: UserRow) {
    if (
      !confirm(
        `Supprimer ${u.email} ? Ses images, projets et secrets seront effacés. Action définitive.`,
      )
    )
      return;
    setBusy(u.id);
    try {
      await deleteUser(u.id);
      setUsers((list) => list.filter((x) => x.id !== u.id));
      show("Compte supprimé");
    } catch (e) {
      show(e instanceof Error ? e.message : "Erreur", true);
    } finally {
      setBusy(null);
    }
  }

  const tiles = [
    { label: "Utilisateurs", value: stats.users },
    { label: "Admins", value: stats.admins },
    { label: "Images", value: stats.images },
    { label: "Projets", value: stats.projects },
    { label: "Invitations en attente", value: stats.pendingInvites },
  ];

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      <div className="admin-head">
        <div className="section-label" style={{ marginBottom: 0 }}>
          Administration · Tableau de bord
        </div>
        <Link className="btn-sm" href="/invitations">
          Gérer les invitations
        </Link>
      </div>

      <div className="stat-tiles">
        {tiles.map((t) => (
          <div className="stat-tile" key={t.label}>
            <div className="stat-value">{t.value}</div>
            <div className="stat-label">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="section-label" style={{ marginTop: 40 }}>
        Utilisateurs
      </div>
      <div className="user-table">
        <div className="user-row head">
          <span>E-mail</span>
          <span>Rôle</span>
          <span>Contenu</span>
          <span>Inscrit le</span>
          <span style={{ textAlign: "right" }}>Actions</span>
        </div>
        {users.map((u) => (
          <div className="user-row" key={u.id}>
            <span className="u-email">
              {u.email}
              {u.isSelf && <span className="u-self">vous</span>}
            </span>
            <span>
              <span className={`role-badge ${u.role}`}>
                {u.role === "admin" ? "Admin" : "Membre"}
              </span>
            </span>
            <span className="u-meta">
              {u.imageCount} img · {u.projectCount} proj.
            </span>
            <span className="u-meta">
              {new Date(u.createdAt).toLocaleDateString("fr-FR")}
            </span>
            <span className="row-actions">
              <button
                className="icon-btn"
                disabled={busy === u.id}
                onClick={() => toggleRole(u)}
              >
                {u.role === "admin" ? "Rétrograder" : "Promouvoir"}
              </button>
              {!u.isSelf && (
                <button
                  className="icon-btn danger"
                  disabled={busy === u.id}
                  onClick={() => onDelete(u)}
                >
                  Suppr.
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      <Toast toast={toast} />
    </div>
  );
}

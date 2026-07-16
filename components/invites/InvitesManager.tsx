"use client";

import { useState } from "react";
import {
  createInvite,
  revokeInvite,
  type InviteView,
} from "@/lib/invites/actions";
import Toast, { useToast } from "@/components/Toast";

function inviteUrl(code: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/register?code=${encodeURIComponent(code)}`;
}

function stateOf(inv: InviteView): "used" | "expired" | "active" {
  if (inv.used) return "used";
  if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now())
    return "expired";
  return "active";
}

export default function InvitesManager({
  initialInvites,
}: {
  initialInvites: InviteView[];
}) {
  const [list, setList] = useState<InviteView[]>(initialInvites);
  const [email, setEmail] = useState("");
  const [expiry, setExpiry] = useState("7");
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  async function onCreate() {
    setBusy(true);
    try {
      const inv = await createInvite({
        email: email.trim() || undefined,
        expiresInDays: expiry === "0" ? undefined : Number(expiry),
      });
      setList((l) => [inv, ...l]);
      setEmail("");
      await navigator.clipboard.writeText(inviteUrl(inv.code)).catch(() => {});
      show("Invitation créée — lien copié");
    } catch (e) {
      show(e instanceof Error ? e.message : "Erreur", true);
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(inv: InviteView) {
    if (!confirm(`Révoquer l'invitation ${inv.code} ?`)) return;
    setList((l) => l.filter((x) => x.id !== inv.id));
    try {
      await revokeInvite(inv.id);
      show("Invitation révoquée");
    } catch {
      show("Erreur", true);
    }
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    show(label);
  }

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <div className="section-label">Administration · Invitations</div>

      <div className="invite-toolbar">
        <div className="field grow">
          <label htmlFor="inv-email">E-mail (optionnel)</label>
          <input
            id="inv-email"
            className="input"
            type="email"
            placeholder="réserver à une adresse précise"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="inv-exp">Expiration</label>
          <select
            id="inv-exp"
            className="input"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="1">1 jour</option>
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
            <option value="0">Jamais</option>
          </select>
        </div>
        <button className="btn-primary" onClick={onCreate} disabled={busy} style={{ width: "auto", padding: "13px 26px" }}>
          {busy ? "…" : "Générer une invitation"}
        </button>
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✉</div>
          <div className="empty-title">Aucune invitation</div>
          <p className="empty-sub">
            Générez un code pour permettre à quelqu&apos;un de créer un compte
          </p>
        </div>
      ) : (
        <div className="invite-table">
          <div className="invite-row head">
            <span>Code</span>
            <span>Destinataire / usage</span>
            <span>État</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>
          {list.map((inv) => {
            const st = stateOf(inv);
            return (
              <div className="invite-row" key={inv.id}>
                <span
                  className="invite-code"
                  title="Copier le code"
                  onClick={() => copy(inv.code, "Code copié")}
                >
                  {inv.code}
                </span>
                <span className="invite-meta">
                  {inv.used
                    ? `Utilisé par ${inv.usedByEmail ?? "—"}`
                    : inv.email
                      ? `Réservé à ${inv.email}`
                      : "Ouvert à tous"}
                  {inv.expiresAt && !inv.used && (
                    <>
                      {" · expire le "}
                      {new Date(inv.expiresAt).toLocaleDateString("fr-FR")}
                    </>
                  )}
                </span>
                <span className={`invite-state ${st}`}>
                  {st === "used"
                    ? "Utilisé"
                    : st === "expired"
                      ? "Expiré"
                      : "Actif"}
                </span>
                <span className="row-actions">
                  {!inv.used && st !== "expired" && (
                    <button
                      className="icon-btn"
                      onClick={() =>
                        copy(inviteUrl(inv.code), "Lien d'invitation copié")
                      }
                    >
                      Copier lien
                    </button>
                  )}
                  {!inv.used && (
                    <button
                      className="icon-btn danger"
                      onClick={() => onRevoke(inv)}
                    >
                      Révoquer
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}

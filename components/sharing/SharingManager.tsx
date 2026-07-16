"use client";

import { useMemo, useState } from "react";
import {
  inviteToLibrary,
  revokeGrant,
  type ShareGrant,
  type SharedLibrary,
} from "@/lib/sharing/actions";
import Toast, { useToast } from "@/components/Toast";
import Lightbox, { type LightboxItem } from "@/components/Lightbox";

export default function SharingManager({
  initialGrants,
  sharedWithMe,
}: {
  initialGrants: ShareGrant[];
  sharedWithMe: SharedLibrary[];
}) {
  const [grants, setGrants] = useState<ShareGrant[]>(initialGrants);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  // Lightbox global sur toutes les images partagées avec moi (aplaties).
  const flatShared: LightboxItem[] = useMemo(
    () =>
      sharedWithMe.flatMap((lib) =>
        lib.images.map((i) => ({ url: i.url, name: i.name })),
      ),
    [sharedWithMe],
  );
  const [lbIndex, setLbIndex] = useState<number | null>(null);
  const offsets = useMemo(() => {
    const o: number[] = [];
    let acc = 0;
    for (const lib of sharedWithMe) {
      o.push(acc);
      acc += lib.images.length;
    }
    return o;
  }, [sharedWithMe]);

  async function onInvite() {
    const e = email.trim();
    if (!e) return;
    setBusy(true);
    try {
      const { grant, emailSent } = await inviteToLibrary(e);
      setGrants((g) => [grant, ...g.filter((x) => x.email !== grant.email)]);
      setEmail("");
      if (emailSent) show(`Invitation envoyée à ${grant.email}`);
      else if (grant.hasAccount)
        show(`${grant.email} a maintenant accès (e-mail non configuré)`);
      else
        show(
          `Invitation enregistrée — ${grant.email} y accédera dès son inscription`,
        );
    } catch (err) {
      show(err instanceof Error ? err.message : "Erreur", true);
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(g: ShareGrant) {
    if (!confirm(`Retirer l'accès de ${g.email} ?`)) return;
    setGrants((list) => list.filter((x) => x.id !== g.id));
    try {
      await revokeGrant(g.id);
      show("Accès retiré");
    } catch {
      show("Erreur", true);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 1000 }}>
      {/* Inviter */}
      <div className="section-label">Partage · Inviter à ma bibliothèque</div>
      <p className="settings-sub" style={{ maxWidth: "62ch", marginBottom: 22 }}>
        Les personnes que vous invitez (par e-mail) voient uniquement les images
        que vous avez marquées <b>Partager</b> dans votre bibliothèque, en
        lecture seule.
      </p>

      <div className="invite-toolbar">
        <div className="field grow">
          <label htmlFor="inv-email">E-mail de la personne</label>
          <input
            id="inv-email"
            className="input"
            type="email"
            placeholder="collegue@exemple.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onInvite()}
          />
        </div>
        <button
          className="btn-primary"
          onClick={onInvite}
          disabled={busy || !email.trim()}
          style={{ width: "auto", padding: "13px 26px" }}
        >
          {busy ? "…" : "Inviter"}
        </button>
      </div>

      {grants.length === 0 ? (
        <p className="empty-sub" style={{ padding: "6px 0 8px" }}>
          Vous n&apos;avez encore invité personne.
        </p>
      ) : (
        <div className="invite-table" style={{ marginBottom: 8 }}>
          <div className="invite-row head">
            <span>E-mail</span>
            <span>Statut</span>
            <span></span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>
          {grants.map((g) => (
            <div className="invite-row" key={g.id}>
              <span className="invite-code" style={{ cursor: "default" }}>
                {g.email}
              </span>
              <span className="invite-meta">
                {g.hasAccount ? "Compte actif" : "En attente d'inscription"}
              </span>
              <span className={`invite-state ${g.hasAccount ? "active" : "used"}`}>
                {g.hasAccount ? "Accès" : "Invité"}
              </span>
              <span className="row-actions">
                <button className="icon-btn danger" onClick={() => onRevoke(g)}>
                  Retirer
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Partagé avec moi */}
      <div className="divider" style={{ margin: "44px 0" }} />
      <div className="section-label">Partagé avec moi</div>

      {sharedWithMe.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">↔</div>
          <div className="empty-title">Rien pour l&apos;instant</div>
          <p className="empty-sub">
            Les bibliothèques que d&apos;autres partagent avec vous
            apparaîtront ici.
          </p>
        </div>
      ) : (
        sharedWithMe.map((lib, libIdx) => (
          <div key={lib.ownerId} style={{ marginBottom: 36 }}>
            <div className="shared-owner">
              <span className="shared-owner-email">{lib.ownerEmail}</span>
              <span className="stat-chip">{lib.images.length} images</span>
            </div>
            {lib.images.length === 0 ? (
              <p className="empty-sub">
                Aucune image partagée par cette personne pour le moment.
              </p>
            ) : (
              <div className="gallery-grid">
                {lib.images.map((img, i) => (
                  <div
                    className="img-card"
                    key={img.id}
                    onClick={() => setLbIndex(offsets[libIdx] + i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.name} loading="lazy" />
                    <div
                      className="img-overlay"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        className="img-name-label"
                        onClick={() => setLbIndex(offsets[libIdx] + i)}
                        style={{ cursor: "zoom-in" }}
                      >
                        {img.name}
                      </span>
                      <button
                        className="btn-chip"
                        onClick={(e) => {
                          navigator.clipboard
                            .writeText(img.url)
                            .catch(() => {});
                          const b = e.currentTarget;
                          const o = b.textContent;
                          b.textContent = "Copié ✓";
                          b.classList.add("copied");
                          setTimeout(() => {
                            b.textContent = o;
                            b.classList.remove("copied");
                          }, 1500);
                          show("Lien copié");
                        }}
                      >
                        Copier le lien
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      <Lightbox
        items={flatShared}
        index={lbIndex}
        onClose={() => setLbIndex(null)}
        onIndex={setLbIndex}
      />
      <Toast toast={toast} />
    </div>
  );
}

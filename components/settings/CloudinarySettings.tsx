"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveCloudinaryConfig,
  removeCloudinaryConfig,
  type SaveResult,
} from "@/lib/cloudinary-actions";
import type { CloudinaryStatus } from "@/lib/cloudinary-store";
import type { CloudinaryUsage } from "@/lib/cloudinary";
import Toast, { useToast } from "@/components/Toast";

function fmtBytes(b: number): string {
  if (!b) return "0 B";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
  return (b / 1073741824).toFixed(2) + " GB";
}

export default function CloudinarySettings({
  status,
  usage,
  localStats,
}: {
  status: CloudinaryStatus;
  usage: CloudinaryUsage | null;
  localStats: { count: number; bytes: number };
}) {
  const router = useRouter();
  const { toast, show } = useToast();
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    saveCloudinaryConfig,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      show(state.warning ?? "Cloudinary connecté ✓", !!state.warning);
      router.refresh();
    }
  }, [state, router, show]);

  const [removing, setRemoving] = useState(false);
  async function onRemove() {
    if (!confirm("Déconnecter votre compte Cloudinary ?")) return;
    setRemoving(true);
    try {
      await removeCloudinaryConfig();
      show("Cloudinary déconnecté");
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="section-label">Réglages · Stockage d&apos;images</div>

      {/* Usage */}
      <div className="usage-panel">
        <div className="usage-tile">
          <div className="usage-value">{localStats.count}</div>
          <div className="usage-label">Images dans Vault</div>
        </div>
        <div className="usage-tile">
          <div className="usage-value">{fmtBytes(localStats.bytes)}</div>
          <div className="usage-label">Poids enregistré</div>
        </div>
        {usage?.storageBytes != null && (
          <div className="usage-tile">
            <div className="usage-value">{fmtBytes(usage.storageBytes)}</div>
            <div className="usage-label">Stockage Cloudinary</div>
          </div>
        )}
        {usage?.creditsLimit != null && (
          <div className="usage-tile wide">
            <div className="usage-label" style={{ marginBottom: 8 }}>
              Crédits Cloudinary{usage.plan ? ` · ${usage.plan}` : ""}
            </div>
            <div className="usage-bar">
              <div
                className="usage-bar-fill"
                style={{
                  width: `${Math.min(
                    100,
                    ((usage.creditsUsed ?? 0) / usage.creditsLimit) * 100,
                  )}%`,
                }}
              />
            </div>
            <div className="usage-sub">
              {(usage.creditsUsed ?? 0).toFixed(2)} / {usage.creditsLimit}{" "}
              crédits
              {usage.bandwidthBytes != null && (
                <> · {fmtBytes(usage.bandwidthBytes)} bande passante</>
              )}
            </div>
          </div>
        )}
        {status.configured && !usage && (
          <div className="usage-tile wide">
            <div className="usage-sub" style={{ color: "var(--slate)" }}>
              Usage Cloudinary indisponible pour le moment.
            </div>
          </div>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-head">
          <div>
            <div className="serif" style={{ fontSize: 28 }}>
              Cloudinary
            </div>
            <p className="settings-sub">
              Vault utilise <b>votre propre</b> compte Cloudinary pour stocker
              vos images. Le plan gratuit offre ~25 Go. Vos identifiants sont
              chiffrés et ne quittent jamais nos serveurs.
            </p>
          </div>
          {status.configured && (
            <span className="status-pill ok">Connecté</span>
          )}
        </div>

        {/* Guide */}
        <ol className="guide">
          <li>
            Créez un compte gratuit sur{" "}
            <a
              href="https://cloudinary.com/users/register_free"
              target="_blank"
              rel="noreferrer"
            >
              cloudinary.com
            </a>
            .
          </li>
          <li>
            Ouvrez le{" "}
            <a
              href="https://console.cloudinary.com/settings/api-keys"
              target="_blank"
              rel="noreferrer"
            >
              tableau de bord → Settings → API Keys
            </a>
            .
          </li>
          <li>
            Copiez votre <b>Cloud name</b>, votre <b>API Key</b> et votre{" "}
            <b>API Secret</b>, puis collez-les ci-dessous.
          </li>
        </ol>

        <form action={formAction}>
          <div className="field">
            <label htmlFor="cloudName">Cloud name</label>
            <input
              id="cloudName"
              name="cloudName"
              className="input"
              placeholder="mycloud123"
              defaultValue={status.cloudName ?? ""}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="apiKey">API Key</label>
            <input
              id="apiKey"
              name="apiKey"
              className="input"
              placeholder="123456789012345"
              defaultValue={status.apiKey ?? ""}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="apiSecret">API Secret</label>
            <input
              id="apiSecret"
              name="apiSecret"
              className="input"
              type="password"
              placeholder={
                status.configured ? "•••••••• (inchangé si laissé vide)" : "••••••••"
              }
              required={!status.configured}
            />
          </div>
          <div className="field">
            <label htmlFor="folder">Dossier (optionnel)</label>
            <input
              id="folder"
              name="folder"
              className="input"
              placeholder="vault"
              defaultValue={status.folder ?? "vault"}
            />
          </div>

          {state.error && <p className="form-error">{state.error}</p>}

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button
              className="btn-primary"
              type="submit"
              disabled={pending}
              style={{ width: "auto", padding: "14px 28px" }}
            >
              {pending
                ? "Vérification…"
                : status.configured
                  ? "Mettre à jour"
                  : "Connecter Cloudinary"}
            </button>
            {status.configured && (
              <button
                type="button"
                className="btn-ghost-border"
                onClick={onRemove}
                disabled={removing}
              >
                Déconnecter
              </button>
            )}
          </div>
        </form>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

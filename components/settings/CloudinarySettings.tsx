"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveCloudinaryConfig,
  removeCloudinaryConfig,
  type SaveResult,
} from "@/lib/cloudinary-actions";
import type { CloudinaryStatus } from "@/lib/cloudinary-store";
import Toast, { useToast } from "@/components/Toast";

export default function CloudinarySettings({
  status,
}: {
  status: CloudinaryStatus;
}) {
  const router = useRouter();
  const { toast, show } = useToast();
  const [state, formAction, pending] = useActionState<SaveResult, FormData>(
    saveCloudinaryConfig,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      show("Cloudinary connecté ✓");
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

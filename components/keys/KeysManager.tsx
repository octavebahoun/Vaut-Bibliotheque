"use client";

import { useMemo, useState } from "react";
import {
  createProject,
  deleteProject,
  deleteSecret,
  importEnv,
  upsertSecret,
  type ProjectView,
  type SecretView,
} from "@/lib/keys/actions";
import Toast, { useToast } from "@/components/Toast";

function envLine(key: string, value: string): string {
  const needsQuote = /[\s#"'`$\\]/.test(value) || value === "";
  if (!needsQuote) return `${key}=${value}`;
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${key}="${escaped}"`;
}

function buildEnv(secrets: SecretView[]): string {
  return secrets.map((s) => envLine(s.key, s.value)).join("\n");
}

export default function KeysManager({
  initialProjects,
}: {
  initialProjects: ProjectView[];
}) {
  const [projects, setProjects] = useState<ProjectView[]>(initialProjects);
  const [activeId, setActiveId] = useState<string | null>(
    initialProjects[0]?.id ?? null,
  );
  const [newProject, setNewProject] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const active = useMemo(
    () => projects.find((p) => p.id === activeId) ?? null,
    [projects, activeId],
  );

  function patchProject(id: string, secrets: SecretView[]) {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, secrets } : p)));
  }

  async function onCreateProject() {
    const name = newProject.trim();
    if (!name) return;
    setBusy(true);
    try {
      const p = await createProject(name);
      setProjects((ps) => [...ps, p]);
      setActiveId(p.id);
      setNewProject("");
      show("Projet créé");
    } catch (e) {
      show(e instanceof Error ? e.message : "Erreur", true);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteProject(p: ProjectView) {
    if (!confirm(`Supprimer le projet « ${p.name} » et tous ses secrets ?`))
      return;
    try {
      await deleteProject(p.id);
      setProjects((ps) => ps.filter((x) => x.id !== p.id));
      if (activeId === p.id) setActiveId(null);
      show("Projet supprimé");
    } catch {
      show("Erreur de suppression", true);
    }
  }

  async function onAddSecret() {
    if (!active) return;
    setBusy(true);
    try {
      const s = await upsertSecret(active.id, newKey, newValue);
      const next = [...active.secrets.filter((x) => x.key !== s.key), s].sort(
        (a, b) => a.key.localeCompare(b.key),
      );
      patchProject(active.id, next);
      setNewKey("");
      setNewValue("");
      show("Variable ajoutée");
    } catch (e) {
      show(e instanceof Error ? e.message : "Erreur", true);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(s: SecretView, key: string, value: string) {
    if (!active) return;
    try {
      const updated = await upsertSecret(active.id, key, value, s.id);
      const next = active.secrets
        .map((x) => (x.id === s.id ? updated : x))
        .sort((a, b) => a.key.localeCompare(b.key));
      patchProject(active.id, next);
      setEditing((e) => ({ ...e, [s.id]: false }));
      show("Variable mise à jour");
    } catch (e) {
      show(e instanceof Error ? e.message : "Erreur", true);
    }
  }

  async function onDeleteSecret(s: SecretView) {
    if (!active) return;
    patchProject(
      active.id,
      active.secrets.filter((x) => x.id !== s.id),
    );
    try {
      await deleteSecret(active.id, s.id);
    } catch {
      show("Erreur de suppression", true);
    }
  }

  async function copyEnv(btn: HTMLButtonElement) {
    if (!active) return;
    await navigator.clipboard
      .writeText(buildEnv(active.secrets))
      .catch(() => {});
    const orig = btn.textContent;
    btn.textContent = "Copié ✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove("copied");
    }, 1800);
    show(".env copié dans le presse-papiers");
  }

  function downloadEnv() {
    if (!active) return;
    const blob = new Blob([buildEnv(active.secrets) + "\n"], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    a.click();
    URL.revokeObjectURL(url);
    show(".env téléchargé");
  }

  async function onImport() {
    if (!active) return;
    setBusy(true);
    try {
      const count = await importEnv(active.id, importText);
      // recharge le projet actif localement en refaisant un getProjects serait plus simple,
      // mais on reconstruit à partir des lignes importées côté client :
      const parsed = parseEnvClient(importText);
      const merged = new Map(active.secrets.map((s) => [s.key, s]));
      for (const [k, v] of parsed) {
        const ex = merged.get(k);
        merged.set(k, {
          id: ex?.id ?? `tmp-${k}`,
          key: k,
          value: v,
        });
      }
      patchProject(
        active.id,
        [...merged.values()].sort((a, b) => a.key.localeCompare(b.key)),
      );
      setImportOpen(false);
      setImportText("");
      show(`${count} variable(s) importée(s)`);
    } catch (e) {
      show(e instanceof Error ? e.message : "Erreur d'import", true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="section-label">Clés de projet · .env</div>

      <div className="keys-layout">
        {/* Rail des projets */}
        <div>
          <div className="project-rail">
            {projects.map((p) => (
              <div
                key={p.id}
                className={`project-item ${p.id === activeId ? "active" : ""}`}
                onClick={() => setActiveId(p.id)}
              >
                <span>{p.name}</span>
                <span className="count">{p.secrets.length}</span>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="empty-sub" style={{ padding: "8px 0" }}>
                Aucun projet
              </p>
            )}
          </div>
          <div className="project-add">
            <input
              className="input"
              placeholder="Nouveau projet"
              value={newProject}
              onChange={(e) => setNewProject(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onCreateProject()}
            />
            <button
              className="btn-sm solid"
              onClick={onCreateProject}
              disabled={busy}
            >
              +
            </button>
          </div>
        </div>

        {/* Panneau du projet actif */}
        <div className="keys-panel">
          {!active ? (
            <div className="empty-state">
              <div className="empty-icon">⌘</div>
              <div className="empty-title">Aucun projet sélectionné</div>
              <p className="empty-sub">
                Créez un projet pour gérer ses variables d&apos;environnement
              </p>
            </div>
          ) : (
            <>
              <div className="keys-toolbar">
                <div className="serif" style={{ fontSize: 26 }}>
                  {active.name}
                </div>
                <div className="keys-actions">
                  <button
                    className="btn-sm solid"
                    onClick={(e) => copyEnv(e.currentTarget)}
                    disabled={active.secrets.length === 0}
                  >
                    Copier .env
                  </button>
                  <button
                    className="btn-sm"
                    onClick={downloadEnv}
                    disabled={active.secrets.length === 0}
                  >
                    Télécharger
                  </button>
                  <button
                    className="btn-sm"
                    onClick={() => setImportOpen(true)}
                  >
                    Importer
                  </button>
                  <button
                    className="btn-sm danger"
                    onClick={() => onDeleteProject(active)}
                  >
                    Supprimer projet
                  </button>
                </div>
              </div>

              <div className="secret-table">
                {active.secrets.map((s) => (
                  <SecretRow
                    key={s.id}
                    secret={s}
                    editing={!!editing[s.id]}
                    revealed={!!revealed[s.id]}
                    onToggleReveal={() =>
                      setRevealed((r) => ({ ...r, [s.id]: !r[s.id] }))
                    }
                    onEdit={() =>
                      setEditing((e) => ({ ...e, [s.id]: true }))
                    }
                    onCancel={() =>
                      setEditing((e) => ({ ...e, [s.id]: false }))
                    }
                    onSave={onSaveEdit}
                    onDelete={() => onDeleteSecret(s)}
                    onCopy={() => {
                      navigator.clipboard.writeText(s.value).catch(() => {});
                      show("Valeur copiée");
                    }}
                  />
                ))}
                {active.secrets.length === 0 && (
                  <p className="empty-sub" style={{ padding: "16px 0" }}>
                    Aucune variable pour l&apos;instant
                  </p>
                )}
              </div>

              {/* Ajout d'une variable */}
              <div className="secret-form">
                <div className="field">
                  <label>Nom</label>
                  <input
                    className="input"
                    placeholder="DATABASE_URL"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Valeur</label>
                  <input
                    className="input"
                    placeholder="postgres://…"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onAddSecret()}
                  />
                </div>
                <button
                  className="btn-sm solid"
                  onClick={onAddSecret}
                  disabled={busy || !newKey.trim()}
                >
                  Ajouter
                </button>
              </div>

              {/* Aperçu .env */}
              {active.secrets.length > 0 && (
                <div className="env-preview">
                  <span className="c"># {active.name}/.env</span>
                  {"\n"}
                  {buildEnv(active.secrets)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal import */}
      {importOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setImportOpen(false)}
        >
          <div className="modal-box">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Importer un .env
            </div>
            <div className="serif" style={{ fontSize: 26, marginBottom: 18 }}>
              Coller le contenu
            </div>
            <textarea
              placeholder={"KEY=value\nAUTRE_CLE=autre valeur"}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="modal-footer">
              <button
                className="btn-sm"
                style={{ flex: 1 }}
                onClick={() => setImportOpen(false)}
              >
                Annuler
              </button>
              <button
                className="btn-sm solid"
                style={{ flex: 2 }}
                onClick={onImport}
                disabled={busy || !importText.trim()}
              >
                Importer
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}

// Petit parseur .env côté client pour l'aperçu optimiste après import.
function parseEnvClient(raw: string): [string, string][] {
  const out: [string, string][] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim().replace(/^export\s+/, "");
    let value = t.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) out.push([key, value]);
  }
  return out;
}

// ── Ligne de secret (avec édition inline) ────────────────────
function SecretRow({
  secret,
  editing,
  revealed,
  onToggleReveal,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onCopy,
}: {
  secret: SecretView;
  editing: boolean;
  revealed: boolean;
  onToggleReveal: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (s: SecretView, key: string, value: string) => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const [key, setKey] = useState(secret.key);
  const [value, setValue] = useState(secret.value);

  if (editing) {
    return (
      <div className="secret-row">
        <input className="input" value={key} onChange={(e) => setKey(e.target.value)} />
        <input
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="row-actions">
          <button className="icon-btn" onClick={() => onSave(secret, key, value)}>
            OK
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              setKey(secret.key);
              setValue(secret.value);
              onCancel();
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="secret-row">
      <span className="k">{secret.key}</span>
      <span className="v">
        {revealed ? secret.value : "•".repeat(Math.min(secret.value.length, 24))}
      </span>
      <div className="row-actions">
        <button className="icon-btn" onClick={onToggleReveal}>
          {revealed ? "Cacher" : "Voir"}
        </button>
        <button className="icon-btn" onClick={onCopy}>
          Copier
        </button>
        <button className="icon-btn" onClick={onEdit}>
          Éditer
        </button>
        <button className="icon-btn danger" onClick={onDelete}>
          Suppr.
        </button>
      </div>
    </div>
  );
}

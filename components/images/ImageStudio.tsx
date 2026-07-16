"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { Image } from "@/lib/db/schema";
import {
  saveImage,
  deleteImageAction,
  toggleShareAction,
  importFromCloudinary,
} from "@/lib/images/actions";
import Toast, { useToast } from "@/components/Toast";
import Lightbox from "@/components/Lightbox";

type Props = { initialImages: Image[]; configured: boolean };

const COMPRESSIBLE = ["image/jpeg", "image/png", "image/webp"];

function formatSize(b: number) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

type QueueItem = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "compress" | "upload" | "done" | "error";
  note?: string;
};

export default function ImageStudio({ initialImages, configured }: Props) {
  const [images, setImages] = useState<Image[]>(initialImages);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [query, setQuery] = useState("");
  const [dragover, setDragover] = useState(false);
  const [collection, setCollection] = useState(""); // dossier cible pour l'upload
  const [filterFolder, setFilterFolder] = useState<string | null>(null); // null = tous
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const collectionRef = useRef(""); // évite les closures périmées dans uploadOne
  const { toast, show } = useToast();

  const patchItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const uploadOne = useCallback(
    async (file: File) => {
      const qid = crypto.randomUUID();
      setQueue((q) => [
        {
          id: qid,
          name: file.name,
          size: file.size,
          progress: 0,
          status: "compress",
        },
        ...q,
      ]);

      // 1) Compression côté client (raster uniquement — on préserve SVG/GIF)
      let toUpload: File | Blob = file;
      if (COMPRESSIBLE.includes(file.type)) {
        try {
          const { default: imageCompression } = await import(
            "browser-image-compression"
          );
          toUpload = await imageCompression(file, {
            maxSizeMB: 1.5,
            maxWidthOrHeight: 2400,
            useWebWorker: true,
            initialQuality: 0.82,
          });
        } catch {
          toUpload = file; // en cas d'échec, on envoie l'original
        }
      }

      // 2) Signature serveur (avec le dossier cible)
      patchItem(qid, { status: "upload" });
      let sign;
      try {
        const res = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collection: collectionRef.current }),
        });
        if (!res.ok) throw new Error("Signature refusée");
        sign = await res.json();
      } catch {
        patchItem(qid, { status: "error", note: "Config" });
        show("Cloudinary non configuré côté serveur", true);
        return;
      }

      // 3) Upload signé direct vers Cloudinary
      const fd = new FormData();
      fd.append("file", toUpload);
      fd.append("api_key", sign.apiKey);
      fd.append("timestamp", String(sign.timestamp));
      fd.append("folder", sign.folder);
      fd.append("signature", sign.signature);

      const data = await new Promise<Record<string, unknown> | null>(
        (resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              patchItem(qid, {
                progress: Math.round((e.loaded / e.total) * 100),
              });
            }
          };
          xhr.onload = () =>
            resolve(
              xhr.status === 200 ? JSON.parse(xhr.responseText) : null,
            );
          xhr.onerror = () => resolve(null);
          xhr.open(
            "POST",
            `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
          );
          xhr.send(fd);
        },
      );

      if (!data || !data.secure_url) {
        patchItem(qid, { status: "error", note: "Échec" });
        show(`Échec de l'upload de ${file.name}`, true);
        return;
      }

      // 4) Persistance en base
      try {
        const saved = await saveImage({
          publicId: String(data.public_id),
          url: String(data.secure_url),
          name: file.name,
          size: Number(data.bytes ?? 0),
          width: data.width ? Number(data.width) : undefined,
          height: data.height ? Number(data.height) : undefined,
          format: data.format ? String(data.format) : undefined,
          folder: sign.collection || undefined,
        });
        setImages((imgs) => [saved, ...imgs]);
        patchItem(qid, { status: "done", progress: 100 });
        show(`${file.name} ajoutée`);
        setTimeout(
          () => setQueue((q) => q.filter((it) => it.id !== qid)),
          3000,
        );
      } catch {
        patchItem(qid, { status: "error", note: "DB" });
        show("Erreur d'enregistrement", true);
      }
    },
    [patchItem, show],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .forEach((f) => void uploadOne(f));
    },
    [uploadOne],
  );

  async function onDelete(img: Image) {
    if (!confirm(`Supprimer « ${img.name} » ? Action définitive.`)) return;
    setImages((imgs) => imgs.filter((i) => i.id !== img.id));
    try {
      await deleteImageAction(img.id);
      show("Image supprimée");
    } catch {
      show("Erreur lors de la suppression", true);
    }
  }

  async function onImport() {
    setImporting(true);
    try {
      const res = await importFromCloudinary();
      if (res.error) {
        show(res.error, true);
        return;
      }
      if (res.imported.length > 0) {
        setImages((imgs) => {
          const seen = new Set(imgs.map((i) => i.id));
          const merged = [...res.imported.filter((i) => !seen.has(i.id)), ...imgs];
          return merged.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });
        show(
          `${res.imported.length} image(s) importée(s)` +
            (res.skipped ? ` · ${res.skipped} déjà présentes` : ""),
        );
      } else {
        show(
          res.scanned === 0
            ? "Aucune image trouvée sur votre compte Cloudinary"
            : "Rien de nouveau à importer",
        );
      }
    } catch {
      show("Erreur pendant l'import", true);
    } finally {
      setImporting(false);
    }
  }

  async function onShare(img: Image) {
    try {
      const { shareToken } = await toggleShareAction(img.id);
      setImages((imgs) =>
        imgs.map((i) => (i.id === img.id ? { ...i, shareToken } : i)),
      );
      if (shareToken) {
        const url = `${window.location.origin}/s/${shareToken}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        show("Lien de partage copié");
      } else {
        show("Partage désactivé");
      }
    } catch {
      show("Erreur de partage", true);
    }
  }

  async function copyDirect(url: string, btn: HTMLButtonElement) {
    await navigator.clipboard.writeText(url).catch(() => {});
    const orig = btn.textContent;
    btn.textContent = "Copié ✓";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove("copied");
    }, 1800);
    show("Lien copié");
  }

  const q = query.toLowerCase();
  const folders = Array.from(
    new Set(images.map((i) => i.folder).filter((f): f is string => !!f)),
  ).sort((a, b) => a.localeCompare(b));
  const hasRoot = images.some((i) => !i.folder);
  const list = images.filter((i) => {
    const matchQ =
      i.name.toLowerCase().includes(q) ||
      i.publicId.toLowerCase().includes(q);
    const matchF =
      filterFolder === null
        ? true
        : filterFolder === ""
          ? !i.folder
          : i.folder === filterFolder;
    return matchQ && matchF;
  });
  const totalSize = images.reduce((s, i) => s + (i.size || 0), 0);

  return (
    <>
      {/* Upload */}
      <div className="container" style={{ paddingBottom: 0 }}>
        <div className="section-label">Upload</div>

        {!configured && (
          <div className="notice">
            <span>
              Aucun compte Cloudinary connecté — les uploads ne fonctionneront
              pas tant que vous n&apos;avez pas branché le vôtre.
            </span>
            <Link className="btn-sm" href="/settings">
              Configurer
            </Link>
          </div>
        )}

        <div className="folder-picker">
          <label htmlFor="collection">Dossier cible</label>
          <input
            id="collection"
            className="input"
            list="folder-list"
            placeholder="racine (laisser vide)"
            value={collection}
            onChange={(e) => {
              setCollection(e.target.value);
              collectionRef.current = e.target.value;
            }}
          />
          <datalist id="folder-list">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <span className="folder-hint">
            Les nouvelles images iront dans ce dossier Cloudinary.
          </span>
        </div>

        <div
          className={`drop-zone ${dragover ? "dragover" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragover(true);
          }}
          onDragLeave={() => setDragover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragover(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <div className="drop-icon">+</div>
          <div className="drop-text">Déposez vos images ici</div>
          <div className="drop-sub">
            compression automatique · JPG PNG GIF WebP SVG
          </div>
        </div>

        {queue.length > 0 && (
          <div className="upload-queue">
            {queue.map((it) => (
              <div className="upload-item" key={it.id}>
                <span className="fname">{it.name}</span>
                <span className="fsize">{formatSize(it.size)}</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width:
                        it.status === "done"
                          ? "100%"
                          : `${it.progress}%`,
                    }}
                  />
                </div>
                <span className={`upload-status ${it.status === "done" ? "done" : it.status === "error" ? "error" : ""}`}>
                  {it.status === "compress"
                    ? "Compression…"
                    : it.status === "upload"
                      ? `${it.progress}%`
                      : it.status === "done"
                        ? "✓"
                        : (it.note ?? "Erreur")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="divider" style={{ marginTop: 40 }} />

      {/* Galerie */}
      <div className="container">
        <div className="gallery-header">
          <div>
            <div className="section-label" style={{ marginBottom: 4 }}>
              Bibliothèque
            </div>
            <div className="stat-chip">
              <b>{images.length}</b> images ·{" "}
              <b>{totalSize ? formatSize(totalSize) : "—"}</b>
            </div>
          </div>
          <div className="gallery-actions">
            {configured && (
              <button
                className="btn-sm"
                onClick={onImport}
                disabled={importing}
                title="Récupérer les images déjà présentes sur votre compte Cloudinary"
              >
                {importing ? "Import…" : "Importer depuis Cloudinary"}
              </button>
            )}
            <div className="search-wrap">
              <input
                type="text"
                placeholder="Rechercher"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {(folders.length > 0 || hasRoot) && (
          <div className="folder-filter">
            <button
              className={`folder-chip ${filterFolder === null ? "active" : ""}`}
              onClick={() => setFilterFolder(null)}
            >
              Tous
            </button>
            {hasRoot && (
              <button
                className={`folder-chip ${filterFolder === "" ? "active" : ""}`}
                onClick={() => setFilterFolder("")}
              >
                Racine
              </button>
            )}
            {folders.map((f) => (
              <button
                key={f}
                className={`folder-chip ${filterFolder === f ? "active" : ""}`}
                onClick={() => setFilterFolder(f)}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◻</div>
            <div className="empty-title">
              {images.length === 0 ? "Aucune image" : "Aucun résultat"}
            </div>
            <p className="empty-sub">
              {images.length === 0
                ? "Uploadez vos premières images ci-dessus"
                : "Essayez un autre terme de recherche"}
            </p>
          </div>
        ) : (
          <div className="gallery-grid">
            {list.map((img, i) => (
              <div
                className="img-card"
                key={img.id}
                onClick={() => setLightboxIndex(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} loading="lazy" />
                {img.shareToken && <span className="badge-shared">Partagée</span>}
                {img.folder && <span className="badge-folder">{img.folder}</span>}
                <div
                  className="img-overlay"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    className="img-name-label"
                    onClick={() => setLightboxIndex(i)}
                    style={{ cursor: "zoom-in" }}
                  >
                    {img.name}
                  </span>
                  <button
                    className="btn-chip"
                    onClick={(e) => copyDirect(img.url, e.currentTarget)}
                  >
                    Copier le lien
                  </button>
                  <button
                    className="btn-outline-light"
                    onClick={() => onShare(img)}
                  >
                    {img.shareToken ? "Rendre privé" : "Partager"}
                  </button>
                  <button
                    className="btn-outline-light"
                    onClick={() => onDelete(img)}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Lightbox
        items={list.map((i) => ({ url: i.url, name: i.name }))}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndex={setLightboxIndex}
      />

      <Toast toast={toast} />
    </>
  );
}

"use client";

import { useCallback, useEffect } from "react";

export type LightboxItem = { url: string; name: string };

export default function Lightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: LightboxItem[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const open = index !== null && index >= 0 && index < items.length;

  const go = useCallback(
    (dir: -1 | 1) => {
      if (index === null) return;
      const next = (index + dir + items.length) % items.length;
      onIndex(next);
    },
    [index, items.length, onIndex],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, onClose]);

  if (!open || index === null) return null;
  const item = items[index];

  return (
    <div
      className="lb-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button className="lb-close" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
      {items.length > 1 && (
        <button
          className="lb-nav prev"
          onClick={() => go(-1)}
          aria-label="Précédent"
        >
          ‹
        </button>
      )}
      <figure className="lb-figure">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.name} />
        <figcaption className="lb-caption">
          <span className="lb-name">{item.name}</span>
          <span className="lb-actions">
            <button
              className="lb-btn"
              onClick={() => {
                navigator.clipboard.writeText(item.url).catch(() => {});
              }}
            >
              Copier le lien
            </button>
            <a
              className="lb-btn"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir
            </a>
            {items.length > 1 && (
              <span className="lb-count">
                {index + 1} / {items.length}
              </span>
            )}
          </span>
        </figcaption>
      </figure>
      {items.length > 1 && (
        <button
          className="lb-nav next"
          onClick={() => go(1)}
          aria-label="Suivant"
        >
          ›
        </button>
      )}
    </div>
  );
}

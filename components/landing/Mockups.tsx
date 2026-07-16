// Maquettes produit purement présentationnelles (aucun asset externe).

export function WindowBar({ label }: { label?: string }) {
  return (
    <div className="mock-bar">
      <span className="mock-dot" />
      <span className="mock-dot" />
      <span className="mock-dot" />
      {label && <span className="mock-url">{label}</span>}
    </div>
  );
}

export function GalleryMock() {
  const tiles = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
  return (
    <div className="mock-window mock-gallery">
      <WindowBar label="vault.app / images" />
      <div className="mock-app-head">
        <span className="mock-logo">Vault</span>
        <div className="mock-nav">
          <span className="on">Images</span>
          <span>Clés</span>
          <span>Réglages</span>
        </div>
        <span className="mock-search">⌕ Rechercher</span>
      </div>
      <div className="mock-grid">
        {tiles.map((t, i) => (
          <div key={t} className={`mock-tile ${t}`}>
            {i === 1 && <span className="mock-badge">Partagée</span>}
            {i === 4 && <span className="mock-badge">Partagée</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EnvMock() {
  return (
    <div className="mock-window mock-env">
      <WindowBar label="vault.app / clés" />
      <div className="mock-env-head">
        <span className="serif" style={{ fontSize: 18 }}>
          checkout-service
        </span>
        <span className="mock-chip">Copier .env ✓</span>
      </div>
      <pre className="mock-code">
        <span className="c"># checkout-service/.env</span>
        {"\n"}
        <span className="k">DATABASE_URL</span>=
        <span className="v">&quot;postgres://…neon.tech/db&quot;</span>
        {"\n"}
        <span className="k">STRIPE_SECRET_KEY</span>=
        <span className="v">&quot;sk_live_51H…&quot;</span>
        {"\n"}
        <span className="k">JWT_SECRET</span>=
        <span className="v">&quot;b3Ry…Zm9v&quot;</span>
        {"\n"}
        <span className="k">CLOUDINARY_URL</span>=
        <span className="v">&quot;cloudinary://…&quot;</span>
      </pre>
    </div>
  );
}

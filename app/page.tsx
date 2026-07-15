import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const user = await getCurrentUser();

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="logo">
          Vault <span>/ saas</span>
        </div>
        <nav className="landing-nav">
          {user ? (
            <Link className="btn-ghost-border" href="/images">
              Ouvrir l&apos;app
            </Link>
          ) : (
            <>
              <Link className="nav-link" href="/login">
                Connexion
              </Link>
              <Link className="btn-ghost-border" href="/register">
                Commencer
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="eyebrow">Bibliothèque d&apos;images · Coffre à secrets</div>
        <h1 className="hero-title">
          Vos images et vos <em>clés de projet</em>,
          <br />
          au même endroit.
        </h1>
        <p className="hero-sub">
          Uploadez, compressez et partagez vos images. Gérez les variables
          d&apos;environnement de chaque projet et copiez le <code>.env</code>{" "}
          complet en un clic. Chiffré, privé, prêt pour la production.
        </p>
        <div className="hero-cta">
          <Link className="btn-primary" href="/register" style={{ width: "auto", padding: "15px 34px" }}>
            Créer un compte gratuit
          </Link>
          <Link className="btn-ghost" href="/login">
            J&apos;ai déjà un compte →
          </Link>
        </div>
        <p className="hero-note">
          Gratuit — vous branchez votre propre Cloudinary (~25 Go offerts).
        </p>
      </section>

      {/* FEATURES */}
      <section className="features">
        <article className="feature">
          <div className="feature-mark">◈</div>
          <h3>Images optimisées</h3>
          <p>
            Compression automatique avant l&apos;envoi, upload signé vers votre
            compte Cloudinary, galerie rapide et recherche instantanée.
          </p>
        </article>
        <article className="feature">
          <div className="feature-mark">↗</div>
          <h3>Partage par lien</h3>
          <p>
            Un lien public par image, révocable à tout moment. Pratique pour
            partager un visuel sans donner accès à votre bibliothèque.
          </p>
        </article>
        <article className="feature">
          <div className="feature-mark">⌘</div>
          <h3>Coffre à .env</h3>
          <p>
            Regroupez vos secrets par projet, chiffrés au repos (AES-256).
            Copiez ou téléchargez le <code>.env</code> complet en un clic.
          </p>
        </article>
      </section>

      {/* HOW */}
      <section className="how">
        <div className="section-label" style={{ textAlign: "center" }}>
          Comment ça marche
        </div>
        <div className="how-grid">
          <div className="how-step">
            <span className="how-num">01</span>
            <p>Créez votre compte en quelques secondes.</p>
          </div>
          <div className="how-step">
            <span className="how-num">02</span>
            <p>Branchez votre compte Cloudinary — on vous guide pas à pas.</p>
          </div>
          <div className="how-step">
            <span className="how-num">03</span>
            <p>Uploadez vos images et centralisez vos clés de projet.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-band">
        <h2 className="serif">Prêt à ranger votre atelier ?</h2>
        <Link className="btn-primary" href="/register" style={{ width: "auto", padding: "15px 34px" }}>
          Commencer gratuitement
        </Link>
      </section>

      <footer className="landing-footer">
        <span>Vault</span>
        <span>Chiffré · Privé · Open-source friendly</span>
      </footer>
    </div>
  );
}

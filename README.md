# Vault

Bibliothèque d'images privée **+** gestionnaire de clés de projet (`.env`).
Next.js (App Router) · Neon Postgres · Drizzle · Cloudinary · déployé sur Vercel.

## Fonctionnalités

- 🔐 **Auth custom** — inscription / connexion par e-mail + mot de passe (hash argon2id,
  session par cookie HTTP-only, token haché en base).
- 🖼️ **Images** — chaque utilisateur branche **son propre** compte Cloudinary
  (setup guidé dans l'app, API secret chiffré). Upload **signé**, **compression
  automatique** côté client, galerie servie par la base, **suppression réelle**
  (Cloudinary + DB), **partage par lien public** (`/s/<token>`).
- 🔑 **Clés / .env** — projets regroupant des variables d'environnement, **chiffrées au repos**
  (AES-256-GCM), **copie / téléchargement du `.env` complet en un clic**, import d'un `.env` collé.

## Prérequis

- Node 20+
- Un projet **Neon** (Postgres) — https://console.neon.tech

> Cloudinary n'est **pas** requis au niveau du serveur : chaque utilisateur
> connecte son propre compte gratuit depuis la page **Réglages** de l'app
> (~25 Go offerts par le plan gratuit Cloudinary).

## Configuration locale

```bash
cp .env.example .env.local
# puis remplis les valeurs (voir ci-dessous)
npm install
```

### Variables d'environnement

| Variable | Description |
|---|---|
| `DATABASE_URL` | Chaîne de connexion Neon (`?sslmode=require`) |
| `SECRETS_ENCRYPTION_KEY` | Clé AES-256 en base64 (**exactement 32 octets**) : `openssl rand -base64 32`. Chiffre les secrets `.env` **et** les API secrets Cloudinary des utilisateurs. |

> ⚠️ Ne change jamais `SECRETS_ENCRYPTION_KEY` après avoir stocké des secrets :
> les valeurs chiffrées deviendraient indéchiffrables.

### Base de données

Applique les migrations sur Neon :

```bash
npm run db:migrate      # applique drizzle/*.sql
# ou, en dev rapide :
npm run db:push
```

### Lancer en local

```bash
npm run dev             # http://localhost:3000
```

## Déploiement Vercel

1. Importe le repo dans Vercel.
2. Ajoute les variables d'environnement ci-dessus (Settings → Environment Variables).
3. Déploie. Applique les migrations une fois (`npm run db:migrate` en local pointant sur Neon,
   ou via un job).

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run db:generate` | Génère une migration depuis le schéma |
| `npm run db:migrate` | Applique les migrations |
| `npm run db:studio` | Explorateur Drizzle |

## Architecture

```
app/
  page.tsx                        → landing SaaS (publique)
  (auth)/login, (auth)/register   → pages d'authentification
  (app)/images                    → studio d'images (protégé)
  (app)/keys                      → gestionnaire .env (protégé)
  (app)/settings                  → connexion du compte Cloudinary (protégé)
  s/[token]                       → page de partage publique
  api/upload/sign                 → signature d'upload (creds de l'utilisateur)
lib/
  db/                 → client Neon + schéma Drizzle
  auth/               → hash, sessions, server actions
  images/             → server actions images
  keys/               → server actions secrets (chiffrés)
  crypto.ts           → AES-256-GCM (secrets .env + secrets Cloudinary)
  cloudinary.ts       → signature / suppression / ping (API REST)
  cloudinary-store.ts → lecture des creds (server-only, secret déchiffré)
  cloudinary-actions.ts → connexion / déconnexion du compte Cloudinary
components/            → UI (client)
```

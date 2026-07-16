"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, register, type AuthState } from "@/lib/auth/actions";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const action = mode === "login" ? login : register;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );

  const isLogin = mode === "login";

  return (
    <div className="auth-screen">
      <div className="auth-wrap">
        <div className="eyebrow">Vault — Bibliothèque privée</div>
        <h1 className="auth-title">
          {isLogin ? (
            <>
              Bon retour
              <br />
              <em>par ici</em>
            </>
          ) : (
            <>
              Créer un
              <br />
              <em>compte</em>
            </>
          )}
        </h1>
        <p className="auth-sub">
          {isLogin
            ? "Accès restreint — connectez-vous"
            : "Rejoignez votre espace privé"}
        </p>

        <form action={formAction}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder="••••••••"
              required
              minLength={isLogin ? undefined : 8}
            />
          </div>

          <button className="btn-primary" type="submit" disabled={pending}>
            {pending
              ? "Un instant…"
              : isLogin
                ? "Se connecter"
                : "Créer le compte"}
          </button>

          <p className="form-error">{state.error ?? ""}</p>
        </form>

        <p className="auth-switch">
          {isLogin ? (
            <>
              Pas encore de compte ? <Link href="/register">Créer un compte</Link>
            </>
          ) : (
            <>
              Déjà inscrit ? <Link href="/login">Se connecter</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

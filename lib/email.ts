import "server-only";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function fromAddress(): string {
  // En test, Resend n'autorise que le domaine onboarding@resend.dev
  // (envoi vers ta propre adresse uniquement). Vérifie un domaine pour la prod.
  return process.env.EMAIL_FROM || "Vault <onboarding@resend.dev>";
}

type SendResult = { sent: boolean; error?: string };

export async function sendInviteEmail(params: {
  to: string;
  code: string;
  url: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false };

  const { to, code, url } = params;
  const html = inviteHtml({ code, url });

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [to],
        subject: "Votre invitation à rejoindre Vault",
        html,
      }),
    });
    if (!res.ok) {
      return { sent: false, error: await res.text() };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "erreur" };
  }
}

function inviteHtml({ code, url }: { code: string; url: string }): string {
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f8f8f7;padding:40px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e2e5ea">
      <tr><td style="padding:40px 44px">
        <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#94a3b8;margin-bottom:14px">Vault — Bibliothèque privée</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#1a1a1e;margin-bottom:14px">Vous êtes invité·e</div>
        <p style="font-size:14px;line-height:1.7;color:#2d2d33;margin:0 0 24px">
          Quelqu'un vous invite à créer un compte sur Vault. Cliquez ci-dessous pour vous inscrire — votre code est déjà pré-rempli.
        </p>
        <a href="${url}" style="display:inline-block;background:#1a1a1e;color:#fff;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;padding:14px 28px">Créer mon compte</a>
        <p style="font-size:12px;color:#94a3b8;margin:26px 0 6px">Ou entrez ce code manuellement à l'inscription :</p>
        <div style="font-family:'SFMono-Regular',Menlo,monospace;font-size:16px;letter-spacing:1px;color:#1a1a1e;background:#f0f1f3;padding:12px 16px;text-align:center">${code}</div>
      </td></tr>
    </table>
    <div style="font-size:11px;color:#94a3b8;margin-top:20px">Si vous n'attendiez pas cette invitation, ignorez cet e-mail.</div>
  </td></tr></table>
</body></html>`;
}

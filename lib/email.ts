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

export async function sendShareEmail(params: {
  to: string;
  ownerEmail: string;
  url: string;
  hasAccount: boolean;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false };

  const html = shareHtml(params);

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [params.to],
        subject: `${params.ownerEmail} a partagé sa bibliothèque Vault avec vous`,
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

function shareHtml({
  ownerEmail,
  url,
  hasAccount,
}: {
  ownerEmail: string;
  url: string;
  hasAccount: boolean;
}): string {
  const cta = hasAccount ? "Voir la bibliothèque partagée" : "Créer un compte";
  const body = hasAccount
    ? `<b>${ownerEmail}</b> vous donne accès aux images partageables de sa bibliothèque Vault. Retrouvez-les dans « Partagé avec moi ».`
    : `<b>${ownerEmail}</b> souhaite partager les images de sa bibliothèque Vault avec vous. Créez un compte avec <b>cette adresse e-mail</b> pour y accéder.`;
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f8f8f7;padding:40px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e2e5ea">
      <tr><td style="padding:40px 44px">
        <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#94a3b8;margin-bottom:14px">Vault — Partage de bibliothèque</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:#1a1a1e;margin-bottom:14px">Une bibliothèque partagée</div>
        <p style="font-size:14px;line-height:1.7;color:#2d2d33;margin:0 0 24px">${body}</p>
        <a href="${url}" style="display:inline-block;background:#1a1a1e;color:#fff;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;padding:14px 28px">${cta}</a>
      </td></tr>
    </table>
    <div style="font-size:11px;color:#94a3b8;margin-top:20px">Si vous n'attendiez pas ce partage, ignorez cet e-mail.</div>
  </td></tr></table>
</body></html>`;
}

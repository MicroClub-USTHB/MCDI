interface MemberPayload {
  id: string;
  username: string;
  globalName?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  email?: string | null;
}

type RolePayload = Record<string, unknown>;

/** Escape a string for safe use in an HTML attribute value. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build an auto-submitting HTML form (POST binding) that delivers the session
 * token and member payload to the platform's redirect URI via HTTP POST body.
 *
 * This keeps the token out of URLs, browser history, server logs, and
 * referrer headers — the same pattern used by SAML SSO.
 */
export function buildSuccessPost(
  redirectUri: string,
  token: string,
  expiresAt: Date,
  member: MemberPayload,
  roles: RolePayload[],
): { html: string } {
  const fields: Record<string, string> = {
    token,
    expires_at: expiresAt.toISOString(),
    member: JSON.stringify(member),
    roles: JSON.stringify(roles),
  };

  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join('\n    ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Completing login...</title>
</head>
<body>
  <form id="cb" method="POST" action="${escapeHtml(redirectUri)}">
    ${inputs}
  </form>
  <script>document.getElementById('cb').submit();</script>
  <noscript>
    <p>JavaScript is required to complete login.
      <button type="submit" form="cb">Continue</button>
    </p>
  </noscript>
</body>
</html>`;

  return { html };
}

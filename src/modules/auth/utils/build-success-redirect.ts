interface MemberPayload {
  id: string;
  username: string;
  globalName?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  email?: string | null;
}

type RolePayload = Record<string, unknown>;

/**
 * Step 9 — Build the final redirect URL sent back to the platform after a
 * successful Discord OAuth login.
 *
 * Encodes the session token, expiry, member profile, and roles as query
 * parameters on the platform's redirect URI.
 */
export function buildSuccessRedirect(
  redirectUri: string,
  token: string,
  expiresAt: Date,
  member: MemberPayload,
  roles: RolePayload[],
): { url: string } {
  const url = new URL(redirectUri);
  url.searchParams.set('token', token);
  url.searchParams.set('expires_at', expiresAt.toISOString());
  url.searchParams.set('member', JSON.stringify(member));
  url.searchParams.set('roles', JSON.stringify(roles));
  return { url: url.toString() };
}

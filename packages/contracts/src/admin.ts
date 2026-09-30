/** Body of `GET /api/admin/profile` — the signed-in system admin. */
export interface AdminProfile {
  id: string;
  username: string;
  globalName: string | null;
  displayName: string | null;
  preferredName: string | null;
  avatar: string | null;
  email: string | null;
  isSystemAdmin: boolean;
}

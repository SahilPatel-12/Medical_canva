/** One signed-up account, as returned by GET /api/users */
export interface AdminUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  /** How they sign in: "email", "google", … */
  providers: string[];
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  bannedUntil: string | null;
  status: "active" | "unverified" | "banned";
  workspaces: AdminUserWorkspace[];
  /** Designs in workspaces this user owns */
  designCount: number;
}

export interface AdminUserWorkspace {
  id: string;
  name: string;
  type: "personal" | "team";
  role: "owner" | "admin" | "editor" | "viewer";
  designCount: number;
}

export interface UsersResponse {
  success: boolean;
  data?: AdminUser[];
  error?: string;
  /** "service_key_missing" | "unauthorized" | "default_secret_in_production" */
  code?: string;
}

/**
 * Auth user roles
 */
export type AuthRole = "user" | "admin" | "super-admin";

/**
 * Basic authentication session interface
 */
export interface AuthSession {
  userId: string;
  email: string;
  role: AuthRole;
  expiresAt: number;
}

/**
 * Basic tokens contract
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

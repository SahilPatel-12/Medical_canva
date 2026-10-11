import type { User, Session, AuthError } from "@supabase/supabase-js";
import type { UserProfile, WorkspaceWithRole } from "@design-platform/types";

export type { User as SupabaseUser, Session as SupabaseSession, AuthError as SupabaseAuthError };

export interface AuthUser {
  id: string;
  email?: string;
  userMetadata?: Record<string, unknown>;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthResult<T = unknown> {
  data?: T;
  error?: {
    message: string;
    status?: number;
  };
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  currentWorkspace: WorkspaceWithRole | null;
  workspaces: WorkspaceWithRole[];
  isLoading: boolean;
  signIn: (input: SignInInput) => Promise<AuthResult<Session>>;
  signUp: (input: SignUpInput) => Promise<AuthResult<{ user: User | null; session: Session | null }>>;
  signOut: () => Promise<AuthResult<void>>;
  refreshProfile: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
}

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { UserProfile, WorkspaceWithRole, WorkspaceRole } from "@design-platform/types";
import {
  getBrowserSupabaseClient,
  getTabId,
  signInWithPassword,
  signUpWithPassword,
  signOut as clientSignOut,
} from "./client";
import type { AuthContextValue, SignInInput, SignUpInput, AuthResult } from "./types";

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null;
  initialUser?: User | null;
  initialProfile?: UserProfile | null;
  initialWorkspace?: WorkspaceWithRole | null;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  initialSession = null,
  initialUser = null,
  initialProfile = null,
  initialWorkspace = null,
}) => {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [user, setUser] = useState<User | null>(initialUser || initialSession?.user || null);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [workspaces, setWorkspaces] = useState<WorkspaceWithRole[]>(
    initialWorkspace ? [initialWorkspace] : []
  );
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceWithRole | null>(initialWorkspace);
  const [isLoading, setIsLoading] = useState<boolean>(!initialUser && !initialSession);

  // Helper to fetch or create user profile in public.profiles table
  const fetchProfile = useCallback(async (currentUser: User): Promise<UserProfile | null> => {
    try {
      const client = getBrowserSupabaseClient();
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          displayName: data.display_name,
          avatarUrl: data.avatar_url,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }

      // If profile does not exist yet (e.g. trigger has not executed), provision it
      const fallbackName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.display_name ||
        (currentUser.email ? currentUser.email.split("@")[0] : "User");

      const { data: created, error: insertError } = await client
        .from("profiles")
        .insert({
          id: currentUser.id,
          display_name: fallbackName,
          avatar_url: currentUser.user_metadata?.avatar_url || null,
        })
        .select()
        .maybeSingle();

      if (created && !insertError) {
        return {
          id: created.id,
          displayName: created.display_name,
          avatarUrl: created.avatar_url,
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        };
      }

      return {
        id: currentUser.id,
        displayName: fallbackName,
        avatarUrl: null,
      };
    } catch {
      return null;
    }
  }, []);

  // Determines the active workspace for the current tab, respecting tab-isolated storage
  const resolveActiveWorkspace = useCallback((wsList: WorkspaceWithRole[]): WorkspaceWithRole | null => {
    if (wsList.length === 0) return null;
    if (typeof window !== "undefined" && window.sessionStorage) {
      const tabStoredId = window.sessionStorage.getItem(`dp_active_workspace_${getTabId()}`);
      if (tabStoredId) {
        const found = wsList.find((w) => w.id === tabStoredId);
        if (found) return found;
      }
    }
    const personal = wsList.find((w) => w.type === "personal");
    return personal || wsList[0] || null;
  }, []);

  // Retrieves all workspaces the user is a member of (personal + team)
  const fetchWorkspaces = useCallback(async (currentUser: User): Promise<WorkspaceWithRole[]> => {
    try {
      const client = getBrowserSupabaseClient();
      const { data: members, error } = await client
        .from("workspace_members")
        .select(`
          role,
          workspaces:workspace_id (
            id,
            name,
            slug,
            type,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq("user_id", currentUser.id);

      const list: WorkspaceWithRole[] = [];
      if (!error && members && members.length > 0) {
        for (const item of members as Array<{ role: string; workspaces: unknown }>) {
          const ws = item.workspaces as {
            id: string;
            name: string;
            slug: string | null;
            type: "personal" | "team";
            created_by: string;
            created_at: string;
            updated_at: string;
          } | null;
          if (ws) {
            list.push({
              id: ws.id,
              name: ws.name,
              slug: ws.slug,
              type: ws.type,
              createdBy: ws.created_by,
              createdAt: ws.created_at,
              updatedAt: ws.updated_at,
              role: item.role as WorkspaceRole,
            });
          }
        }
      }

      if (list.length > 0) {
        return list;
      }

      // If no workspace yet, trigger RPC to provision personal workspace
      const defaultName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.display_name ||
        (currentUser.email ? currentUser.email.split("@")[0] : "Personal") + "'s Workspace";

      const { data: wsId, error: rpcError } = await client.rpc("provision_personal_workspace", {
        target_user_id: currentUser.id,
        workspace_name: defaultName,
      });

      if (wsId && !rpcError) {
        const { data: wsData } = await client
          .from("workspaces")
          .select("*")
          .eq("id", wsId)
          .maybeSingle();

        if (wsData) {
          return [
            {
              id: wsData.id,
              name: wsData.name,
              slug: wsData.slug,
              type: wsData.type,
              createdBy: wsData.created_by,
              createdAt: wsData.created_at,
              updatedAt: wsData.updated_at,
              role: "owner",
            },
          ];
        }
      }

      return [];
    } catch {
      return [];
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const prof = await fetchProfile(user);
    if (prof) setProfile(prof);
  }, [user, fetchProfile]);

  const refreshWorkspace = useCallback(async () => {
    if (!user) {
      setCurrentWorkspace(null);
      setWorkspaces([]);
      return;
    }
    const wsList = await fetchWorkspaces(user);
    setWorkspaces(wsList);
    const active = resolveActiveWorkspace(wsList);
    setCurrentWorkspace(active);
  }, [user, fetchWorkspaces, resolveActiveWorkspace]);

  const switchWorkspace = useCallback(
    async (workspaceId: string) => {
      const target = workspaces.find((w) => w.id === workspaceId);
      if (target) {
        setCurrentWorkspace(target);
        if (typeof window !== "undefined" && window.sessionStorage) {
          window.sessionStorage.setItem(`dp_active_workspace_${getTabId()}`, workspaceId);
        }
      }
    },
    [workspaces]
  );

  // Synchronize session and onAuthStateChange
  useEffect(() => {
    let isMounted = true;
    const client = getBrowserSupabaseClient();

    async function initAuth() {
      try {
        const { data } = await client.auth.getSession();
        if (!isMounted) return;

        const currentSession = data.session;
        setSession(currentSession);
        const currentUser = currentSession?.user || null;
        setUser(currentUser);

        if (currentUser) {
          const [prof, wsList] = await Promise.all([
            fetchProfile(currentUser),
            fetchWorkspaces(currentUser),
          ]);
          if (isMounted) {
            setProfile(prof);
            setWorkspaces(wsList);
            setCurrentWorkspace(resolveActiveWorkspace(wsList));
          }
        } else {
          if (isMounted) {
            setProfile(null);
            setWorkspaces([]);
            setCurrentWorkspace(null);
          }
        }
      } catch (err) {
        console.warn("[AuthProvider] Session initialization warning:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initAuth();

    // Subscribe to Supabase auth events
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      const currentUser = newSession?.user || null;
      setUser(currentUser);

      if (currentUser) {
        const [prof, wsList] = await Promise.all([
          fetchProfile(currentUser),
          fetchWorkspaces(currentUser),
        ]);
        if (isMounted) {
          setProfile(prof);
          setWorkspaces(wsList);
          setCurrentWorkspace(resolveActiveWorkspace(wsList));
        }
      } else {
        if (isMounted) {
          setProfile(null);
          setWorkspaces([]);
          setCurrentWorkspace(null);
        }
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchWorkspaces, resolveActiveWorkspace]);

  const signIn = useCallback(
    async (input: SignInInput): Promise<AuthResult<Session>> => {
      setIsLoading(true);
      const res = await signInWithPassword(input);
      if (res.data) {
        setSession(res.data);
        setUser(res.data.user);
        const [prof, wsList] = await Promise.all([
          fetchProfile(res.data.user),
          fetchWorkspaces(res.data.user),
        ]);
        setProfile(prof);
        setWorkspaces(wsList);
        setCurrentWorkspace(resolveActiveWorkspace(wsList));
      }
      setIsLoading(false);
      return res;
    },
    [fetchProfile, fetchWorkspaces, resolveActiveWorkspace]
  );

  const signUp = useCallback(
    async (input: SignUpInput): Promise<AuthResult<{ user: User | null; session: Session | null }>> => {
      setIsLoading(true);
      const res = await signUpWithPassword(input);
      if (res.data?.session) {
        setSession(res.data.session);
        setUser(res.data.user);
        if (res.data.user) {
          const [prof, wsList] = await Promise.all([
            fetchProfile(res.data.user),
            fetchWorkspaces(res.data.user),
          ]);
          setProfile(prof);
          setWorkspaces(wsList);
          setCurrentWorkspace(resolveActiveWorkspace(wsList));
        }
      }
      setIsLoading(false);
      return res;
    },
    [fetchProfile, fetchWorkspaces, resolveActiveWorkspace]
  );

  const signOut = useCallback(async (): Promise<AuthResult<void>> => {
    setIsLoading(true);
    const res = await clientSignOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setWorkspaces([]);
    setCurrentWorkspace(null);
    setIsLoading(false);
    return res;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      workspaces,
      currentWorkspace,
      isLoading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      refreshWorkspace,
      switchWorkspace,
    }),
    [
      user,
      session,
      profile,
      workspaces,
      currentWorkspace,
      isLoading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      refreshWorkspace,
      switchWorkspace,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

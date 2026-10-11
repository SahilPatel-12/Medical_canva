"use client";

import { useEffect, useState, useRef } from "react";
import { EditorStore, DocumentChangeAction } from "@design-platform/editor";
import { CollaboratorInfo } from "@design-platform/types";
import { getBrowserSupabaseClient } from "@design-platform/auth";
import type { RealtimeChannel } from "@design-platform/database";


export type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "disconnected";

export interface UseDesignCollaborationOptions {
  designId: string;
  store: EditorStore;
  currentUser?: {
    id?: string;
    email?: string;
    displayName?: string;
  } | null;
  isReadOnly?: boolean;
  shareToken?: string;
  onPermissionRevoked?: (reason: string) => void;
}

export interface UseDesignCollaborationResult {
  collaborators: CollaboratorInfo[];
  connectionStatus: ConnectionStatus;
  hasEditPermission: boolean;
  permissionWarning: string | null;
}

const COLLABORATOR_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Violet
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
];

function getRandomColor(): string {
  return COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)] || "#3b82f6";
}

export function useDesignCollaboration({
  designId,
  store,
  currentUser,
  isReadOnly = false,
  onPermissionRevoked,
}: UseDesignCollaborationOptions): UseDesignCollaborationResult {
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [hasEditPermission, setHasEditPermission] = useState<boolean>(!isReadOnly);
  const [permissionWarning, setPermissionWarning] = useState<string | null>(null);

  const clientIdRef = useRef<string>(
    typeof window !== "undefined"
      ? `client_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
      : "client_ssr"
  );
  const colorRef = useRef<string>(getRandomColor());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef<boolean>(false);

  useEffect(() => {
    setHasEditPermission(!isReadOnly);
  }, [isReadOnly]);

  useEffect(() => {
    if (!designId || typeof window === "undefined") return;

    let supabase;
    try {
      supabase = getBrowserSupabaseClient();
    } catch (err) {
      console.warn("[Collaboration] Could not get Supabase client:", err);
      setConnectionStatus("disconnected");
      return;
    }

    const clientId = clientIdRef.current;
    const clientColor = colorRef.current;
    const displayName =
      currentUser?.displayName ||
      (currentUser?.email ? currentUser.email.split("@")[0] : undefined) ||
      "Collaborator";

    // Create room-scoped Realtime channel
    const channel = supabase.channel(`design-room:${designId}`, {
      config: {
        presence: { key: clientId },
        broadcast: { self: false },
      },
    });

    channelRef.current = channel;

    // 1. Presence Sync
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const active: CollaboratorInfo[] = [];

      Object.entries(state).forEach(([key, presences]) => {
        if (key === clientId) return; // Skip self

        if (Array.isArray(presences)) {
          presences.forEach((p) => {
            if (!p || typeof p !== "object") return;
            const item = p as Record<string, unknown>;
            const name = typeof item.name === "string" ? item.name : undefined;
            if (name) {
              active.push({
                clientId: (typeof item.clientId === "string" ? item.clientId : key) || key,
                userId: (typeof item.userId === "string" ? item.userId : null),
                name,
                avatarUrl: typeof item.avatarUrl === "string" ? item.avatarUrl : null,
                color: (typeof item.color === "string" ? item.color : undefined) || "#3b82f6",
                selectedElementId: typeof item.selectedElementId === "string" ? item.selectedElementId : null,
                isEditing: Boolean(item.isEditing),
                lastActive: typeof item.lastActive === "number" ? item.lastActive : Date.now(),
              });
            }
          });
        }
      });

      // Deduplicate by clientId
      const uniqueMap = new Map<string, CollaboratorInfo>();
      active.forEach((c) => uniqueMap.set(c.clientId, c));
      setCollaborators(Array.from(uniqueMap.values()));
    });

    // 2. Broadcast Document Changes
    channel.on(
      "broadcast",
      { event: "design_change" },
      ({ payload }: { payload: { action: DocumentChangeAction; senderId: string } }) => {
        if (!payload || payload.senderId === clientId) return;

        const { action } = payload;
        if (!action) return;

        switch (action.type) {
          case "element_update":
            store.applyRemoteElementUpdate(
              action.elementId,
              action.updates,
              action.pageIndex,
              action.pageId
            );
            break;
          case "element_add":
            store.applyRemoteElementAdd(
              action.element,
              action.pageIndex,
              action.pageId
            );
            break;
          case "element_delete":
            store.applyRemoteElementDelete(
              action.elementId,
              action.pageIndex,
              action.pageId
            );
            break;
          case "background_color":
            store.applyRemoteBackgroundColor(action.color);
            break;
          case "dimensions":
            store.applyRemoteDimensions(action.width, action.height);
            break;
          case "pages_sync":
            store.applyRemotePagesSync(action.pages);
            break;
          case "page_add":
            store.applyRemotePageAdd(action.page);
            break;
          case "page_delete":
            store.applyRemotePageDelete(action.pageIndex);
            break;
        }
      }
    );

    // 3. Broadcast Permission Changes or Revocation
    channel.on(
      "broadcast",
      { event: "permission_changed" },
      ({ payload }: { payload: { permission: "view" | "edit"; isEnabled: boolean } }) => {
        if (!payload) return;
        if (!payload.isEnabled || payload.permission === "view") {
          setHasEditPermission(false);
          const reason = !payload.isEnabled
            ? "Link sharing has been disabled by the design owner."
            : "Editing access has been changed to view-only.";
          setPermissionWarning(reason);
          onPermissionRevoked?.(reason);
        }
      }
    );

    // 4. Subscribe and Track Presence
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        isSubscribedRef.current = true;
        setConnectionStatus("connected");
        channel.track({
          clientId,
          userId: currentUser?.id || null,
          name: displayName,
          color: clientColor,
          isEditing: !isReadOnly,
          lastActive: Date.now(),
        });
      } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
        isSubscribedRef.current = false;
        setConnectionStatus("reconnecting");
      } else if (status === "CLOSED") {
        isSubscribedRef.current = false;
        setConnectionStatus("disconnected");
      }
    });

    // 5. Subscribe to Local Store Changes to Broadcast Out
    const unsubscribeStore = store.onDocumentChange((action: DocumentChangeAction) => {
      if (isReadOnly || !hasEditPermission || !isSubscribedRef.current) return;

      try {
        const sendPromise = channel.send({
          type: "broadcast",
          event: "design_change",
          payload: {
            action,
            senderId: clientId,
            timestamp: Date.now(),
          },
        });

        if (sendPromise && typeof (sendPromise as Promise<unknown>).catch === "function") {
          (sendPromise as Promise<unknown>).catch((err: unknown) => {
            console.debug("[useDesignCollaboration] Realtime broadcast skipped:", err);
          });
        }
      } catch (err) {
        console.debug("[useDesignCollaboration] Realtime broadcast error:", err);
      }
    });

    return () => {
      isSubscribedRef.current = false;
      unsubscribeStore();
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [designId, store, currentUser, isReadOnly, hasEditPermission, onPermissionRevoked]);

  return {
    collaborators,
    connectionStatus,
    hasEditPermission,
    permissionWarning,
  };
}

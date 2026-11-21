"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Asset } from "@design-platform/types";

// ==========================================
// Shared admin state: the admin API key, toasts and the asset list
// (the sidebar counts and every asset page read the same list).
// ==========================================

export type ToastType = "success" | "error" | "warning";

interface AdminContextValue {
  adminKey: string;
  setAdminKey: (key: string) => void;
  /** Headers every admin API call sends */
  authHeaders: () => Record<string, string>;
  toast: { text: string; type: ToastType } | null;
  showToast: (text: string, type?: ToastType) => void;
  assets: Asset[];
  /** False until the first load finishes */
  assetsLoaded: boolean;
  /** Set when the last load failed */
  assetsError: string | null;
  reloadAssets: () => Promise<void>;
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

const KEY_STORAGE = "mc_admin_api_key";
const DEFAULT_KEY = "mc_admin_dev_secret_2026";
const KEY_EVENT = "mc-admin-key-change";

// The key lives in localStorage; read it as an external store (no effect, no hydration mismatch)
const subscribeKey = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  window.addEventListener(KEY_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(KEY_EVENT, onChange);
  };
};
const readKey = () => {
  try {
    return localStorage.getItem(KEY_STORAGE) || DEFAULT_KEY;
  } catch {
    return DEFAULT_KEY;
  }
};

async function fetchAssets(adminKey: string): Promise<{ data?: Asset[]; error?: string }> {
  try {
    const res = await fetch("/api/assets?status=all", { headers: { "x-admin-key": adminKey } });
    const json = await res.json();
    return json.success && Array.isArray(json.data) ? { data: json.data } : { error: json.error || "Failed to load assets" };
  } catch (err) {
    console.error("Failed to load assets:", err);
    return { error: "Could not load assets from the server" };
  }
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  // "" during server render and hydration: nothing is fetched until the stored key is known
  const adminKey = useSyncExternalStore(subscribeKey, readKey, () => "");
  const [toast, setToast] = useState<AdminContextValue["toast"]>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  const showToast = useCallback((text: string, type: ToastType = "success") => {
    setToast({ text, type });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }, []);

  const setAdminKey = useCallback((key: string) => {
    try {
      localStorage.setItem(KEY_STORAGE, key.trim());
    } catch {
      // Private mode: the key still applies to this page load through the event below
    }
    window.dispatchEvent(new Event(KEY_EVENT));
  }, []);

  const authHeaders = useCallback(() => ({ "x-admin-key": adminKey }), [adminKey]);

  const applyAssets = useCallback(
    (result: { data?: Asset[]; error?: string }) => {
      if (result.data) {
        setAssets(result.data);
        setAssetsError(null);
      } else {
        setAssetsError(result.error || "Failed to load assets");
        showToast(result.error || "Failed to load assets", "error");
      }
      setAssetsLoaded(true);
    },
    [showToast]
  );

  const reloadAssets = useCallback(async () => {
    applyAssets(await fetchAssets(adminKey));
  }, [adminKey, applyAssets]);

  // Load on start and whenever the key changes; a stale response never overwrites a newer one
  useEffect(() => {
    if (!adminKey) return;
    let current = true;
    void fetchAssets(adminKey).then((result) => current && applyAssets(result));
    return () => {
      current = false;
    };
  }, [adminKey, applyAssets]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const value = useMemo(
    () => ({ adminKey, setAdminKey, authHeaders, toast, showToast, assets, assetsLoaded, assetsError, reloadAssets, setAssets }),
    [adminKey, setAdminKey, authHeaders, toast, showToast, assets, assetsLoaded, assetsError, reloadAssets]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}

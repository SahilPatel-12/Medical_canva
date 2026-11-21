"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, AlertTriangle, Check, Images, Key, Menu, UploadCloud, Users, X } from "lucide-react";
import { ThemeToggle } from "@design-platform/ui";
import { AdminProvider, useAdmin } from "./AdminContext";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Highlight for sub-paths too (Upload lives under /assets, so Assets is exact) */
  exact?: boolean;
  count?: (ctx: ReturnType<typeof useAdmin>) => number | null;
}

const NAV: Array<{ section: string; items: NavItem[] }> = [
  {
    section: "Asset library",
    items: [
      {
        href: "/assets",
        label: "Assets",
        icon: <Images size={17} />,
        exact: true,
        count: (ctx) => (ctx.assetsLoaded ? ctx.assets.length : null),
      },
      { href: "/assets/upload", label: "Upload assets", icon: <UploadCloud size={17} /> },
    ],
  },
  {
    section: "People",
    items: [{ href: "/users", label: "Users", icon: <Users size={17} /> }],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <ShellFrame>{children}</ShellFrame>
    </AdminProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const admin = useAdmin();
  const [navOpen, setNavOpen] = useState(false);
  // The phone drawer closes when the page changes (state adjusted during render, not in an effect)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setNavOpen(false);
  }

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="shell" data-nav-open={navOpen}>
      <aside className="side" aria-label="Admin navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            MC
          </span>
          <div>
            <div className="brand-name">Medical Canva</div>
            <div className="brand-sub">Admin console</div>
          </div>
        </div>

        <nav>
          {NAV.map((group) => (
            <div key={group.section}>
              <div className="nav-label">{group.section}</div>
              {group.items.map((item) => {
                const count = item.count?.(admin) ?? null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-item"
                    aria-current={isActive(item) ? "page" : undefined}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {count !== null && <span className="nav-count">{count}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <AdminKeyBox />
          <div className="side-row">
            <span>Theme</span>
            <ThemeToggle size="sm" />
          </div>
        </div>
      </aside>

      <div className="side-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />

      <div className="main">
        <div className="mobile-bar">
          <button type="button" className="icon-btn" onClick={() => setNavOpen(true)} aria-label="Open navigation">
            <Menu size={20} />
          </button>
          <span className="brand-mark" aria-hidden="true" style={{ width: 28, height: 28, fontSize: 12 }}>
            MC
          </span>
          <span className="brand-name">Admin console</span>
        </div>
        {children}
      </div>

      {admin.toast && (
        <div className="toast" data-type={admin.toast.type} role="status">
          {admin.toast.type === "success" ? (
            <Check size={17} color="#10b981" />
          ) : admin.toast.type === "warning" ? (
            <AlertTriangle size={17} color="#f59e0b" />
          ) : (
            <AlertCircle size={17} color="#ef4444" />
          )}
          <span>{admin.toast.text}</span>
        </div>
      )}
    </div>
  );
}

/** The admin API key the browser sends with every admin request */
function AdminKeyBox() {
  const { adminKey, setAdminKey, showToast, reloadAssets } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const save = () => {
    if (!draft.trim()) return;
    setAdminKey(draft);
    setEditing(false);
    showToast("Admin key updated");
    void reloadAssets();
  };

  return (
    <div className="key-box">
      <div className="key-box-title">
        <Key size={13} />
        <span>Admin API key</span>
        {!editing && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto", height: 24, padding: "0 6px" }}
            onClick={() => {
              setDraft("");
              setEditing(true);
            }}
          >
            Change
          </button>
        )}
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          style={{ display: "flex", gap: 6 }}
        >
          <input
            className="input input-sm"
            type="password"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ADMIN_API_SECRET"
            aria-label="New admin API key"
          />
          <button type="submit" className="icon-btn" aria-label="Save key" disabled={!draft.trim()}>
            <Check size={15} />
          </button>
          <button type="button" className="icon-btn" aria-label="Cancel" onClick={() => setEditing(false)}>
            <X size={15} />
          </button>
        </form>
      ) : (
        <span className="mono dim">{"•".repeat(Math.min(12, adminKey.length))}{adminKey.slice(-4)}</span>
      )}
    </div>
  );
}

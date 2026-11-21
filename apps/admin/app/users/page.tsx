"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  KeyRound,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAdmin } from "../_components/AdminContext";
import type { AdminUser, UsersResponse } from "./types";

type StatusFilter = "all" | AdminUser["status"];
type SortKey = "newest" | "oldest" | "recent" | "name";

const PAGE_SIZE = 25;
const DAY = 24 * 60 * 60 * 1000;

const STATUS_TONE: Record<AdminUser["status"], string> = {
  active: "tone-success",
  unverified: "tone-warning",
  banned: "tone-danger",
};

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function relative(iso: string | null, now: number): string {
  if (!iso) return "Never";
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  if (abs < 60_000) return "Just now";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  if (abs < 365 * DAY) return rtf.format(Math.round(diff / (30 * DAY)), "month");
  return rtf.format(Math.round(diff / (365 * DAY)), "year");
}
const fullDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

const providerLabel = (p: string) => (p === "email" ? "Email" : p.charAt(0).toUpperCase() + p.slice(1));

async function fetchUsers(headers: Record<string, string>): Promise<UsersResponse> {
  try {
    const res = await fetch("/api/users", { headers, cache: "no-store" });
    return (await res.json()) as UsersResponse;
  } catch (err) {
    return { success: false, error: (err as Error).message || "Network error" };
  }
}

export default function UsersPage() {
  const { adminKey, authHeaders } = useAdmin();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const apply = useCallback((result: UsersResponse) => {
    if (result.success && result.data) {
      setUsers(result.data);
      setError(null);
    } else {
      setError({ code: result.code, message: result.error || "Could not load users" });
    }
    setLoadedAt(Date.now());
  }, []);

  // Reloads when the admin key changes; a stale response never overwrites a newer one
  useEffect(() => {
    if (!adminKey) return; // still reading the stored key
    let current = true;
    void fetchUsers(authHeaders()).then((result) => current && apply(result));
    return () => {
      current = false;
    };
  }, [adminKey, authHeaders, apply]);

  const refresh = async () => {
    setRefreshing(true);
    apply(await fetchUsers(authHeaders()));
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    const list = users || [];
    return {
      total: list.length,
      newThisWeek: list.filter((u) => loadedAt - Date.parse(u.createdAt) < 7 * DAY).length,
      activeMonth: list.filter((u) => u.lastSignInAt && loadedAt - Date.parse(u.lastSignInAt) < 30 * DAY).length,
      unverified: list.filter((u) => u.status === "unverified").length,
      banned: list.filter((u) => u.status === "banned").length,
      active: list.filter((u) => u.status === "active").length,
    };
  }, [users, loadedAt]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (users || []).filter(
      (u) =>
        (status === "all" || u.status === status) &&
        (!q || u.name.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q) || u.id.startsWith(q))
    );
    const time = (iso: string | null) => (iso ? Date.parse(iso) : 0);
    return list.sort((a, b) =>
      sort === "newest"
        ? time(b.createdAt) - time(a.createdAt)
        : sort === "oldest"
          ? time(a.createdAt) - time(b.createdAt)
          : sort === "recent"
            ? time(b.lastSignInAt) - time(a.lastSignInAt)
            : a.name.localeCompare(b.name)
    );
  }, [users, query, status, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = visible.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const selected = users?.find((u) => u.id === selectedId) || null;

  const exportCsv = () => {
    // Leading = + - @ would run as a formula in a spreadsheet
    const cell = (v: string | number) => {
      const s = String(v);
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = [
      ["Name", "Email", "Status", "Joined", "Last sign-in", "Sign-in method", "Workspaces", "Designs", "User ID"],
      ...visible.map((u) => [
        u.name,
        u.email || "",
        u.status,
        u.createdAt,
        u.lastSignInAt || "",
        u.providers.map(providerLabel).join(" / "),
        u.workspaces.length,
        u.designCount,
        u.id,
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">Everyone who has signed up, with their workspaces and designs.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={refresh} disabled={refreshing || !loadedAt}>
            <RefreshCw size={15} className={refreshing ? "spin" : undefined} />
            Refresh
          </button>
          <button type="button" className="btn" onClick={exportCsv} disabled={!visible.length}>
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </header>

      {error && !users ? (
        <UsersError error={error} onRetry={refresh} retrying={refreshing} />
      ) : (
        <>
          <div className="stats">
            <Stat icon={<Users size={14} />} label="Total users" value={users ? stats.total : null} note="All accounts" />
            <Stat
              icon={<UserPlus size={14} />}
              label="New this week"
              value={users ? stats.newThisWeek : null}
              note="Signed up in the last 7 days"
            />
            <Stat
              icon={<UserCheck size={14} />}
              label="Active this month"
              value={users ? stats.activeMonth : null}
              note="Signed in within 30 days"
            />
            <Stat
              icon={<AlertCircle size={14} />}
              label="Unverified"
              value={users ? stats.unverified : null}
              note="Email not confirmed yet"
            />
          </div>

          {error && (
            <div className="banner">
              <div>
                <div className="banner-title">
                  <AlertCircle size={16} />
                  Couldn&rsquo;t refresh
                </div>
                <p>{error.message} Showing the last loaded list.</p>
              </div>
            </div>
          )}

          <div className="toolbar">
            <label className="search">
              <Search size={15} />
              <span className="sr-only">Search users</span>
              <input
                className="input"
                type="search"
                placeholder="Search by name or email…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <div className="segmented" role="group" aria-label="Filter by status">
              {(
                [
                  ["all", "All", stats.total],
                  ["active", "Active", stats.active],
                  ["unverified", "Unverified", stats.unverified],
                  ...(stats.banned ? [["banned", "Banned", stats.banned] as const] : []),
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={status === key}
                  onClick={() => {
                    setStatus(key);
                    setPage(0);
                  }}
                >
                  {label} <span className="dim">{users ? count : ""}</span>
                </button>
              ))}
            </div>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="recent">Recently active</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>

          <section className="card" aria-label="Users">
            {!users ? (
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }} aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="skeleton" style={{ height: 40 }} />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="empty">
                <span className="empty-icon">
                  <Users size={22} />
                </span>
                <h3>{users.length === 0 ? "No users yet" : "No users match"}</h3>
                <p>{users.length === 0 ? "People appear here once they sign up." : "Try another search or filter."}</p>
              </div>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">User</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="col-wide">
                          Sign-in
                        </th>
                        <th scope="col" className="num col-mid">
                          Workspaces
                        </th>
                        <th scope="col" className="num col-mid">
                          Designs
                        </th>
                        <th scope="col" className="col-mid">
                          Joined
                        </th>
                        <th scope="col">Last active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((u) => (
                        <tr
                          key={u.id}
                          aria-selected={u.id === selectedId}
                          tabIndex={0}
                          onClick={() => setSelectedId(u.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(u.id);
                            }
                          }}
                        >
                          <td>
                            <div className="user-cell">
                              <Avatar user={u} size={32} />
                              <div style={{ minWidth: 0 }}>
                                <div className="user-name">{u.name}</div>
                                <div className="user-email">{u.email || "No email"}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${STATUS_TONE[u.status]}`}>{u.status}</span>
                          </td>
                          <td className="col-wide muted">{u.providers.map(providerLabel).join(", ") || "—"}</td>
                          <td className="num col-mid">{u.workspaces.length}</td>
                          <td className="num col-mid">{u.designCount}</td>
                          <td className="col-mid muted" title={fullDate(u.createdAt)}>
                            {shortDate(u.createdAt)}
                          </td>
                          <td className="muted" title={fullDate(u.lastSignInAt)}>
                            {relative(u.lastSignInAt, loadedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-foot">
                  <span>
                    {safePage * PAGE_SIZE + 1}–{Math.min(visible.length, (safePage + 1) * PAGE_SIZE)} of {visible.length}
                  </span>
                  {pageCount > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setPage(safePage - 1)}
                        disabled={safePage === 0}
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>
                        Page {safePage + 1} of {pageCount}
                      </span>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setPage(safePage + 1)}
                        disabled={safePage >= pageCount - 1}
                        aria-label="Next page"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </>
      )}

      {selected && <UserDrawer user={selected} now={loadedAt} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: number | null; note: string }) {
  return (
    <div className="stat">
      <span className="stat-label">
        {icon}
        {label}
      </span>
      <span className="stat-value">{value === null ? "–" : value}</span>
      <span className="stat-note">{note}</span>
    </div>
  );
}

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#059669", "#0891b2", "#4f46e5", "#b45309"];

function Avatar({ user, size }: { user: AdminUser; size: number }) {
  const [broken, setBroken] = useState(false);
  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  let hash = 0;
  for (const ch of user.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}
      aria-hidden="true"
    >
      {user.avatarUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        initials
      )}
    </span>
  );
}

function UserDrawer({ user, now, onClose }: { user: AdminUser; now: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the ID stays selectable
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`User ${user.name}`}>
        <div className="drawer-head">
          <span className="card-title">User details</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" autoFocus>
            <X size={17} />
          </button>
        </div>
        <div className="drawer-body">
          <div className="profile-top">
            <Avatar user={user} size={56} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{user.name}</div>
              <div className="muted" style={{ overflowWrap: "anywhere" }}>
                {user.email || "No email"}
              </div>
              <span className={`badge ${STATUS_TONE[user.status]}`} style={{ marginTop: 6 }}>
                {user.status}
              </span>
            </div>
          </div>

          <dl className="dl">
            <dt>Joined</dt>
            <dd>
              {fullDate(user.createdAt)} <span className="dim">({relative(user.createdAt, now)})</span>
            </dd>
            <dt>Last sign-in</dt>
            <dd>
              {user.lastSignInAt ? (
                <>
                  {fullDate(user.lastSignInAt)} <span className="dim">({relative(user.lastSignInAt, now)})</span>
                </>
              ) : (
                "Never"
              )}
            </dd>
            <dt>Email verified</dt>
            <dd>{user.emailConfirmedAt ? fullDate(user.emailConfirmedAt) : <span style={{ color: "var(--warning)" }}>Not yet</span>}</dd>
            <dt>Sign-in method</dt>
            <dd>{user.providers.map(providerLabel).join(", ") || "—"}</dd>
            {user.bannedUntil && (
              <>
                <dt>Banned until</dt>
                <dd style={{ color: "var(--danger)" }}>{fullDate(user.bannedUntil)}</dd>
              </>
            )}
            <dt>User ID</dt>
            <dd style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className="mono">{user.id}</span>
              <button type="button" className="icon-btn" onClick={copyId} aria-label="Copy user ID" title="Copy user ID">
                {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
              </button>
            </dd>
          </dl>

          <div>
            <div className="section-title">
              Workspaces ({user.workspaces.length}) · {user.designCount} design{user.designCount === 1 ? "" : "s"} owned
            </div>
            {user.workspaces.length === 0 ? (
              <p className="muted">Not a member of any workspace.</p>
            ) : (
              <div className="ws-list">
                {user.workspaces.map((ws) => (
                  <div key={ws.id} className="ws-item">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ws.name}
                      </div>
                      <div className="dim" style={{ fontSize: 12 }}>
                        {ws.type === "personal" ? "Personal" : "Team"} · {ws.designCount} design{ws.designCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <span className={`badge ${ws.role === "owner" ? "tone-primary" : ""}`}>{ws.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function UsersError({
  error,
  onRetry,
  retrying,
}: {
  error: { code?: string; message: string };
  onRetry: () => void;
  retrying: boolean;
}) {
  if (error.code === "service_key_missing") {
    return (
      <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="empty-icon" style={{ margin: 0, width: 40, height: 40 }}>
            <KeyRound size={19} />
          </span>
          <div>
            <h2 className="card-title">Connect the user directory</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              Listing users needs Supabase&rsquo;s server-only secret key. It never reaches the browser.
            </p>
          </div>
        </div>
        <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, color: "var(--foreground-secondary)" }}>
          <li>
            In Supabase, open <strong>Project settings → API keys</strong> and copy the <strong>secret</strong> (service-role) key.
          </li>
          <li>
            Add <code className="mono">SUPABASE_SERVICE_ROLE_KEY=…</code> to <code className="mono">apps/admin/.env.local</code>, and to the
            admin project&rsquo;s environment variables on Vercel.
          </li>
          <li>Restart the admin server, then retry.</li>
        </ol>
        <div>
          <button type="button" className="btn" onClick={onRetry} disabled={retrying}>
            <RefreshCw size={15} className={retrying ? "spin" : undefined} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const keyProblem = error.code === "unauthorized" || error.code === "default_secret_in_production";
  return (
    <div className="card empty">
      <span className="empty-icon" style={{ color: "var(--danger)" }}>
        <AlertCircle size={22} />
      </span>
      <h3>{keyProblem ? "Admin key not accepted" : "Couldn’t load users"}</h3>
      <p style={{ maxWidth: 460 }}>
        {keyProblem ? `${error.message} Change the key in the sidebar and try again.` : error.message}
      </p>
      <button type="button" className="btn" style={{ marginTop: 8 }} onClick={onRetry} disabled={retrying}>
        <RefreshCw size={15} className={retrying ? "spin" : undefined} />
        Retry
      </button>
    </div>
  );
}

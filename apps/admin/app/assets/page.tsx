"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import type { Asset, AssetStatus } from "@design-platform/types";
import { CANONICAL_TAXONOMY, getCategoryBySlug } from "@design-platform/editor";
import { useAdmin } from "../_components/AdminContext";
import { Modal, StatusBadge, formatBytes } from "../_components/ui";

type StatusFilter = "all" | AssetStatus;

/** Cards rendered per step; the library holds well over a thousand assets */
const PAGE_STEP = 120;

const STATUS_CARDS: Array<{ key: StatusFilter; label: string; note: string; color: string }> = [
  { key: "all", label: "All assets", note: "Everything in storage", color: "var(--primary)" },
  { key: "published", label: "Published", note: "Visible in the editor", color: "#10b981" },
  { key: "draft", label: "Drafts", note: "Hidden from customers", color: "#f59e0b" },
  { key: "archived", label: "Archived", note: "Kept for existing designs", color: "#8b5cf6" },
];

/** Delete flow: confirm first; if designs use the asset, offer archiving instead */
type DeleteDialog =
  | { kind: "confirm"; asset: Asset }
  | { kind: "conflict"; asset: Asset; designCount: number; designNames: string[] };

export default function AssetLibraryPage() {
  const { assets, assetsLoaded, assetsError, reloadAssets, setAssets, authHeaders, showToast } = useAdmin();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [categorySlug, setCategorySlug] = useState("all");
  const [subcategorySlug, setSubcategorySlug] = useState("all");
  const [query, setQuery] = useState("");
  const [shownCount, setShownCount] = useState(PAGE_STEP);

  const [isSeeding, setIsSeeding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialog | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<Asset | null>(null);

  const category = categorySlug === "all" ? null : getCategoryBySlug(categorySlug);

  const counts = useMemo(() => {
    const c = { all: assets.length, published: 0, draft: 0, archived: 0 };
    for (const a of assets) c[a.status || "published"]++;
    return c;
  }, [assets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (status !== "all" && (a.status || "published") !== status) return false;
      if (
        categorySlug !== "all" &&
        a.categorySlug !== categorySlug &&
        a.category?.toLowerCase() !== categorySlug.toLowerCase() &&
        !a.tags?.includes(`cat:${categorySlug}`)
      )
        return false;
      if (
        subcategorySlug !== "all" &&
        a.subcategorySlug !== subcategorySlug &&
        a.subcategoryId !== subcategorySlug &&
        !a.tags?.includes(`subcat:${subcategorySlug}`)
      )
        return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.tags?.some((t) => t.toLowerCase().includes(q)) ||
        a.category?.toLowerCase().includes(q) ||
        a.subcategoryName?.toLowerCase().includes(q)
      );
    });
  }, [assets, status, categorySlug, subcategorySlug, query]);

  // Any filter change starts the grid from the top again (adjusted during render, not in an effect)
  const filterKey = `${status}|${categorySlug}|${subcategorySlug}|${query}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setShownCount(PAGE_STEP);
  }
  const shown = filtered.slice(0, shownCount);

  const hasFilters = status !== "all" || categorySlug !== "all" || query.trim() !== "";
  const clearFilters = () => {
    setStatus("all");
    setCategorySlug("all");
    setSubcategorySlug("all");
    setQuery("");
  };

  const refresh = async () => {
    setIsRefreshing(true);
    await reloadAssets();
    setIsRefreshing(false);
  };

  const copyUrl = async (asset: Asset) => {
    if (!asset.url) return;
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopiedId(asset.id);
      showToast("Public URL copied");
      window.setTimeout(() => setCopiedId((id) => (id === asset.id ? null : id)), 2000);
    } catch {
      showToast("Could not copy to the clipboard", "error");
    }
  };

  const setAssetStatus = async (asset: Asset, next: AssetStatus) => {
    setBusyId(asset.id);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || `Could not set status to ${next}`);
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, status: next } : a)));
      showToast(`“${asset.name}” is now ${next}`, next === "published" ? "success" : "warning");
    } catch (err) {
      showToast((err as Error).message || "Error updating asset status", "error");
    } finally {
      setBusyId(null);
    }
  };

  const deleteAsset = async (asset: Asset, force = false) => {
    setBusyId(asset.id);
    try {
      const res = await fetch(`/api/assets/${asset.id}${force ? "?force=true" : ""}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (res.status === 409 && json.referenced) {
        setDeleteDialog({
          kind: "conflict",
          asset,
          designCount: json.designCount || 1,
          designNames: json.designNames || [],
        });
        return;
      }
      if (!json.success) throw new Error(json.error || "Failed to delete asset");
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setDeleteDialog(null);
      showToast(`“${asset.name}” deleted`);
    } catch (err) {
      showToast((err as Error).message || "Delete failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const seedBuiltin = async () => {
    if (!confirm("Upload the built-in scientific illustrations (DNA, cells, flask, microscope, virus…) to storage and register them?")) return;
    setIsSeeding(true);
    try {
      const res = await fetch("/api/assets/seed", { method: "POST", headers: authHeaders() });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Sync failed");
      showToast(json.message || "Built-in assets synced");
      await reloadAssets();
    } catch (err) {
      showToast((err as Error).message || "Failed to sync built-in assets", "error");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Assets</h1>
          <p className="page-sub">Scientific illustrations and images customers can add to their designs.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={refresh} disabled={isRefreshing} title="Reload the list">
            <RefreshCw size={15} className={isRefreshing ? "spin" : undefined} />
            <span>Refresh</span>
          </button>
          <button type="button" className="btn" onClick={seedBuiltin} disabled={isSeeding}>
            <RefreshCw size={15} className={isSeeding ? "spin" : undefined} />
            <span>{isSeeding ? "Syncing…" : "Sync built-in"}</span>
          </button>
          <Link href="/assets/upload" className="btn btn-primary">
            <UploadCloud size={16} />
            <span>Upload assets</span>
          </Link>
        </div>
      </header>

      {/* Status cards double as the status filter */}
      <div className="stats">
        {STATUS_CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            className="stat"
            aria-pressed={status === card.key}
            onClick={() => setStatus(card.key)}
          >
            <span className="stat-label">
              <span className="dot" style={{ background: card.color }} />
              {card.label}
            </span>
            <span className="stat-value">{assetsLoaded ? counts[card.key] : "–"}</span>
            <span className="stat-note">{card.note}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={15} />
          <span className="sr-only">Search assets</span>
          <input
            className="input"
            type="search"
            placeholder="Search by name, tag or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          className="select"
          value={categorySlug}
          onChange={(e) => {
            setCategorySlug(e.target.value);
            setSubcategorySlug("all");
          }}
          aria-label="Category"
        >
          <option value="all">All categories</option>
          {CANONICAL_TAXONOMY.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        {category && (
          <select
            className="select"
            value={subcategorySlug}
            onChange={(e) => setSubcategorySlug(e.target.value)}
            aria-label="Subcategory"
          >
            <option value="all">All subcategories</option>
            {category.subcategories.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        {hasFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
          {assetsLoaded ? `${filtered.length} of ${assets.length} shown` : "Loading…"}
        </span>
      </div>

      {!assetsLoaded ? (
        <div className="asset-grid" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 236 }} />
          ))}
        </div>
      ) : assetsError && assets.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon" style={{ color: "var(--danger)" }}>
            <AlertTriangle size={22} />
          </span>
          <h3>Couldn&rsquo;t load the library</h3>
          <p>{assetsError}</p>
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={refresh} disabled={isRefreshing}>
            <RefreshCw size={15} className={isRefreshing ? "spin" : undefined} />
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon">
            <ImageIcon size={22} />
          </span>
          <h3>{assets.length === 0 ? "No assets yet" : "No assets match these filters"}</h3>
          <p>{assets.length === 0 ? "Upload your first illustrations to fill the editor's library." : "Try another search or category."}</p>
          {assets.length === 0 ? (
            <Link href="/assets/upload" className="btn btn-primary" style={{ marginTop: 8 }}>
              <UploadCloud size={16} />
              <span>Upload assets</span>
            </Link>
          ) : (
            <button type="button" className="btn" style={{ marginTop: 8 }} onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="asset-grid">
          {shown.map((asset) => {
            const assetStatus = asset.status || "published";
            const busy = busyId === asset.id;
            return (
              <article key={asset.id} className="asset">
                <div className="asset-preview">
                  <StatusBadge status={assetStatus} />
                  <span className="asset-version">v{asset.version || 1}</span>
                  {asset.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt="" loading="lazy" />
                  ) : (
                    <ImageIcon size={36} className="dim" />
                  )}
                </div>
                <div className="asset-body">
                  <h3 className="asset-name" title={asset.name}>
                    {asset.name}
                  </h3>
                  <div className="asset-meta">
                    <span title={asset.category}>{asset.subcategoryName || asset.category || "Uncategorised"}</span>
                    <span>{formatBytes(asset.sizeBytes)}</span>
                  </div>
                </div>
                <div className="asset-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    data-tone={copiedId === asset.id ? "success" : undefined}
                    onClick={() => copyUrl(asset)}
                    disabled={!asset.url}
                    title="Copy public URL"
                    aria-label={`Copy URL of ${asset.name}`}
                  >
                    {copiedId === asset.id ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setReplaceTarget(asset)}
                    disabled={busy}
                    title="Replace file (keeps the ID, bumps the version)"
                    aria-label={`Replace ${asset.name}`}
                  >
                    <Upload size={15} />
                  </button>
                  {assetStatus === "archived" ? (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setAssetStatus(asset, "published")}
                      disabled={busy}
                      title="Restore to published"
                      aria-label={`Restore ${asset.name}`}
                    >
                      <ArchiveRestore size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setAssetStatus(asset, "archived")}
                      disabled={busy}
                      title="Archive (hide from customers, keep existing designs working)"
                      aria-label={`Archive ${asset.name}`}
                    >
                      <Archive size={15} />
                    </button>
                  )}
                  {assetStatus === "draft" && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setAssetStatus(asset, "published")}
                      disabled={busy}
                      title="Make visible in the editor"
                    >
                      Publish
                    </button>
                  )}
                  <span className="spacer" />
                  <button
                    type="button"
                    className="icon-btn"
                    data-tone="danger"
                    onClick={() => setDeleteDialog({ kind: "confirm", asset })}
                    disabled={busy}
                    title="Delete permanently"
                    aria-label={`Delete ${asset.name}`}
                  >
                    {busy ? <RefreshCw size={15} className="spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {assetsLoaded && filtered.length > shown.length && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button type="button" className="btn" onClick={() => setShownCount((n) => n + PAGE_STEP)}>
            Show {Math.min(PAGE_STEP, filtered.length - shown.length)} more
            <span className="dim">· {filtered.length - shown.length} left</span>
          </button>
        </div>
      )}

      {deleteDialog?.kind === "confirm" && (
        <Modal
          title="Delete asset?"
          icon={<Trash2 size={18} color="var(--danger)" />}
          onClose={() => setDeleteDialog(null)}
          busy={busyId === deleteDialog.asset.id}
        >
          <p className="muted">
            <strong style={{ color: "var(--foreground)" }}>{deleteDialog.asset.name}</strong> will be removed from
            storage and the library. This can&rsquo;t be undone. Archiving hides it from customers but keeps it
            recoverable.
          </p>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={() => setDeleteDialog(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const a = deleteDialog.asset;
                setDeleteDialog(null);
                void setAssetStatus(a, "archived");
              }}
            >
              <Archive size={15} />
              Archive instead
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busyId === deleteDialog.asset.id}
              onClick={() => deleteAsset(deleteDialog.asset)}
            >
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        </Modal>
      )}

      {deleteDialog?.kind === "conflict" && (
        <Modal
          title="This asset is in use"
          icon={<AlertTriangle size={18} color="var(--warning)" />}
          onClose={() => setDeleteDialog(null)}
          busy={busyId === deleteDialog.asset.id}
        >
          <p className="muted">
            <strong style={{ color: "var(--foreground)" }}>{deleteDialog.asset.name}</strong> appears in{" "}
            {deleteDialog.designCount} design{deleteDialog.designCount === 1 ? "" : "s"}
            {deleteDialog.designNames.length > 0 && <>: {deleteDialog.designNames.join(", ")}</>}. Deleting it would
            leave a broken image in {deleteDialog.designCount === 1 ? "that design" : "those designs"}.
          </p>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={() => setDeleteDialog(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busyId === deleteDialog.asset.id}
              onClick={() => deleteAsset(deleteDialog.asset, true)}
            >
              Delete anyway
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const a = deleteDialog.asset;
                setDeleteDialog(null);
                void setAssetStatus(a, "archived");
              }}
            >
              <Archive size={15} />
              Archive (safe)
            </button>
          </div>
        </Modal>
      )}

      {replaceTarget && (
        <ReplaceAssetModal
          asset={replaceTarget}
          onClose={() => setReplaceTarget(null)}
          onReplaced={async () => {
            setReplaceTarget(null);
            await reloadAssets();
          }}
        />
      )}
    </div>
  );
}

function ReplaceAssetModal({
  asset,
  onClose,
  onReplaced,
}: {
  asset: Asset;
  onClose: () => void;
  onReplaced: () => Promise<void>;
}) {
  const { authHeaders, showToast } = useAdmin();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const version = asset.version || 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/assets/${asset.id}`, { method: "PUT", headers: authHeaders(), body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to replace asset");
      showToast(json.message || `“${asset.name}” replaced (v${version + 1})`);
      await onReplaced();
    } catch (err) {
      showToast((err as Error).message || "Replacement failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Replace file" icon={<Upload size={18} color="var(--primary)" />} onClose={onClose} busy={busy}>
      <div className="card card-pad" style={{ padding: 12 }}>
        <div style={{ fontWeight: 600 }}>{asset.name}</div>
        <div className="mono dim">
          {asset.id} · v{version}
        </div>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        The asset keeps its ID, so designs using it pick up the new file. The version becomes{" "}
        <strong style={{ color: "var(--foreground)" }}>v{version + 1}</strong>.
      </p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <button type="button" className="dropzone" style={{ padding: 24 }} onClick={() => inputRef.current?.click()}>
          <Upload size={22} color="var(--primary)" />
          <strong style={{ fontSize: 14 }}>{file ? file.name : "Choose the new file"}</strong>
          <span className="field-hint">SVG, PNG, JPEG or WebP, up to 25 MB</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".svg,.png,.jpg,.jpeg,.webp"
          hidden
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !file}>
            {busy ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}
            {busy ? "Replacing…" : "Replace file"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

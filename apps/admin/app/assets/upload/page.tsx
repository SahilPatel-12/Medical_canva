"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Check, FileUp, Image as ImageIcon, RefreshCw, RotateCcw, UploadCloud, X } from "lucide-react";
import type { Asset, AssetStatus } from "@design-platform/types";
import { CANONICAL_TAXONOMY, getCategoryBySlug } from "@design-platform/editor";
import { useAdmin } from "../../_components/AdminContext";
import { formatBytes } from "../../_components/ui";

interface QueueItem {
  id: string;
  file: File;
  /** Display name saved with the asset (editable before upload) */
  name: string;
  /** Object URL for the thumbnail */
  preview: string;
  status: "pending" | "uploading" | "success" | "duplicate" | "error";
  message?: string;
  existing?: Asset;
}

const ACCEPT = [".svg", ".png", ".jpg", ".jpeg", ".webp"];
const MAX_BYTES = 25 * 1024 * 1024;

const niceName = (fileName: string) =>
  fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function UploadAssetsPage() {
  const { authHeaders, showToast, reloadAssets } = useAdmin();

  const [categorySlug, setCategorySlug] = useState("cell-types");
  const [subcategorySlug, setSubcategorySlug] = useState("generic-cells");
  const [status, setStatus] = useState<AssetStatus>("published");
  const [tags, setTags] = useState("");

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const category = getCategoryBySlug(categorySlug) || CANONICAL_TAXONOMY[0]!;

  const summary = useMemo(() => {
    const s = { total: queue.length, ready: 0, done: 0, failed: 0, duplicate: 0, bytes: 0 };
    for (const i of queue) {
      s.bytes += i.file.size;
      if (i.status === "pending" || i.status === "error") s.ready++;
      if (i.status === "success") s.done++;
      if (i.status === "error") s.failed++;
      if (i.status === "duplicate") s.duplicate++;
    }
    return s;
  }, [queue]);

  // Free thumbnails when the page goes away
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => () => queueRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  // Leaving mid-upload would drop the rest of the batch
  useEffect(() => {
    if (!isUploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isUploading]);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const rejected: string[] = [];
    const items: QueueItem[] = [];
    for (const file of list) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!ACCEPT.includes(ext)) {
        rejected.push(`${file.name} (type not allowed)`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name} (over 25 MB)`);
        continue;
      }
      items.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: niceName(file.name),
        preview: URL.createObjectURL(file),
        status: "pending",
      });
    }
    if (items.length) setQueue((prev) => [...prev, ...items]);
    if (rejected.length) showToast(`Skipped ${rejected.length} file(s): ${rejected.slice(0, 3).join(", ")}`, "warning");
  };

  const patch = (id: string, changes: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)));

  const removeItem = (id: string) =>
    setQueue((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((i) => i.id !== id);
    });

  const clearAll = () => {
    queue.forEach((i) => URL.revokeObjectURL(i.preview));
    setQueue([]);
  };

  const uploadOne = async (item: QueueItem, allowDuplicate = false): Promise<boolean> => {
    patch(item.id, { status: "uploading", message: undefined });
    try {
      const sub = category.subcategories.find((s) => s.slug === subcategorySlug);
      const form = new FormData();
      form.append("file", item.file);
      form.append("name", item.name.trim() || niceName(item.file.name));
      form.append("category", category.name);
      form.append("categorySlug", category.slug);
      if (sub) {
        form.append("subcategorySlug", sub.slug);
        form.append("subcategoryId", sub.id);
        form.append("subcategoryName", sub.name);
      }
      form.append("status", status);
      form.append("tags", tags);
      if (allowDuplicate) form.append("allowDuplicate", "true");

      const res = await fetch("/api/assets", { method: "POST", headers: authHeaders(), body: form });
      const json = await res.json();
      if (res.status === 409 && json.duplicate) {
        patch(item.id, { status: "duplicate", message: json.message, existing: json.existingAsset });
        return false;
      }
      if (!json.success) {
        patch(item.id, { status: "error", message: json.error || "Upload failed" });
        return false;
      }
      patch(item.id, { status: "success", message: undefined });
      return true;
    } catch (err) {
      patch(item.id, { status: "error", message: (err as Error).message || "Network error" });
      return false;
    }
  };

  const uploadAll = async () => {
    setIsUploading(true);
    let ok = 0;
    for (const item of queue) {
      if (item.status === "pending" || item.status === "error") {
        if (await uploadOne(item)) ok++;
      }
    }
    setIsUploading(false);
    if (ok > 0) {
      showToast(`Uploaded ${ok} asset${ok === 1 ? "" : "s"}`);
      await reloadAssets();
    }
  };

  const uploadAnyway = async (item: QueueItem) => {
    if (await uploadOne(item, true)) {
      showToast(`Uploaded “${item.name}”`);
      await reloadAssets();
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Upload assets</h1>
          <p className="page-sub">
            Add illustrations to the editor&rsquo;s library. Files are checked and SVGs sanitised on the server.
          </p>
        </div>
        <div className="actions">
          <Link href="/assets" className="btn">
            View library
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <div className="upload-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div
            role="button"
            tabIndex={0}
            className="dropzone"
            data-dragging={isDragging}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              dragDepth.current++;
              setIsDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => {
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              dragDepth.current = 0;
              setIsDragging(false);
              if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
            }}
          >
            <span className="dropzone-icon">
              <UploadCloud size={26} />
            </span>
            <strong>{isDragging ? "Drop to add files" : "Drag files here, or click to browse"}</strong>
            <span className="field-hint">SVG, PNG, JPEG or WebP · up to 25 MB each · add as many as you like</span>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT.join(",")}
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = ""; // the same file can be picked again after removing it
            }}
          />

          {queue.length > 0 && (
            <section className="card queue" aria-label="Files to upload">
              <div className="queue-head">
                <span className="card-title">
                  Files <span className="muted">({queue.length})</span>
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll} disabled={isUploading}>
                  Clear all
                </button>
              </div>
              {queue.map((item) => (
                <div key={item.id} className="queue-item">
                  <span className="queue-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.preview} alt="" />
                  </span>
                  <div className="queue-info">
                    <input
                      className="input input-sm"
                      value={item.name}
                      onChange={(e) => patch(item.id, { name: e.target.value })}
                      disabled={item.status === "uploading" || item.status === "success"}
                      aria-label={`Name for ${item.file.name}`}
                    />
                    <span className="dim" style={{ fontSize: 12 }}>
                      {item.file.name} · {formatBytes(item.file.size)}
                    </span>
                    {item.message && (
                      <span
                        className="queue-msg"
                        style={{ color: item.status === "duplicate" ? "var(--warning)" : "var(--danger)" }}
                      >
                        {item.message}
                      </span>
                    )}
                  </div>
                  <div className="queue-side">
                    {item.status === "pending" && <span className="badge">Ready</span>}
                    {item.status === "uploading" && (
                      <span className="badge tone-primary">
                        <RefreshCw size={12} className="spin" />
                        Uploading
                      </span>
                    )}
                    {item.status === "success" && (
                      <span className="badge tone-success">
                        <Check size={12} />
                        Uploaded
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="badge tone-danger">
                        <AlertCircle size={12} />
                        Failed
                      </span>
                    )}
                    {item.status === "duplicate" && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => uploadAnyway(item)}
                        disabled={isUploading}
                        title="The same file is already in the library"
                      >
                        <RotateCcw size={13} />
                        Upload anyway
                      </button>
                    )}
                    {item.status !== "uploading" && item.status !== "success" && (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => removeItem(item.id)}
                        disabled={isUploading}
                        aria-label={`Remove ${item.file.name}`}
                        title="Remove from batch"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          {queue.length === 0 && (
            <div className="card empty" style={{ padding: 32 }}>
              <span className="empty-icon">
                <ImageIcon size={22} />
              </span>
              <h3>No files added yet</h3>
              <p>Files you add appear here so you can check names before uploading.</p>
            </div>
          )}
        </div>

        <aside className="card card-pad sticky-panel" aria-label="Batch settings">
          <div>
            <h2 className="card-title">Where these files go</h2>
            <p className="field-hint" style={{ marginTop: 2 }}>
              Applies to every file in this batch.
            </p>
          </div>

          <label className="field">
            <span className="field-label">Category</span>
            <select
              className="select"
              value={categorySlug}
              onChange={(e) => {
                setCategorySlug(e.target.value);
                const next = getCategoryBySlug(e.target.value);
                setSubcategorySlug(next?.subcategories[0]?.slug ?? "");
              }}
              disabled={isUploading}
            >
              {CANONICAL_TAXONOMY.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Subcategory</span>
            <select
              className="select"
              value={subcategorySlug}
              onChange={(e) => setSubcategorySlug(e.target.value)}
              disabled={isUploading}
            >
              {category.subcategories.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span className="field-label" id="status-label">
              Visibility
            </span>
            <div className="segmented" role="group" aria-labelledby="status-label">
              <button type="button" aria-pressed={status === "published"} onClick={() => setStatus("published")} disabled={isUploading}>
                Published
              </button>
              <button type="button" aria-pressed={status === "draft"} onClick={() => setStatus("draft")} disabled={isUploading}>
                Draft
              </button>
            </div>
            <span className="field-hint">
              {status === "published" ? "Customers see these in the editor right away." : "Only admins see drafts until you publish them."}
            </span>
          </div>

          <label className="field">
            <span className="field-label">Tags</span>
            <input
              className="input"
              placeholder="e.g. membrane, nucleus"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={isUploading}
            />
            <span className="field-hint">Comma separated. Helps customers find them by search.</span>
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div className="summary-row">
              <span>Files</span>
              <strong>{summary.total}</strong>
            </div>
            <div className="summary-row">
              <span>Total size</span>
              <strong>{formatBytes(summary.bytes)}</strong>
            </div>
            {summary.done > 0 && (
              <div className="summary-row">
                <span>Uploaded</span>
                <strong style={{ color: "var(--success)" }}>{summary.done}</strong>
              </div>
            )}
            {summary.failed + summary.duplicate > 0 && (
              <div className="summary-row">
                <span>Need attention</span>
                <strong style={{ color: "var(--warning)" }}>{summary.failed + summary.duplicate}</strong>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 40 }}
            onClick={uploadAll}
            disabled={isUploading || summary.ready === 0}
          >
            {isUploading ? <RefreshCw size={16} className="spin" /> : <FileUp size={16} />}
            {isUploading
              ? "Uploading…"
              : summary.ready === 0
                ? "Upload"
                : `Upload ${summary.ready} file${summary.ready === 1 ? "" : "s"}`}
          </button>

          {summary.done > 0 && !isUploading && (
            <Link href="/assets" className="btn">
              See them in the library
              <ArrowRight size={15} />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

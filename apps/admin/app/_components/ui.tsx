"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import type { AssetStatus } from "@design-platform/types";

/** Centered dialog; Esc and a click outside close it unless `busy` */
export function Modal({
  title,
  icon,
  onClose,
  busy = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <>
      <div className="overlay" onClick={() => !busy && onClose()} aria-hidden="true" />
      <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
        <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
          <div className="modal-head">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {icon}
              <h2 className="modal-title">{title}</h2>
            </div>
            <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
              <X size={17} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

const STATUS_TONE: Record<AssetStatus, string> = {
  published: "tone-success",
  draft: "tone-warning",
  archived: "tone-violet",
};

export function StatusBadge({ status }: { status: AssetStatus }) {
  return <span className={`badge ${STATUS_TONE[status] || ""}`}>{status}</span>;
}

export const formatBytes = (bytes?: number) =>
  !bytes ? "—" : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

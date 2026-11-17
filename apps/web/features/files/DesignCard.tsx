"use client";

import React from "react";
import Link from "next/link";
import { DesignDocument, getPageBackground } from "@design-platform/types";
import { Dropdown, DropdownItem } from "@design-platform/ui";
import { MoreHorizontal, Copy, Trash2, Edit2, ExternalLink, Share2, Star, Check } from "lucide-react";
import { ShareDialog } from "../sharing/ShareDialog";
import { PageThumbnailPreview } from "../editor/PageThumbnailPreview";
import styles from "./files.module.css";


export interface DesignCardProps {
  design: DesignDocument;
  onRename: (id: string, currentName: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isViewer?: boolean;
  /** Multi-select */
  isSelected?: boolean;
  /** True while any design is selected: clicking a card toggles it instead of opening it */
  selectionMode?: boolean;
  onToggleSelect?: (id: string, range: boolean) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 86400 * 7) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const DesignCard: React.FC<DesignCardProps> = ({
  design,
  onRename,
  onDuplicate,
  onDelete,
  isViewer = false,
  isSelected = false,
  selectionMode = false,
  onToggleSelect,
}) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isShareOpen, setIsShareOpen] = React.useState(false);

  const menuItems: DropdownItem[] = [
    {
      id: "open",
      label: "Open in Editor",
      icon: <ExternalLink size={14} />,
      onClick: () => {
        window.location.href = `/editor/${design.id}`;
      },
    },
    ...(!isViewer
      ? [
          {
            id: "share",
            label: "Share",
            icon: <Share2 size={14} style={{ color: "#10b981" }} />,
            onClick: () => setIsShareOpen(true),
          },
          {
            id: "rename",
            label: "Rename",
            icon: <Edit2 size={14} />,
            onClick: () => onRename(design.id, design.name),
          },
          {
            id: "duplicate",
            label: "Duplicate",
            icon: <Copy size={14} />,
            onClick: () => onDuplicate(design.id),
          },
          {
            id: "delete",
            label: "Delete",
            icon: <Trash2 size={14} />,
            danger: true,
            onClick: () => onDelete(design.id),
          },
        ]
      : []),
  ];

  const firstPage = design.pages?.[0];
  const pageCount = design.pages?.length || 1;
  const ratio = (design.width || 1) / (design.height || 1);
  // Fit the page preview inside the 16:10 thumbnail
  const pageStyle: React.CSSProperties =
    ratio >= 1.6 ? { width: "100%", aspectRatio: `${ratio}` } : { height: "100%", aspectRatio: `${ratio}` };

  return (
    <article
      className={`${styles.card} ${isSelected ? styles.cardSelected : ""} ${selectionMode ? styles.selecting : ""}`}
      style={{ zIndex: isMenuOpen ? 50 : undefined }}
    >
      {onToggleSelect && (
        <label className={styles.check} title={isSelected ? "Deselect" : "Select"} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            onClick={(e) => onToggleSelect(design.id, e.shiftKey)}
            aria-label={`Select ${design.name}`}
          />
          <span aria-hidden>
            <Check size={14} strokeWidth={3} />
          </span>
        </label>
      )}
      <Link
        href={`/editor/${design.id}`}
        className={styles.thumb}
        aria-label={`Open ${design.name}`}
        onClick={(e) => {
          if (selectionMode && onToggleSelect) {
            e.preventDefault();
            onToggleSelect(design.id, e.shiftKey);
          }
        }}
      >
        <div className={styles.thumbPage} style={pageStyle}>
          {design.thumbnail ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={design.thumbnail} alt="" />
          ) : firstPage && firstPage.elements.length > 0 ? (
            <PageThumbnailPreview
              page={firstPage}
              docWidth={design.width}
              docHeight={design.height}
              backgroundColor={getPageBackground(design, 0)}
              preferVector
            />
          ) : (
            <div className={styles.thumbEmpty} style={{ height: "100%", background: getPageBackground(design, 0) }}>
              Blank page
            </div>
          )}
        </div>
        <span className={styles.openHint}>{selectionMode ? (isSelected ? "Selected" : "Select") : "Open"}</span>
      </Link>
      {design.favorite && (
        <span className={styles.fav} title="Favorite">
          <Star size={15} fill="currentColor" />
        </span>
      )}

      <div className={styles.cardBody}>
        <div className={styles.cardText}>
          <Link href={`/editor/${design.id}`} className={styles.cardName} title={design.name}>
            {design.name}
          </Link>
          <div className={styles.cardMeta}>
            <span>
              {design.width} × {design.height}
            </span>
            <span className={styles.dot} />
            <span>{formatRelativeTime(design.updatedAt || design.createdAt)}</span>
            {pageCount > 1 && (
              <>
                <span className={styles.dot} />
                <span>{pageCount} pages</span>
              </>
            )}
          </div>
        </div>

        <Dropdown
          align="right"
          onOpenChange={setIsMenuOpen}
          trigger={
            <button type="button" aria-label={`Options for ${design.name}`} className={styles.iconBtn}>
              <MoreHorizontal size={18} />
            </button>
          }
          items={menuItems}
        />
      </div>

      <ShareDialog
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        designId={design.id}
        designName={design.name}
      />
    </article>
  );
};

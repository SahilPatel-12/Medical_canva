"use client";

import React from "react";
import Link from "next/link";
import { DesignDocument } from "@design-platform/types";
import { Badge, Dropdown, DropdownItem } from "@design-platform/ui";
import { MoreVertical, Copy, Trash2, Edit2, ExternalLink, Share2 } from "lucide-react";
import { ShareDialog } from "../sharing/ShareDialog";


export interface DesignCardProps {
  design: DesignDocument;
  onRename: (id: string, currentName: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isViewer?: boolean;
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
            icon: <Share2 size={14} style={{ color: "#3b82f6" }} />,
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

  const elementCount = design.pages?.[0]?.elements?.length || 0;


  return (
    <div
      style={{
        backgroundColor: "#141417",
        border: "1px solid #27272a",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
        position: "relative",
        zIndex: isMenuOpen ? 50 : 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#3f3f46";
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 24px -8px rgba(0, 0, 0, 0.5)";
        if (!isMenuOpen) {
          e.currentTarget.style.zIndex = "10";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#27272a";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        if (!isMenuOpen) {
          e.currentTarget.style.zIndex = "1";
        }
      }}
    >
      {/* Thumbnail Area */}
      <Link
        href={`/editor/${design.id}`}
        style={{
          display: "block",
          aspectRatio: "16 / 10",
          backgroundColor: "#18181b",
          borderBottom: "1px solid #27272a",
          borderTopLeftRadius: "11px",
          borderTopRightRadius: "11px",
          position: "relative",
          overflow: "hidden",
          textDecoration: "none",
        }}
      >
        {design.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={design.thumbnail}
            alt={design.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              backgroundColor: design.backgroundColor || "#ffffff",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: design.backgroundColor || "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
              position: "relative",
            }}
          >
            {/* Minimal schematic representation */}
            <div
              style={{
                width: "80%",
                height: "80%",
                border: "1px dashed #cbd5e1",
                borderRadius: "6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(59, 130, 246, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#3b82f6",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {elementCount}
              </div>
              <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                {elementCount === 1 ? "1 element" : `${elementCount} elements`}
              </span>
            </div>
          </div>
        )}
      </Link>

      {/* Card Info */}
      <div
        style={{
          padding: "0.875rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            href={`/editor/${design.id}`}
            style={{
              display: "block",
              color: "#f4f4f5",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={design.name}
          >
            {design.name}
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "0.25rem",
              fontSize: "0.75rem",
              color: "#71717a",
            }}
          >
            <Badge variant="outline" size="sm">
              {design.width} × {design.height}
            </Badge>
            <span>•</span>
            <span>{formatRelativeTime(design.updatedAt || design.createdAt)}</span>
          </div>
        </div>

        {/* Menu ••• */}
        <Dropdown
          align="right"
          onOpenChange={setIsMenuOpen}
          trigger={
            <button
              type="button"
              aria-label="Design options"
              style={{
                background: "transparent",
                border: "none",
                color: "#a1a1aa",
                padding: "6px",
                borderRadius: "6px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#27272a")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <MoreVertical size={16} />
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
    </div>
  );
};


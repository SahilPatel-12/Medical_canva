"use client";

import React from "react";
import { Page, DesignDocument } from "@design-platform/types";
import { PageThumbnailPreview } from "./PageThumbnailPreview";
import { X, Plus, Copy, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@design-platform/ui";

export interface EditorGridViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DesignDocument;
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onReorderPages?: (fromIndex: number, toIndex: number) => void;
  isReadOnly?: boolean;
}

export const EditorGridViewModal: React.FC<EditorGridViewModalProps> = ({
  isOpen,
  onClose,
  document,
  activePageIndex,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onReorderPages,
  isReadOnly = false,
}) => {
  if (!isOpen) return null;

  const pages = document.pages || [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(12px)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 2rem",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Canvas Pages ({pages.length})
          </h2>
          <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
            Select a canvas page to edit or manage your overall design
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {!isReadOnly && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => onAddPage()}
            >
              Add Page
            </Button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              color: "#64748b",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f1f5f9";
              e.currentTarget.style.color = "#0f172a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.color = "#64748b";
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Pages Grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "2.5rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "2rem",
          alignContent: "start",
          backgroundColor: "#f8fafc",
        }}
      >
        {pages.map((page, index) => {
          const isActive = index === activePageIndex;

          return (
            <div
              key={page.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                position: "relative",
              }}
            >
              {/* Card Container */}
              <div
                onClick={() => {
                  onSelectPage(index);
                  onClose();
                }}
                style={{
                  aspectRatio: `${document.width || 1200} / ${document.height || 800}`,
                  borderRadius: "12px",
                  border: isActive ? "2.5px solid #2563eb" : "1.5px solid #e2e8f0",
                  boxShadow: isActive
                    ? "0 0 0 3px rgba(37, 99, 235, 0.25), 0 8px 24px rgba(0,0,0,0.08)"
                    : "0 4px 16px rgba(0, 0, 0, 0.05)",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                  backgroundColor: document.backgroundColor || "#ffffff",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.05)";
                  }
                }}
              >
                <PageThumbnailPreview
                  page={page}
                  docWidth={document.width}
                  docHeight={document.height}
                  backgroundColor={document.backgroundColor}
                />

                {/* Page number badge inside preview card */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "10px",
                    left: "10px",
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    backdropFilter: "blur(4px)",
                    color: "#0f172a",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  {index + 1}
                </div>
              </div>

              {/* Bottom Card Footer with Actions */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 4px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: isActive ? "#2563eb" : "#334155",
                  }}
                >
                  {page.name || `Page ${index + 1}`}
                </span>

                {!isReadOnly && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {onReorderPages && index > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderPages(index, index - 1);
                        }}
                        title="Move Page Left"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#64748b",
                          cursor: "pointer",
                          padding: "4px",
                        }}
                      >
                        <ArrowLeft size={14} />
                      </button>
                    )}

                    {onReorderPages && index < pages.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderPages(index, index + 1);
                        }}
                        title="Move Page Right"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#64748b",
                          cursor: "pointer",
                          padding: "4px",
                        }}
                      >
                        <ArrowRight size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicatePage(index);
                      }}
                      title="Duplicate Page"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        padding: "4px",
                      }}
                    >
                      <Copy size={14} />
                    </button>

                    {pages.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePage(index);
                        }}
                        title="Delete Page"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#dc2626",
                          cursor: "pointer",
                          padding: "4px",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Page Card Placeholder */}
        {!isReadOnly && (
          <div
            onClick={() => onAddPage()}
            style={{
              aspectRatio: `${document.width || 1200} / ${document.height || 800}`,
              borderRadius: "12px",
              border: "2px dashed #cbd5e1",
              backgroundColor: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: "pointer",
              color: "#64748b",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#2563eb";
              e.currentTarget.style.backgroundColor = "#eff6ff";
              e.currentTarget.style.color = "#2563eb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.color = "#64748b";
            }}
          >
            <Plus size={24} />
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Add New Page</span>
          </div>
        )}
      </div>
    </div>
  );
};

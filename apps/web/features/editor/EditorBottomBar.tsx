"use client";

import React, { useState, useRef, useEffect } from "react";
import { Page, DesignDocument } from "@design-platform/types";
import { PageThumbnailPreview } from "./PageThumbnailPreview";
import {
  FileText,
  Clock,
  Plus,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";

export interface EditorBottomBarProps {
  document: DesignDocument;
  pages: Page[];
  activePageIndex: number;
  zoom: number;
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onReorderPages?: (fromIndex: number, toIndex: number) => void;
  onSetZoom: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onResetZoom: () => void;
  onOpenGridView: () => void;
  isReadOnly?: boolean;
}

export const EditorBottomBar: React.FC<EditorBottomBarProps> = ({
  document,
  pages,
  activePageIndex,
  zoom,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onReorderPages,
  onSetZoom,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetZoom,
  onOpenGridView,
  isReadOnly = false,
}) => {
  const [isFilmstripExpanded, setIsFilmstripExpanded] = useState<boolean>(false);
  const [isZoomMenuOpen, setIsZoomMenuOpen] = useState<boolean>(false);
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(false);
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);
  const [hoveredPageIndex, setHoveredPageIndex] = useState<number | null>(null);

  // Presentation timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Page slide notes state
  const [pageNotes, setPageNotes] = useState<Record<string, string>>({});

  const zoomMenuRef = useRef<HTMLDivElement | null>(null);
  const filmstripScrollRef = useRef<HTMLDivElement | null>(null);

  // Timer tick effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  // Close zoom dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (zoomMenuRef.current && !zoomMenuRef.current.contains(e.target as Node)) {
        setIsZoomMenuOpen(false);
      }
    };
    if (isZoomMenuOpen) {
      window.addEventListener("mousedown", handleOutsideClick);
    }
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [isZoomMenuOpen]);

  // Scroll active card into view
  useEffect(() => {
    if (filmstripScrollRef.current) {
      const activeCard = filmstripScrollRef.current.querySelector(
        `[data-page-index="${activePageIndex}"]`
      ) as HTMLElement | null;
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }
  }, [activePageIndex]);

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const zoomPercent = Math.round(zoom * 100);

  const zoomPresets = [
    { label: "Fit to screen", action: onFitToScreen },
    { label: "100%", action: onResetZoom },
    { label: "25%", action: () => onSetZoom(0.25) },
    { label: "50%", action: () => onSetZoom(0.5) },
    { label: "75%", action: () => onSetZoom(0.75) },
    { label: "125%", action: () => onSetZoom(1.25) },
    { label: "150%", action: () => onSetZoom(1.5) },
    { label: "200%", action: () => onSetZoom(2.0) },
  ];

  const activePage = pages[activePageIndex] || pages[0];
  const activePageId = activePage ? activePage.id : "page-default";

  return (
    <div
      style={{
        position: "relative",
        zIndex: 40,
        backgroundColor: "#ffffff",
        borderTop: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
        boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.03)",
      }}
    >
      {/* 1. Canva Multi-Page Filmstrip (Collapsible) */}
      {isFilmstripExpanded && (
        <div
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            overflow: "visible",
            position: "relative",
          }}
        >
          {/* Filmstrip Horizontal Scroll Area */}
          <div
            ref={filmstripScrollRef}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              overflowX: "auto",
              overflowY: "visible",
              padding: "10px 4px 6px 4px",
              flex: 1,
              scrollbarWidth: "thin",
            }}
          >
            {pages.map((page, index) => {
              const isActive = index === activePageIndex;
              const isHovered = hoveredPageIndex === index;

              return (
                <div
                  key={page.id}
                  data-page-index={index}
                  onMouseEnter={() => setHoveredPageIndex(index)}
                  onMouseLeave={() => setHoveredPageIndex(null)}
                  style={{
                    position: "relative",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                >
                  {/* Floating Action Pill above active or hovered card */}
                  {(isActive || isHovered) && !isReadOnly && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-30px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                        backgroundColor: "#ffffff",
                        padding: "2px 4px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                        zIndex: 10,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Duplicate */}
                      <button
                        type="button"
                        onClick={() => onDuplicatePage(index)}
                        title="Duplicate Page"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#64748b",
                          padding: "3px 4px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f1f5f9";
                          e.currentTarget.style.color = "#0f172a";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "#64748b";
                        }}
                      >
                        <Copy size={12} />
                      </button>

                      {/* Delete */}
                      {pages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeletePage(index)}
                          title="Delete Page"
                          style={{
                            background: "none",
                            border: "none",
                            color: "#dc2626",
                            padding: "3px 4px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#fee2e2";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Thumbnail Card */}
                  <div
                    onClick={() => onSelectPage(index)}
                    style={{
                      width: "74px",
                      height: "48px",
                      borderRadius: "6px",
                      backgroundColor: "#ffffff",
                      border: isActive ? "2px solid #2563eb" : "1px solid #cbd5e1",
                      boxShadow: isActive
                        ? "0 0 0 3px rgba(37, 99, 235, 0.2), 0 2px 6px rgba(0,0,0,0.06)"
                        : "0 1px 3px rgba(0,0,0,0.05)",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <PageThumbnailPreview
                      page={page}
                      docWidth={document.width || 1200}
                      docHeight={document.height || 800}
                      backgroundColor={document.backgroundColor || "#ffffff"}
                    />
                  </div>

                  {/* Page Number Label */}
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "10px",
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "#2563eb" : "#64748b",
                      marginTop: "2px",
                    }}
                  >
                    {index + 1}
                  </div>
                </div>
              );
            })}

            {/* Canva "+ Add Page" Card */}
            {!isReadOnly && (
              <div
                onClick={onAddPage}
                title="Add new page"
                style={{
                  width: "74px",
                  height: "48px",
                  borderRadius: "6px",
                  border: "1.5px dashed #cbd5e1",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "2px",
                  color: "#64748b",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                  marginBottom: "14px",
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
                <Plus size={16} />
                <span style={{ fontSize: "10px", fontWeight: 600 }}>Add page</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Slide Notes Drawer */}
      {isNotesOpen && (
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <FileText size={13} style={{ color: "#2563eb" }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#0f172a" }}>
                Notes for Page {activePageIndex + 1}
              </span>
            </div>
            <textarea
              placeholder="Add presenter or scientific design notes for this page..."
              value={pageNotes[activePageId] || ""}
              onChange={(e) =>
                setPageNotes((prev) => ({ ...prev, [activePageId]: e.target.value }))
              }
              rows={2}
              style={{
                width: "100%",
                padding: "6px 10px",
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                color: "#0f172a",
                fontSize: "12px",
                outline: "none",
                fontFamily: "inherit",
                resize: "none",
              }}
            />
          </div>
        </div>
      )}

      {/* 3. Bottom Controls Bar */}
      <div
        style={{
          height: "40px",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          fontSize: "12px",
          backgroundColor: "#ffffff",
        }}
      >
        {/* Left Side: Page Quick Nav, Add Page, Thumbnails Toggle, Notes & Timer */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Page Switcher Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
              backgroundColor: "#f8fafc",
              padding: "2px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <button
              type="button"
              disabled={activePageIndex <= 0}
              onClick={() => onSelectPage(activePageIndex - 1)}
              title="Previous Page"
              style={{
                background: "none",
                border: "none",
                color: activePageIndex <= 0 ? "#cbd5e1" : "#475569",
                cursor: activePageIndex <= 0 ? "not-allowed" : "pointer",
                padding: "2px 4px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronLeft size={13} />
            </button>

            <span
              style={{
                fontSize: "11px",
                color: "#0f172a",
                fontWeight: 600,
                padding: "0 6px",
                minWidth: "68px",
                textAlign: "center",
              }}
            >
              Page {activePageIndex + 1} / {pages.length}
            </span>

            <button
              type="button"
              disabled={activePageIndex >= pages.length - 1}
              onClick={() => onSelectPage(activePageIndex + 1)}
              title="Next Page"
              style={{
                background: "none",
                border: "none",
                color: activePageIndex >= pages.length - 1 ? "#cbd5e1" : "#475569",
                cursor: activePageIndex >= pages.length - 1 ? "not-allowed" : "pointer",
                padding: "2px 4px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Quick Add Page */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={onAddPage}
              title="Add New Page"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "3px",
                padding: "3px 7px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#2563eb",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#eff6ff")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ffffff")}
            >
              <Plus size={12} />
              <span>Add</span>
            </button>
          )}

          {/* Thumbnails Filmstrip Toggle */}
          <button
            type="button"
            onClick={() => setIsFilmstripExpanded((prev) => !prev)}
            title={isFilmstripExpanded ? "Collapse Page Thumbnails" : "Expand Page Thumbnails"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 7px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              backgroundColor: isFilmstripExpanded ? "#eff6ff" : "transparent",
              color: isFilmstripExpanded ? "#2563eb" : "#475569",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              if (!isFilmstripExpanded) e.currentTarget.style.backgroundColor = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              if (!isFilmstripExpanded) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {isFilmstripExpanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            <span>Thumbnails</span>
          </button>

          {/* Notes Toggle */}
          <button
            type="button"
            onClick={() => setIsNotesOpen((prev) => !prev)}
            title="Toggle Slide Notes"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 7px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              backgroundColor: isNotesOpen ? "#eff6ff" : "transparent",
              color: isNotesOpen ? "#2563eb" : "#64748b",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              if (!isNotesOpen) e.currentTarget.style.backgroundColor = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              if (!isNotesOpen) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <FileText size={12} />
            <span>Notes</span>
          </button>

          {/* Presentation Timer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 7px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              color: isTimerRunning ? "#2563eb" : "#64748b",
              fontSize: "11px",
              fontFamily: "monospace",
              fontWeight: 600,
            }}
          >
            <Clock size={11} style={{ color: isTimerRunning ? "#2563eb" : "#94a3b8" }} />
            <span>{formatTimer(timerSeconds)}</span>
            <button
              type="button"
              onClick={() => setIsTimerRunning((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                color: isTimerRunning ? "#dc2626" : "#16a34a",
                cursor: "pointer",
                padding: "1px",
                display: "flex",
                alignItems: "center",
              }}
            >
              {isTimerRunning ? <Pause size={10} /> : <Play size={10} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsTimerRunning(false);
                setTimerSeconds(0);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "1px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <RotateCcw size={10} />
            </button>
          </div>
        </div>

        {/* Right Side: Grid View & Zoom Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Grid View Modal Button */}
          <button
            type="button"
            onClick={onOpenGridView}
            title="Open Grid View"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              backgroundColor: "transparent",
              color: "#475569",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f1f5f9";
              e.currentTarget.style.color = "#0f172a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#475569";
            }}
          >
            <LayoutGrid size={13} />
            <span>Grid View</span>
          </button>

          <div style={{ width: "1px", height: "16px", backgroundColor: "#e2e8f0" }} />

          {/* Zoom Slider Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              type="button"
              onClick={onZoomOut}
              title="Zoom out"
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ZoomOut size={13} />
            </button>

            <input
              type="range"
              min={10}
              max={500}
              value={zoomPercent}
              onChange={(e) => onSetZoom(Number(e.target.value) / 100)}
              style={{
                width: "70px",
                accentColor: "#2563eb",
                cursor: "pointer",
              }}
            />

            <button
              type="button"
              onClick={onZoomIn}
              title="Zoom in"
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ZoomIn size={13} />
            </button>

            {/* Zoom Percentage Label / Menu */}
            <div style={{ position: "relative" }} ref={zoomMenuRef}>
              <button
                type="button"
                onClick={() => setIsZoomMenuOpen((prev) => !prev)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#0f172a",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "2px 4px",
                  minWidth: "40px",
                }}
              >
                {zoomPercent}%
              </button>

              {isZoomMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "28px",
                    right: 0,
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "4px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                    zIndex: 60,
                    minWidth: "120px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {zoomPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        preset.action();
                        setIsZoomMenuOpen(false);
                      }}
                      style={{
                        padding: "5px 10px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        color: "#334155",
                        fontSize: "11px",
                        fontWeight: 500,
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f1f5f9";
                        e.currentTarget.style.color = "#0f172a";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#334155";
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fit to Screen */}
            <button
              type="button"
              onClick={onFitToScreen}
              title="Fit to Screen"
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

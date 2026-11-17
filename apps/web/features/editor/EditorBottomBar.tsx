"use client";

import React, { useEffect, useRef, useState } from "react";
import { Page, DesignDocument, getPageBackground } from "@design-platform/types";
import { PageThumbnailPreview } from "./PageThumbnailPreview";
import {
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
} from "lucide-react";
import {
  FitScreenIcon,
  GridViewIcon,
  NotesIcon,
} from "./icons/EditorIcons";

// ==========================================
// Floating canvas controls
// ------------------------------------------
// Three quiet pills float over the bottom of the canvas instead of a full-width toolbar:
//   left   — page notes (with an optional presenter timer inside)
//   center — page navigation; the label opens a tray of page thumbnails
//   right  — zoom: − / value (presets menu) / +, and fit
// At most one popover is open at a time; Esc or a click outside closes it.
// ==========================================

export interface EditorBottomBarProps {
  document: DesignDocument;
  pages: Page[];
  activePageIndex: number;
  zoom: number;
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
  onSetZoom: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onResetZoom: () => void;
  onOpenGridView: () => void;
  isReadOnly?: boolean;
}

type Panel = "pages" | "zoom" | "notes" | null;

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

export const EditorBottomBar: React.FC<EditorBottomBarProps> = ({
  document,
  pages,
  activePageIndex,
  zoom,
  onSelectPage,
  onAddPage,
  onSetZoom,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetZoom,
  onOpenGridView,
  isReadOnly = false,
}) => {
  const [panel, setPanel] = useState<Panel>(null);
  const [notesByPage, setNotesByPage] = useState<Record<string, string>>({});
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);

  const toggle = (next: Exclude<Panel, null>) => setPanel((cur) => (cur === next ? null : next));

  // Close the open popover on Escape or a click anywhere else
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPanel(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isTimerRunning]);

  // Keep the current page visible in the thumbnail tray
  useEffect(() => {
    if (panel !== "pages") return;
    const card = trayRef.current?.querySelector(`[data-page-index="${activePageIndex}"]`);
    card?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [panel, activePageIndex]);

  const pageCount = Math.max(1, pages.length);
  const activePage = pages[activePageIndex] || pages[0];
  const activePageId = activePage?.id || "page";
  const zoomPercent = Math.round(zoom * 100);
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl+";
  const docW = document.width || 1200;
  const docH = document.height || 800;
  const thumbW = 128;
  const thumbH = Math.max(48, Math.min(160, Math.round((thumbW * docH) / docW)));
  const timeLabel = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`;
  const hasNote = Boolean(notesByPage[activePageId]?.trim());

  return (
    <div ref={rootRef} className="cc-root" aria-label="Canvas controls">
      {/* ---------- Left: notes ---------- */}
      <div className="cc-slot cc-slot--left">
        <div className="cc-anchor">
          <button
            type="button"
            className="cc-pill cc-pill--button"
            aria-pressed={panel === "notes"}
            aria-expanded={panel === "notes"}
            onClick={() => toggle("notes")}
            title="Notes for this page"
          >
            <NotesIcon size={18} />
            <span>Notes</span>
            {hasNote && <span className="cc-dot" aria-label="This page has notes" />}
          </button>

          {panel === "notes" && (
            <div
              className="cc-popover cc-popover--left cc-notes"
              role="dialog"
              aria-label={`Notes for page ${activePageIndex + 1}`}
            >
              <div className="cc-popover-head">
                <span>Notes · Page {activePageIndex + 1}</span>
                <button type="button" className="cc-icon" onClick={() => setPanel(null)} aria-label="Close notes">
                  <X size={16} />
                </button>
              </div>
              <textarea
                autoFocus
                className="cc-textarea"
                placeholder="Talking points, figure legends, references…"
                value={notesByPage[activePageId] || ""}
                readOnly={isReadOnly}
                onChange={(e) => setNotesByPage((prev) => ({ ...prev, [activePageId]: e.target.value }))}
              />
              <div className="cc-timer">
                <span className="cc-timer-label">Presenter timer</span>
                <span className={`cc-timer-time${isTimerRunning ? " is-running" : ""}`}>{timeLabel}</span>
                <button
                  type="button"
                  className="cc-icon"
                  onClick={() => setIsTimerRunning((r) => !r)}
                  aria-label={isTimerRunning ? "Pause timer" : "Start timer"}
                  title={isTimerRunning ? "Pause" : "Start"}
                >
                  {isTimerRunning ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button
                  type="button"
                  className="cc-icon"
                  disabled={timerSeconds === 0 && !isTimerRunning}
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(0);
                  }}
                  aria-label="Reset timer"
                  title="Reset"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Center: pages ---------- */}
      <div className="cc-slot cc-slot--center">
        <div className="cc-anchor">
          <div className="cc-pill" role="group" aria-label="Pages">
            <button
              type="button"
              className="cc-icon"
              disabled={activePageIndex <= 0}
              onClick={() => onSelectPage(activePageIndex - 1)}
              aria-label="Previous page"
              title="Previous page"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="cc-page-label"
              aria-pressed={panel === "pages"}
              aria-expanded={panel === "pages"}
              onClick={() => toggle("pages")}
              title="Show all pages"
            >
              <span className="cc-page-num">{activePageIndex + 1}</span>
              <span className="cc-page-sep">/</span>
              <span className="cc-page-total">{pageCount}</span>
              <ChevronUp size={14} className={`cc-caret${panel === "pages" ? " is-open" : ""}`} />
            </button>
            <button
              type="button"
              className="cc-icon"
              disabled={activePageIndex >= pageCount - 1}
              onClick={() => onSelectPage(activePageIndex + 1)}
              aria-label="Next page"
              title="Next page"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {panel === "pages" && (
            <div className="cc-popover cc-popover--center cc-tray" role="dialog" aria-label="Pages">
              <div className="cc-popover-head">
                <span>Pages</span>
                <button
                  type="button"
                  className="cc-link"
                  onClick={() => {
                    setPanel(null);
                    onOpenGridView();
                  }}
                >
                  <GridViewIcon size={16} />
                  Grid view
                </button>
              </div>
              <div ref={trayRef} className="cc-tray-scroll">
                <div className="cc-tray-row">
                  {pages.map((page, index) => {
                    const isActive = index === activePageIndex;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        data-page-index={index}
                        className={`cc-thumb${isActive ? " is-active" : ""}`}
                        onClick={() => onSelectPage(index)}
                        title={page.name || `Page ${index + 1}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className="cc-thumb-frame" style={{ width: thumbW, height: thumbH }}>
                          <PageThumbnailPreview
                            page={page}
                            docWidth={docW}
                            docHeight={docH}
                            backgroundColor={getPageBackground(document, index)}
                            preferVector
                          />
                        </span>
                        <span className="cc-thumb-num">{index + 1}</span>
                      </button>
                    );
                  })}
                  {!isReadOnly && (
                    <button
                      type="button"
                      className="cc-thumb cc-thumb--add"
                      onClick={onAddPage}
                      title="Add a page at the end"
                    >
                      <span className="cc-thumb-frame" style={{ width: thumbW, height: thumbH }}>
                        <Plus size={20} />
                      </span>
                      <span className="cc-thumb-num">Add page</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Right: zoom ---------- */}
      <div className="cc-slot cc-slot--right">
        <div className="cc-anchor">
          <div className="cc-pill" role="group" aria-label="Zoom">
            <button type="button" className="cc-icon" onClick={onZoomOut} aria-label="Zoom out" title={`Zoom out (${mod}−)`}>
              <Minus size={16} />
            </button>
            <button
              type="button"
              className="cc-zoom-value"
              aria-pressed={panel === "zoom"}
              aria-expanded={panel === "zoom"}
              aria-haspopup="menu"
              onClick={() => toggle("zoom")}
              title="Zoom options"
            >
              {zoomPercent}%
            </button>
            <button type="button" className="cc-icon" onClick={onZoomIn} aria-label="Zoom in" title={`Zoom in (${mod}+)`}>
              <Plus size={16} />
            </button>
            <span className="cc-divider" />
            <button
              type="button"
              className="cc-icon"
              onClick={onFitToScreen}
              aria-label="Fit page to screen"
              title={`Fit page to screen (${mod}9)`}
            >
              <FitScreenIcon size={18} />
            </button>
          </div>

          {panel === "zoom" && (
            <div className="cc-popover cc-popover--right cc-menu" role="menu" aria-label="Zoom">
              <button
                type="button"
                role="menuitem"
                className="cc-menu-item"
                onClick={() => {
                  onFitToScreen();
                  setPanel(null);
                }}
              >
                <span className="cc-menu-check" />
                <span>Fit to screen</span>
                <kbd>{mod}9</kbd>
              </button>
              <div className="cc-menu-sep" />
              {ZOOM_PRESETS.map((z) => {
                const isCurrent = Math.abs(zoom - z) < 0.005;
                return (
                  <button
                    key={z}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isCurrent}
                    className="cc-menu-item"
                    onClick={() => {
                      if (z === 1) onResetZoom();
                      else onSetZoom(z);
                      setPanel(null);
                    }}
                  >
                    <span className="cc-menu-check">{isCurrent && <Check size={14} />}</span>
                    <span>{Math.round(z * 100)}%</span>
                    {z === 1 && <kbd>{mod}0</kbd>}
                  </button>
                );
              })}
              <div className="cc-menu-hint">{isMac ? "⌘" : "Ctrl"} + scroll or pinch to zoom</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

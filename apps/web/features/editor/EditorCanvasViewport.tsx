"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CanvasEngine, CanvasViewportController } from "@design-platform/editor";
import { getPageBackground, type DesignDocument, type DesignElement, type Page } from "@design-platform/types";
import {
  ChevronUp,
  ChevronDown,
  Plus,
} from "lucide-react";
import {
  AddPageIcon,
  DeleteIcon,
  DuplicateIcon,
} from "./icons/EditorIcons";
import { PageThumbnailPreview } from "./PageThumbnailPreview";

// ==========================================
// Canva-style page stack
// ------------------------------------------
// Pages are stacked vertically and stay centered: the wheel scrolls through them,
// Ctrl/Cmd + wheel (or pinch) zooms. The active page is the live Konva canvas, drawn
// by a viewport-sized stage that stays fixed (sticky) while the column scrolls; the
// other pages show previews in their slots. Headers sit above each page.
// ==========================================

/** Fixed screen-space metrics (px); only pages scale with zoom */
const M = {
  /** Room for the contextual toolbar floating at the top of the canvas */
  padTop: 72,
  headerH: 40,
  pageGap: 28,
  addGap: 20,
  addH: 44,
  padBottom: 88,
  side: 48,
  minHeaderW: 340,
  fitX: 56,
  fitY: 28,
  /** Space taken by the floating controls at the bottom / the toolbar at the top */
  bottomInset: 64,
  topInset: 60,
};
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const MAX_FIT_ZOOM = 2;

interface StackInputs {
  docW: number;
  docH: number;
  pageCount: number;
  activeIndex: number;
  viewW: number;
  viewH: number;
}

interface StackLayout {
  zoom: number;
  pageW: number;
  pageH: number;
  pageX: number;
  headerX: number;
  headerW: number;
  contentW: number;
  contentH: number;
  addY: number;
  headerY: (index: number) => number;
  pageY: (index: number) => number;
  /** Page row (header + page + gap) containing a content-space y */
  rowAt: (y: number) => number;
}

function computeStackLayout(zoom: number, inp: StackInputs): StackLayout {
  const pageW = inp.docW * zoom;
  const pageH = inp.docH * zoom;
  const headerW = Math.max(pageW, M.minHeaderW);
  const naturalW = headerW + 2 * M.side;
  const contentW = Math.max(inp.viewW, naturalW);
  const count = Math.max(1, inp.pageCount);
  const row = M.headerH + pageH + M.pageGap;
  const naturalH = M.padTop + count * row - M.pageGap + M.addGap + M.addH + M.padBottom;
  const contentH = Math.max(inp.viewH, naturalH);
  // Content shorter than the viewport stays vertically centered
  const offsetY = (contentH - naturalH) / 2;
  const headerY = (i: number) => offsetY + M.padTop + i * row;
  return {
    zoom,
    pageW,
    pageH,
    pageX: (contentW - pageW) / 2,
    headerX: (contentW - headerW) / 2,
    headerW,
    contentW,
    contentH,
    addY: offsetY + M.padTop + count * row - M.pageGap + M.addGap,
    headerY,
    pageY: (i: number) => headerY(i) + M.headerH,
    rowAt: (y: number) => Math.max(0, Math.min(count - 1, Math.floor((y - offsetY - M.padTop) / row))),
  };
}

const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** Page names like "Page 3" are placeholders, not titles */
const isDefaultPageName = (name?: string) => !name || /^Page \d+$/.test(name.trim());

export interface EditorCanvasViewportProps {
  document: DesignDocument;
  activePageIndex: number;
  isReadOnly: boolean;
  /** Mount point of the Konva stage (from useEditor) */
  containerRef: React.Ref<HTMLDivElement>;
  setViewportController: (controller: CanvasViewportController | null) => void;
  onSelectPage: (index: number) => void;
  onAddPage: (afterIndex?: number) => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onMovePage: (from: number, to: number) => void;
  onRenamePage: (index: number, name: string) => void;
  /** Floating overlays (selection toolbar, banners) shown above the scrolling pages */
  children?: React.ReactNode;
}

export const EditorCanvasViewport: React.FC<EditorCanvasViewportProps> = ({
  document: doc,
  activePageIndex,
  isReadOnly,
  containerRef,
  setViewportController,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
  onRenamePage,
  children,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoomState] = useState(1);
  const [snapshots, setSnapshots] = useState(
    () => new Map<string, { elements: DesignElement[]; url: string; background?: string }>()
  );

  const pages = doc.pages || [];
  const inputs: StackInputs = {
    docW: doc.width || 1200,
    docH: doc.height || 800,
    pageCount: pages.length,
    activeIndex: Math.max(0, Math.min(pages.length - 1, activePageIndex)),
    viewW: size.w,
    viewH: size.h,
  };

  // Everything the (stable) controller reads lives in refs
  const inputsRef = useRef(inputs);
  const zoomRef = useRef(1);
  const engineRef = useRef<CanvasEngine | null>(null);
  const autoFitRef = useRef(true);
  const hasFittedRef = useRef(false);
  const scrollActivatedRef = useRef(false);
  const activeCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSelectPageRef = useRef(onSelectPage);

  useLayoutEffect(() => {
    inputsRef.current = inputs;
    onSelectPageRef.current = onSelectPage;
  });

  // Stable controller: everything it reads lives in refs
  const [stack] = useState(() => {
    const layoutNow = () => computeStackLayout(zoomRef.current, inputsRef.current);

    const applyContentSize = (layout: StackLayout) => {
      const content = contentRef.current;
      if (!content) return;
      content.style.width = `${layout.contentW}px`;
      content.style.height = `${layout.contentH}px`;
    };

    /** Moves the live stage onto the active page's slot */
    const sync = () => {
      const engine = engineRef.current;
      const el = scrollRef.current;
      if (!engine || !el) return;
      const layout = layoutNow();
      engine.applyView(
        layout.pageX - el.scrollLeft,
        layout.pageY(inputsRef.current.activeIndex) - el.scrollTop,
        zoomRef.current
      );
    };

    const setZoomInternal = (z: number) => {
      zoomRef.current = z;
      const layout = layoutNow();
      applyContentSize(layout);
      setZoomState(z);
      return layout;
    };

    /** Share of the viewport (or of the page, when smaller) that a page covers */
    const visibleRatio = (index: number) => {
      const el = scrollRef.current;
      const { viewH } = inputsRef.current;
      if (!el || viewH <= 0) return 0;
      const layout = layoutNow();
      const top = layout.pageY(index) - el.scrollTop;
      const overlap = Math.min(viewH, top + layout.pageH) - Math.max(0, top);
      return Math.max(0, overlap) / Math.max(1, Math.min(layout.pageH, viewH));
    };

    const fit = () => {
      const el = scrollRef.current;
      const inp = inputsRef.current;
      if (!el || inp.viewW <= 0 || inp.viewH <= 0) return;
      const z = Math.max(
        MIN_ZOOM,
        Math.min(
          MAX_FIT_ZOOM,
          (inp.viewW - 2 * M.fitX) / inp.docW,
          (inp.viewH - M.topInset - M.bottomInset - M.headerH - 2 * M.fitY) / inp.docH
        )
      );
      const layout = setZoomInternal(z);
      el.scrollLeft = (layout.contentW - inp.viewW) / 2;
      el.scrollTop =
        layout.headerY(inp.activeIndex) -
        M.topInset -
        (inp.viewH - M.topInset - M.bottomInset - (M.headerH + layout.pageH)) / 2;
      autoFitRef.current = true;
      hasFittedRef.current = true;
      sync();
    };

    const zoomTo = (zoomValue: number, anchor?: { x: number; y: number }) => {
      const el = scrollRef.current;
      const inp = inputsRef.current;
      if (!el || !isFinite(zoomValue)) return;
      const z = clampZoom(zoomValue);
      const oldZoom = zoomRef.current;
      const old = layoutNow();
      const a = anchor || { x: inp.viewW / 2, y: inp.viewH / 2 };
      // Keep the page point under the anchor in place
      const cx = a.x + el.scrollLeft;
      const cy = a.y + el.scrollTop;
      const row = old.rowAt(cy);
      const docX = (cx - old.pageX) / oldZoom;
      const docY = (cy - old.pageY(row)) / oldZoom;
      const layout = setZoomInternal(z);
      el.scrollLeft = layout.pageX + docX * z - a.x;
      el.scrollTop = layout.pageY(row) + docY * z - a.y;
      autoFitRef.current = false;
      sync();
    };

    const controller: CanvasViewportController = {
      attach(engine) {
        engineRef.current = engine;
        if (!hasFittedRef.current) fit();
        else sync();
      },
      detach() {
        engineRef.current = null;
      },
      zoomTo,
      fit,
      scrollBy(dx, dy) {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollLeft += dx;
        el.scrollTop += dy;
        sync();
      },
      locate(point) {
        const el = scrollRef.current;
        if (!el) return null;
        const layout = layoutNow();
        const cx = point.x + el.scrollLeft;
        const cy = point.y + el.scrollTop;
        if (cx < layout.pageX || cx > layout.pageX + layout.pageW) return null;
        const index = layout.rowAt(cy);
        const top = layout.pageY(index);
        if (cy < top || cy > top + layout.pageH) return null;
        return { pageIndex: index, x: (cx - layout.pageX) / layout.zoom, y: (cy - top) / layout.zoom };
      },
      onPageSnapshot(pageId, elements, url, background) {
        setSnapshots((prev) => new Map(prev).set(pageId, { elements, url, background }));
      },
    };
    return { controller, sync, visibleRatio };
  });
  const { controller, sync, visibleRatio } = stack;

  // Hand canvas positioning to this page stack
  useEffect(() => {
    setViewportController(controller);
    return () => setViewportController(null);
  }, [controller, setViewportController]);

  // Track the viewport size (the stage matches it)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      setSize((prev) =>
        prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Viewport resized: keep "fit" mode fitted, otherwise just re-place the stage
  useLayoutEffect(() => {
    if (size.w <= 0 || size.h <= 0) return;
    if (autoFitRef.current && engineRef.current) controller.fit();
    else sync();
  }, [size.w, size.h, controller, sync]);

  // Page list / page size changes move the slots
  useLayoutEffect(() => {
    sync();
  }, [pages.length, inputs.docW, inputs.docH, zoom, sync]);

  // A page activated from elsewhere (page list, add / duplicate / move page) is brought into view
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && !scrollActivatedRef.current && visibleRatio(inputs.activeIndex) < 0.35) {
      const layout = computeStackLayout(zoomRef.current, inputsRef.current);
      const room = inputs.viewH - M.topInset - M.bottomInset;
      const fits = M.headerH + layout.pageH <= room;
      el.scrollTop = fits
        ? layout.headerY(inputs.activeIndex) - M.topInset - (room - (M.headerH + layout.pageH)) / 2
        : layout.headerY(inputs.activeIndex) - M.topInset;
    }
    scrollActivatedRef.current = false;
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.activeIndex]);

  useEffect(
    () => () => {
      if (activeCheckTimer.current) clearTimeout(activeCheckTimer.current);
    },
    []
  );

  const handleScroll = () => {
    sync();
    // Scrolling another page into view makes it the current page (like Canva's page counter)
    if (activeCheckTimer.current) clearTimeout(activeCheckTimer.current);
    activeCheckTimer.current = setTimeout(() => {
      activeCheckTimer.current = null;
      const inp = inputsRef.current;
      if (inp.pageCount < 2 || engineRef.current?.isInteracting()) return;
      if (visibleRatio(inp.activeIndex) >= 0.35) return;
      let best = inp.activeIndex;
      let bestRatio = visibleRatio(best);
      for (let i = 0; i < inp.pageCount; i++) {
        const r = visibleRatio(i);
        if (r > bestRatio + 0.01) {
          best = i;
          bestRatio = r;
        }
      }
      if (best !== inp.activeIndex) {
        scrollActivatedRef.current = true;
        onSelectPageRef.current(best);
      }
    }, 160);
  };

  const layout = computeStackLayout(zoom, inputs);
  const ready = size.w > 0 && size.h > 0;

  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "var(--canvas-bg, #f0f1f5)",
      }}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ position: "absolute", inset: 0, overflow: "auto", overscrollBehavior: "contain" }}
      >
        <div
          ref={contentRef}
          style={{
            position: "relative",
            width: ready ? layout.contentW : "100%",
            height: ready ? layout.contentH : "100%",
          }}
        >
          {/* Live canvas: viewport-sized, stays put while the pages scroll underneath */}
          <div
            ref={containerRef}
            style={{
              position: "sticky",
              top: 0,
              left: 0,
              width: ready ? size.w : "100%",
              height: ready ? size.h : "100%",
              zIndex: 1,
              outline: "none",
            }}
          />

          {ready &&
            pages.map((page, index) => (
              <React.Fragment key={page.id}>
                <PageHeader
                  index={index}
                  page={page}
                  pageCount={pages.length}
                  isActive={index === inputs.activeIndex}
                  isReadOnly={isReadOnly}
                  style={{
                    position: "absolute",
                    left: layout.headerX,
                    top: layout.headerY(index),
                    width: layout.headerW,
                    height: M.headerH,
                    zIndex: 2,
                  }}
                  onSelect={() => onSelectPage(index)}
                  onMoveUp={() => onMovePage(index, index - 1)}
                  onMoveDown={() => onMovePage(index, index + 1)}
                  onDuplicate={() => onDuplicatePage(index)}
                  onDelete={() => onDeletePage(index)}
                  onAddAfter={() => onAddPage(index)}
                  onRename={(name) => onRenamePage(index, name)}
                />
                <div
                  aria-label={`Page ${index + 1}`}
                  style={{
                    position: "absolute",
                    left: layout.pageX,
                    top: layout.pageY(index),
                    width: layout.pageW,
                    height: layout.pageH,
                    backgroundColor: getPageBackground(doc, index),
                    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.08)",
                    overflow: "hidden",
                    zIndex: 0,
                    pointerEvents: "none",
                  }}
                >
                  {index !== inputs.activeIndex && (
                    <InactivePagePreview
                      page={page}
                      snapshot={snapshots.get(page.id)}
                      docWidth={inputs.docW}
                      docHeight={inputs.docH}
                      backgroundColor={getPageBackground(doc, index)}
                    />
                  )}
                </div>
              </React.Fragment>
            ))}

          {ready && !isReadOnly && (
            <AddPageButton
              onClick={() => onAddPage()}
              style={{
                position: "absolute",
                left: layout.headerX,
                top: layout.addY,
                width: layout.headerW,
                height: M.addH,
                zIndex: 2,
              }}
            />
          )}
        </div>
      </div>

      {children}
    </div>
  );
};

/** Pages that are not live show the image captured when they were left (or a vector preview) */
const InactivePagePreview: React.FC<{
  page: Page;
  snapshot?: { elements: DesignElement[]; url: string; background?: string };
  docWidth: number;
  docHeight: number;
  backgroundColor: string;
}> = ({ page, snapshot, docWidth, docHeight, backgroundColor }) => {
  // The captured image is only current while neither the content nor the color changed
  if (snapshot && snapshot.elements === page.elements && snapshot.background === backgroundColor) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={snapshot.url}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    );
  }
  return (
    <PageThumbnailPreview
      page={page}
      docWidth={docWidth}
      docHeight={docHeight}
      backgroundColor={backgroundColor}
      preferVector
    />
  );
};

// ==========================================
// Page header: "Page 2 - Add page title" + page actions
// ==========================================

interface PageHeaderProps {
  index: number;
  page: Page;
  pageCount: number;
  isActive: boolean;
  isReadOnly: boolean;
  style: React.CSSProperties;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddAfter: () => void;
  onRename: (name: string) => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  index,
  page,
  pageCount,
  isActive,
  isReadOnly,
  style,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onAddAfter,
  onRename,
}) => {
  const title = isDefaultPageName(page.name) ? "" : (page.name || "").trim();
  const [draft, setDraft] = useState(title);
  const [isEditing, setIsEditing] = useState(false);

  const commit = () => {
    setIsEditing(false);
    if (draft.trim() !== title) onRename(draft.trim());
  };

  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px",
        // Only the controls take clicks, so selection handles behind the header stay usable
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          flex: 1,
          gap: "4px",
          fontSize: "14px",
          color: "var(--foreground, #0f172a)",
        }}
      >
        <button
          type="button"
          onClick={onSelect}
          style={{
            pointerEvents: "auto",
            border: "none",
            background: "transparent",
            padding: "4px 2px",
            fontSize: "14px",
            fontWeight: 600,
            color: isActive ? "var(--foreground, #0f172a)" : "var(--foreground-muted, #64748b)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          title={`Go to page ${index + 1}`}
        >
          Page {index + 1}
        </button>
        {(title || !isReadOnly) && (
          <span style={{ color: "var(--foreground-muted, #64748b)", flexShrink: 0 }}>-</span>
        )}
        {isReadOnly ? (
          title && (
            <span
              style={{
                color: "var(--foreground-secondary, #334155)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </span>
          )
        ) : (
          <input
            value={isEditing ? draft : title}
            placeholder="Add page title"
            onFocus={() => {
              setDraft(title);
              setIsEditing(true);
            }}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(title);
                setIsEditing(false);
                requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
              }
            }}
            aria-label={`Page ${index + 1} title`}
            className="page-title-input"
            style={{
              pointerEvents: "auto",
              minWidth: 0,
              flex: 1,
              maxWidth: "320px",
              border: "1px solid transparent",
              borderRadius: "6px",
              background: "transparent",
              padding: "4px 6px",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--foreground-secondary, #334155)",
              outline: "none",
            }}
          />
        )}
      </div>

      {!isReadOnly && (
        <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
          <HeaderIconButton label="Move page up" disabled={index === 0} onClick={onMoveUp}>
            <ChevronUp size={18} />
          </HeaderIconButton>
          <HeaderIconButton label="Move page down" disabled={index >= pageCount - 1} onClick={onMoveDown}>
            <ChevronDown size={18} />
          </HeaderIconButton>
          <HeaderIconButton label="Duplicate page" onClick={onDuplicate}>
            <DuplicateIcon size={18} />
          </HeaderIconButton>
          <HeaderIconButton label="Delete page" disabled={pageCount <= 1} onClick={onDelete}>
            <DeleteIcon size={18} />
          </HeaderIconButton>
          <HeaderIconButton label="Add page after this one" onClick={onAddAfter}>
            <AddPageIcon size={18} />
          </HeaderIconButton>
        </div>
      )}
    </div>
  );
};

const HeaderIconButton: React.FC<{
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, disabled, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className="page-header-icon"
    style={{
      pointerEvents: "auto",
      width: "32px",
      height: "32px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "none",
      borderRadius: "6px",
      background: "transparent",
      color: disabled ? "var(--foreground-dim, #94a3b8)" : "var(--foreground-secondary, #334155)",
      opacity: disabled ? 0.5 : 1,
      cursor: disabled ? "default" : "pointer",
    }}
  >
    {children}
  </button>
);

const AddPageButton: React.FC<{ onClick: () => void; style: React.CSSProperties }> = ({ onClick, style }) => (
  <button
    type="button"
    onClick={onClick}
    className="add-page-button"
    style={{
      ...style,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      border: "1px solid var(--border-strong, #cbd5e1)",
      borderRadius: "8px",
      background: "transparent",
      color: "var(--foreground, #0f172a)",
      fontSize: "15px",
      fontWeight: 600,
      cursor: "pointer",
    }}
  >
    <Plus size={18} strokeWidth={2.5} />
    Add page
  </button>
);

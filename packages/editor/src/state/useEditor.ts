"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  DesignDocument,
  DesignElement,
  Asset,
  DesignRepository,
  TextProperties,
} from "@design-platform/types";
import { EditorStore, EditorState } from "./EditorStore";
import { CanvasEngine, CanvasViewportController } from "../canvas/CanvasEngine";
import { fetchSvgMarkup, SvgMatrix } from "../canvas/svgUtils";
import type { FlipAxis } from "../canvas/svgFlip";

export interface UseEditorOptions {
  initialDocument: DesignDocument;
  repository?: DesignRepository;
  isReadOnly?: boolean;
}

export function useEditor({ initialDocument, repository, isReadOnly = false }: UseEditorOptions) {
  const storeRef = useRef<EditorStore>(new EditorStore(initialDocument));
  const engineRef = useRef<CanvasEngine | null>(null);
  const viewportControllerRef = useRef<CanvasViewportController | null>(null);

  /** Makes a page the active (live, editable) page in both the store and the canvas */
  const activatePage = (index: number) => {
    const safeIndex = typeof index === "number" && !isNaN(index) ? index : 0;
    storeRef.current.setActivePageIndex(safeIndex);
    engineRef.current?.setActivePageIndex(storeRef.current.getActivePageIndex());
  };
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<EditorState>(() => storeRef.current.getState());
  /** Right-click menu position (viewport pixels); what it offers follows the selection */
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  /**
   * A click that selects the main group around the current (deeper) selection is held back
   * for the double-click window: if it turns out to be the first half of a double-click, the
   * double-click drills deeper from the current selection instead.
   */
  const pendingClickRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPendingClick = () => {
    if (pendingClickRef.current) {
      clearTimeout(pendingClickRef.current);
      pendingClickRef.current = null;
    }
  };

  /**
   * Illustrator / Canva-style click selection inside SVG illustrations:
   * - not inside an illustration: a click selects the whole element
   * - inside an open illustration: a click always selects the main group under the cursor,
   *   even when a part inside that group is selected (double-click goes deeper)
   * - Cmd/Ctrl+click: selects the deepest layer under the cursor directly
   * - clicking a transparent spot or another element leaves the illustration
   */
  const routeCanvasClick = (
    id: string | null,
    point: { x: number; y: number } | undefined,
    deep: boolean,
    shift = false
  ) => {
    cancelPendingClick();
    const store = storeRef.current;
    const engine = engineRef.current;
    if (!id) {
      store.selectFromCanvas(null);
      return;
    }
    const el = store.getElementById(id);
    if (!el) return;
    // Shift-click adds / removes elements from the selection
    if (shift && !store.getGroupEditSession()) {
      store.toggleInSelection(id);
      return;
    }
    if (deep && el.type === "svg" && point && engine) {
      deepSelectLayer(id, point);
      return;
    }
    const nav = store.getLayerNav();
    if (!nav || nav.elementId !== id || !point || !engine) {
      store.selectFromCanvas(id);
      return;
    }
    const idx = engine.hitTestLayers(id, point, store.getLayerGeoms(id, []));
    if (idx === null) {
      // Transparent spot of the open illustration: leave it and select what is underneath
      store.selectFromCanvas(engine.elementAtPoint(point, id));
      return;
    }
    const selected = nav.selectedPath;
    if (selected && selected.length > 1 && selected[0] === idx) {
      // Back to the main group that holds the selected part
      const selectedKey = selected.join("/");
      pendingClickRef.current = setTimeout(() => {
        pendingClickRef.current = null;
        const current = storeRef.current.getLayerNav();
        if (engineRef.current?.isInteracting()) return;
        if (!current || current.elementId !== id || current.selectedPath?.join("/") !== selectedKey) return;
        storeRef.current.setLayerNav(id, [], [idx]);
      }, engine.getDoubleClickWindow() + 20);
      return;
    }
    store.setLayerNav(id, [], [idx]);
  };

  /**
   * Right-click picks its target first, like Canva / Figma:
   * - an element that is already selected keeps the (multi-)selection
   * - inside an open illustration, the selected part is kept when the click lands in its
   *   main group; otherwise the main group under the cursor is selected
   * - empty canvas clears the selection (the menu then offers paste / select all)
   */
  const routeContextMenu = (id: string | null, point: { x: number; y: number } | undefined) => {
    cancelPendingClick();
    const store = storeRef.current;
    const engine = engineRef.current;
    if (!id) {
      if (store.getSelectedIds().length > 0 || store.getLayerNav()) store.selectFromCanvas(null);
      return;
    }
    const nav = store.getLayerNav();
    if (nav && nav.elementId === id) {
      if (!point || !engine) return;
      const idx = engine.hitTestLayers(id, point, store.getLayerGeoms(id, []));
      if (idx === null) return;
      if (nav.selectedPath && nav.selectedPath[0] === idx) return;
      store.setLayerNav(id, [], [idx]);
      return;
    }
    if (store.getSelectedIds().includes(id) && !nav) return;
    store.selectFromCanvas(id);
  };

  const deepSelectLayer = (id: string, point: { x: number; y: number }) => {
    const store = storeRef.current;
    const engine = engineRef.current;
    if (!engine) return;
    let container: number[] = [];
    let found: number[] | null = null;
    for (let depth = 0; depth < 32; depth++) {
      const layers = store.getLayerGeoms(id, container);
      if (container.length === 0 && layers.length < 2) break;
      const idx = engine.hitTestLayers(id, point, layers);
      if (idx === null) break;
      found = [...container, idx];
      if (!layers[idx]!.isGroup) break;
      container = found;
    }
    if (found) store.setLayerNav(id, found.slice(0, -1), found);
    else store.selectFromCanvas(id);
  };

  /**
   * Double-click goes one level deeper under the cursor:
   * - whole illustration selected: selects the main group under the cursor
   * - a group selected: selects the part inside it under the cursor (repeat for deeper nesting)
   * - double-clicking another part of an already-open group selects that part
   */
  const routeCanvasDoubleClick = (id: string, point: { x: number; y: number } | undefined) => {
    cancelPendingClick();
    const store = storeRef.current;
    const engine = engineRef.current;
    if (!id) {
      if (store.getLayerNav()) store.exitAllGroupEdits();
      return;
    }
    const el = store.getElementById(id);
    if (el?.type === "text") {
      store.selectElement(id);
      engine?.editText(id);
      return;
    }
    if (!el || el.type !== "svg") return;
    const props = el.properties as { svgContent?: string; originalSvg?: string };
    if (!(props.svgContent || props.originalSvg || "").includes("<svg") || !engine || !point) {
      // Remote SVG (or no pointer): let the store resolve markup and pick by bounds
      store.enterGroupEdit(id, point).catch((err) => console.warn("[useEditor] Failed to open group:", err));
      return;
    }
    const nav = store.getLayerNav();
    if (!nav || nav.elementId !== id) {
      const layers = store.getLayerGeoms(id, []);
      if (layers.length < 2) return; // a single shape: nothing to open
      const idx = engine.hitTestLayers(id, point, layers);
      store.setLayerNav(id, [], idx !== null ? [idx] : null);
      return;
    }

    // Walk up from the selection to the deepest layer under the cursor, then open it one level
    const selected = nav.selectedPath || [];
    for (let depth = selected.length; depth >= 0; depth--) {
      const base = selected.slice(0, depth);
      if (depth > 0) {
        const geom = store.getLayerGeom(id, base);
        if (!geom) continue;
        if (!geom.isGroup) {
          // Double-click on the selected single shape: nothing deeper to open
          if (depth === selected.length && engine.hitTestLayers(id, point, [geom]) !== null) return;
          continue;
        }
      }
      const children = store.getLayerGeoms(id, base);
      const idx = engine.hitTestLayers(id, point, children);
      if (idx === null) continue;
      if (depth === 0 && children[idx]!.isGroup) {
        // A main group outside the current selection: open it right away
        const inner = engine.hitTestLayers(id, point, store.getLayerGeoms(id, [idx]));
        store.setLayerNav(id, inner !== null ? [idx] : [], inner !== null ? [idx, inner] : [idx]);
        return;
      }
      store.setLayerNav(id, base, [...base, idx]);
      return;
    }
  };

  // Subscribe React state to Store updates
  useEffect(() => {
    let lastDoc = storeRef.current.getDocument();
    let lastSelectionKey = storeRef.current.getSelectedIds().join("|");
    let lastActivePageIndex = storeRef.current.getActivePageIndex();

    const unsubscribe = storeRef.current.subscribe((newState: EditorState) => {
      setState(newState);
      // Synchronize CanvasEngine with updated document and active page
      if (engineRef.current) {
        const docChanged = newState.document !== lastDoc;
        const pageChanged = newState.activePageIndex !== lastActivePageIndex;
        if (docChanged || pageChanged) {
          lastDoc = newState.document;
          lastActivePageIndex = newState.activePageIndex;
          engineRef.current.renderDocument(newState.document, newState.activePageIndex);
        }
        const selectionKey = newState.selectedIds.join("|");
        if (selectionKey !== lastSelectionKey) {
          lastSelectionKey = selectionKey;
          if (newState.selectedIds.length && !isReadOnly) {
            engineRef.current.setSelection(newState.selectedIds);
          } else {
            engineRef.current.deselect();
          }
        }
        // Open group / selected layer inside an SVG (memoized by the store: cheap no-op if unchanged)
        engineRef.current.setLayerEditContext(isReadOnly ? null : storeRef.current.getLayerEditContext());
      }
    });

    return unsubscribe;
  }, [isReadOnly]);

  // Synchronize dynamic read-only changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setReadOnly(Boolean(isReadOnly));
    }
  }, [isReadOnly]);

  // Initialize CanvasEngine once DOM container mounts
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new CanvasEngine(containerRef.current, {
      onSelect: (id, pagePoint, modifiers) => {
        if (!isReadOnly) routeCanvasClick(id, pagePoint, Boolean(modifiers?.deep), Boolean(modifiers?.shift));
      },
      onPointerDown: () => {
        cancelPendingClick();
        setContextMenu(null);
      },
      onContextMenu: ({ elementId, client, pagePoint }) => {
        if (isReadOnly) return;
        routeContextMenu(elementId, pagePoint);
        setContextMenu({ x: client.x, y: client.y });
      },
      onLayerTransform: (elementId, path, delta) => {
        cancelPendingClick();
        if (isReadOnly || delta.length < 6) return;
        storeRef.current.transformLayer(elementId, path, delta.slice(0, 6) as SvgMatrix);
      },
      onElementChange: (id, updates) => {
        if (!isReadOnly) storeRef.current.updateElement(id, updates);
      },
      onDropAsset: (asset, position, pageIndex) => {
        if (!isReadOnly) {
          if (typeof pageIndex === "number") activatePage(pageIndex);
          // Elements / Text panel items carry a ready element template: center it on the drop point
          const template = (asset as unknown as { elementTemplate?: Omit<DesignElement, "id" | "x" | "y"> })
            .elementTemplate;
          if (template) {
            storeRef.current.addElement({
              ...template,
              id: `elem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              x: Math.round(position.x - template.width / 2),
              y: Math.round(position.y - template.height / 2),
            });
            return;
          }
          const newElement = storeRef.current.createFromAsset(asset, position);
          storeRef.current.addElement(newElement);

          const sourceUrl =
            asset.url || (asset.source?.startsWith("http") ? asset.source : undefined);
          if (sourceUrl && (asset.type === "svg" || !asset.contentType || asset.contentType.includes("svg"))) {
            fetchSvgMarkup(sourceUrl).then((markup) => {
              if (markup) {
                storeRef.current.resolveAssetSvgMarkup(newElement.id, markup);
              }
            });
          }
        }
      },
      onDoubleClick: (elementId, pagePoint) => {
        if (!isReadOnly) routeCanvasDoubleClick(elementId, pagePoint);
      },
      onZoomChange: (newZoom) => {
        storeRef.current.setZoom(newZoom);
      },
      onActivatePage: (pageIndex) => activatePage(pageIndex),
      onElementAutoSize: (id, updates) => storeRef.current.updateElement(id, updates, true),
      onElementDelete: (id) => {
        if (!isReadOnly) storeRef.current.deleteElement(id);
      },
      onElementsChange: (batch) => {
        if (!isReadOnly) storeRef.current.updateElements(batch);
      },
      onMarqueeSelect: (ids, additive) => {
        if (isReadOnly) return;
        const store = storeRef.current;
        store.setSelection(additive ? [...store.getSelectedIds(), ...ids] : ids);
      },
      isReadOnly,
    });

    engineRef.current = engine;
    if (viewportControllerRef.current) engine.setViewportController(viewportControllerRef.current);
    engine.renderDocument(storeRef.current.getDocument());

    // Window resize observer
    const resizeObserver = new ResizeObserver(() => {
      engine.handleResize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelPendingClick();
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Save handler
  const save = useCallback(async () => {
    if (!repository) return;
    try {
      const thumbnail = engineRef.current ? engineRef.current.exportThumbnail(0.5) : undefined;
      await storeRef.current.save(repository, thumbnail);
    } catch (err) {
      console.warn("[useEditor] Save failed:", (err as Error)?.message || err);
    }
  }, [repository]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const isMac =
        typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Undo: Cmd/Ctrl + Z
      if (isCmdOrCtrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        storeRef.current.undo();
        return;
      }

      // Redo: Cmd/Ctrl + Shift + Z or Ctrl + Y
      if (
        (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z") ||
        (!isMac && e.ctrlKey && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        storeRef.current.redo();
        return;
      }

      // Copy: Cmd/Ctrl + C
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        storeRef.current.copySelection();
        return;
      }

      // Paste: Cmd/Ctrl + V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        storeRef.current.pasteSelection();
        return;
      }

      // Cut: Cmd/Ctrl + X
      if (isCmdOrCtrl && e.key.toLowerCase() === "x" && !storeRef.current.getLayerNav()?.selectedPath) {
        e.preventDefault();
        storeRef.current.cutSelection();
        return;
      }

      // Lock / unlock: Cmd/Ctrl + L
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "l") {
        if (storeRef.current.getSelectedIds().length > 0) {
          e.preventDefault();
          storeRef.current.toggleLockSelection();
        }
        return;
      }

      // Flip: Shift + H (horizontal) / Shift + V (vertical)
      if (e.shiftKey && !isCmdOrCtrl && !e.altKey && (e.code === "KeyH" || e.code === "KeyV")) {
        const axis = e.code === "KeyH" ? "horizontal" : "vertical";
        if (storeRef.current.getLayerNav()?.selectedPath) {
          e.preventDefault();
          storeRef.current.flipSelectedLayer(axis);
          return;
        }
        if (storeRef.current.getSelectedIds().length > 0) {
          e.preventDefault();
          storeRef.current.flipSelection(axis);
          return;
        }
      }

      // Layer order: Cmd/Ctrl + ] forward, + [ backward; with Alt: to front / to back
      if (isCmdOrCtrl && (e.code === "BracketRight" || e.code === "BracketLeft")) {
        const store = storeRef.current;
        const selected = store.getSelectedElement();
        if (!selected || store.getSelectedIds().length !== 1 || store.getLayerNav()?.selectedPath) return;
        e.preventDefault();
        const up = e.code === "BracketRight";
        if (e.altKey) {
          if (up) store.bringToFront(selected.id);
          else store.sendToBack(selected.id);
        } else if (up) store.bringForward(selected.id);
        else store.sendBackward(selected.id);
        return;
      }

      // Duplicate: Cmd/Ctrl + D
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        storeRef.current.duplicateSelection();
        return;
      }

      // Save: Cmd/Ctrl + S
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
        return;
      }

      // Zoom In: Cmd/Ctrl + Plus / Equal
      if (isCmdOrCtrl && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        if (engineRef.current) engineRef.current.zoomIn();
        return;
      }

      // Zoom Out: Cmd/Ctrl + Minus
      if (isCmdOrCtrl && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        if (engineRef.current) engineRef.current.zoomOut();
        return;
      }

      // Reset Zoom: Cmd/Ctrl + 0
      if (isCmdOrCtrl && e.key === "0") {
        e.preventDefault();
        if (engineRef.current) engineRef.current.resetZoom();
        return;
      }

      // Fit to Screen: Cmd/Ctrl + 9 or Shift + 1
      if ((isCmdOrCtrl && e.key === "9") || (e.shiftKey && e.key === "1")) {
        e.preventDefault();
        if (engineRef.current) engineRef.current.fitToScreen();
        return;
      }

      // Select all: Cmd/Ctrl + A
      if (isCmdOrCtrl && e.key.toLowerCase() === "a" && !storeRef.current.getGroupEditSession()) {
        e.preventDefault();
        storeRef.current.selectAll();
        return;
      }

      // Group the selected illustrations: Cmd/Ctrl + G
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "g") {
        const selected = storeRef.current.getSelectedElements();
        if (selected.length > 1 && selected.every((el) => el.type === "svg")) {
          e.preventDefault();
          storeRef.current.groupElements(selected.map((el) => el.id));
          return;
        }
      }

      // Escape: leave the innermost open group, otherwise clear the selection
      if (e.key === "Escape") {
        if (storeRef.current.getGroupEditSession()) {
          e.preventDefault();
          storeRef.current.exitGroupEdit();
          return;
        }
        if (storeRef.current.getSelectedIds().length > 0) {
          e.preventDefault();
          storeRef.current.selectElement(null);
          return;
        }
      }

      // Enter: open the selected illustration / group and select its first layer
      if (e.key === "Enter" && !isCmdOrCtrl && !e.shiftKey) {
        const selected = storeRef.current.getSelectedElement();
        // Enter on a text element starts typing (like Canva)
        if (selected && selected.type === "text" && engineRef.current) {
          e.preventDefault();
          engineRef.current.editText(selected.id);
          return;
        }
        if (selected && selected.type === "svg" && storeRef.current.canEnterGroup(selected.id)) {
          e.preventDefault();
          storeRef.current.enterGroupEdit(selected.id);
          return;
        }
      }
      // Shift+Enter: select the parent group (same as Esc)
      if (e.key === "Enter" && e.shiftKey && storeRef.current.getLayerNav()) {
        e.preventDefault();
        storeRef.current.exitGroupEdit();
        return;
      }

      // Ungroup: Cmd/Ctrl + Shift + G
      if (isCmdOrCtrl && e.shiftKey && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        storeRef.current.ungroupSelectedElement();
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (storeRef.current.getSelectedIds().length > 1) storeRef.current.deleteSelection();
        else storeRef.current.deleteElement();
        return;
      }

      // Nudge position with arrow keys
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const selected = storeRef.current.getSelectedElement();
        if (selected && storeRef.current.getLayerNav()?.selectedPath) {
          // Nudge the selected layer inside the illustration
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          storeRef.current.transformSelectedLayer([1, 0, 0, 1, dx, dy]);
          return;
        }
        if (storeRef.current.getSelectedIds().length > 1) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          storeRef.current.nudgeSelection(
            e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
            e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0
          );
          return;
        }
        if (selected) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          let deltaX = 0;
          let deltaY = 0;

          if (e.key === "ArrowUp") deltaY = -step;
          if (e.key === "ArrowDown") deltaY = step;
          if (e.key === "ArrowLeft") deltaX = -step;
          if (e.key === "ArrowRight") deltaX = step;

          storeRef.current.updateElement(selected.id, {
            x: selected.x + deltaX,
            y: selected.y + deltaY,
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save]);

  // Element actions
  const addAssetToCenter = useCallback(
    (asset: Asset, customPosition?: { x: number; y: number }) => {
      const doc = storeRef.current.getDocument();
      const position = customPosition || {
        x: Math.round(doc.width / 2 - (asset.defaultWidth || 120) / 2),
        y: Math.round(doc.height / 2 - (asset.defaultHeight || 120) / 2),
      };
      const element = storeRef.current.createFromAsset(asset, position);
      storeRef.current.addElement(element);

      // If asset source is a remote URL, asynchronously fetch and resolve the raw vector SVG markup
      const sourceUrl =
        asset.url || (asset.source?.startsWith("http") ? asset.source : undefined);
      if (sourceUrl && asset.type === "svg") {
        fetchSvgMarkup(sourceUrl).then((markup) => {
          if (markup) {
            storeRef.current.resolveAssetSvgMarkup(element.id, markup);
          }
        });
      }
    },
    []
  );

  /**
   * Inserts a new element (centered on the page unless a position is given) and selects it.
   * Used by the Elements and Text panels.
   */
  const insertElement = useCallback(
    (template: Omit<DesignElement, "id" | "x" | "y"> & { x?: number; y?: number }) => {
      const doc = storeRef.current.getDocument();
      const element: DesignElement = {
        ...template,
        id: `elem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        x: template.x ?? Math.round(doc.width / 2 - template.width / 2),
        y: template.y ?? Math.round(doc.height / 2 - template.height / 2),
      };
      storeRef.current.addElement(element);
      return element;
    },
    []
  );

  const addShape = useCallback((shapeType: "rectangle" | "circle" | "line") => {
    const doc = storeRef.current.getDocument();
    const id = `elem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const position = {
      x: Math.round(doc.width / 2 - 80),
      y: Math.round(doc.height / 2 - 50),
    };

    let newElement: DesignElement;

    if (shapeType === "circle") {
      newElement = {
        id,
        type: "shape",
        name: "Circle",
        x: position.x,
        y: position.y,
        width: 120,
        height: 120,
        rotation: 0,
        opacity: 1,
        properties: {
          shapeType: "circle",
          fill: "#3b82f6",
          stroke: "transparent",
          strokeWidth: 0,
        },
      };
    } else if (shapeType === "line") {
      newElement = {
        id,
        type: "shape",
        name: "Line",
        x: position.x,
        y: position.y,
        width: 160,
        height: 0,
        rotation: 0,
        opacity: 1,
        properties: {
          shapeType: "line",
          fill: "#3b82f6",
          strokeWidth: 4,
        },
      };
    } else {
      newElement = {
        id,
        type: "shape",
        name: "Rectangle",
        x: position.x,
        y: position.y,
        width: 160,
        height: 100,
        rotation: 0,
        opacity: 1,
        properties: {
          shapeType: "rectangle",
          fill: "#3b82f6",
          stroke: "transparent",
          strokeWidth: 0,
          cornerRadius: 6,
        },
      };
    }

    storeRef.current.addElement(newElement);
  }, []);

  const addText = useCallback((variant: "heading" | "subheading" | "body" | "label") => {
    const doc = storeRef.current.getDocument();
    const id = `elem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const position = {
      x: Math.round(doc.width / 2 - 120),
      y: Math.round(doc.height / 2 - 30),
    };

    let textProps: TextProperties = {
      text: "Heading Title",
      fontSize: 32,
      fontFamily: "Inter, -apple-system, sans-serif",
      fill: "#18181b",
      fontWeight: "bold",
      align: "center",
    };

    if (variant === "subheading") {
      textProps = {
        text: "Subheading Text",
        fontSize: 20,
        fontFamily: "Inter, -apple-system, sans-serif",
        fill: "#3f3f46",
        fontWeight: "600",
        align: "center",
      };
    } else if (variant === "body") {
      textProps = {
        text: "Add body description text here...",
        fontSize: 15,
        fontFamily: "Inter, -apple-system, sans-serif",
        fill: "#475569",
        fontWeight: "normal",
        align: "left",
      };
    } else if ((variant as string) === "label") {
      textProps = {
        text: "Fig. 1 — Cellular Receptor",
        fontSize: 13,
        fontFamily: "Inter, -apple-system, sans-serif",
        fill: "#0f172a",
        fontWeight: "bold",
        align: "center",
      };
    }

    const newElement: DesignElement = {
      id,
      type: "text",
      name: (variant as string) === "label" ? "Caption / Label" : "Text",
      x: position.x,
      y: position.y,
      width: (variant as string) === "label" ? 220 : 260,
      height: (variant as string) === "label" ? 36 : 60,
      rotation: 0,
      opacity: 1,
      properties: textProps,
    };

    storeRef.current.addElement(newElement);
  }, []);

  // Zoom controls
  const setZoom = useCallback((zoom: number) => {
    storeRef.current.setZoom(zoom);
    if (engineRef.current) {
      engineRef.current.setZoom(zoom);
    }
  }, []);

  const zoomIn = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.zoomIn();
    } else {
      const current = storeRef.current.getState().zoom;
      setZoom(Math.min(5, Math.round((current + 0.15) * 100) / 100));
    }
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.zoomOut();
    } else {
      const current = storeRef.current.getState().zoom;
      setZoom(Math.max(0.1, Math.round((current - 0.15) * 100) / 100));
    }
  }, [setZoom]);

  const fitToScreen = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.fitToScreen();
    }
  }, []);

  const resetZoom = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resetZoom();
    } else {
      setZoom(1);
    }
  }, [setZoom]);

  const setViewportController = useCallback((controller: CanvasViewportController | null) => {
    viewportControllerRef.current = controller;
    engineRef.current?.setViewportController(controller);
  }, []);

  const centerPage = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.centerPage();
    }
  }, []);

  return {
    containerRef,
    state,
    store: storeRef.current,
    engine: engineRef.current,
    selectedElement: storeRef.current.getSelectedElement(),
    save,
    // Element actions
    addAssetToCenter,
    addShape,
    addText,
    insertElement,
    // Multi-selection
    selectedIds: state.selectedIds,
    setSelection: (ids: string[]) => storeRef.current.setSelection(ids),
    toggleInSelection: (id: string) => storeRef.current.toggleInSelection(id),
    selectAll: () => storeRef.current.selectAll(),
    alignSelection: (edge: "left" | "center" | "right" | "top" | "middle" | "bottom") =>
      storeRef.current.alignSelection(edge),
    distributeSelection: (axis: "horizontal" | "vertical") => storeRef.current.distributeSelection(axis),
    deleteSelection: () => storeRef.current.deleteSelection(),
    // Right-click menu
    contextMenu,
    openContextMenu: (x: number, y: number) => setContextMenu({ x, y }),
    closeContextMenu: () => setContextMenu(null),
    cutSelection: () => storeRef.current.cutSelection(),
    copySelection: () => storeRef.current.copySelection(),
    pasteSelection: () => storeRef.current.pasteSelection(),
    hasClipboard: () => storeRef.current.hasClipboard(),
    flipSelection: (axis: FlipAxis) => storeRef.current.flipSelection(axis),
    flipSelectedLayer: (axis: FlipAxis) => storeRef.current.flipSelectedLayer(axis),
    canFlip: (el: DesignElement | null | undefined, axis?: FlipAxis) => storeRef.current.canFlip(el, axis),
    toggleLockSelection: () => storeRef.current.toggleLockSelection(),
    alignSelectionToPage: (edge: "left" | "center" | "right" | "top" | "middle" | "bottom") =>
      storeRef.current.alignSelectionToPage(edge),
    duplicateSelectedLayer: () => storeRef.current.duplicateSelectedLayer(),
    duplicateSelection: () => storeRef.current.duplicateSelection(),
    updateElements: (batch: Array<{ id: string; updates: Partial<DesignElement> }>) =>
      storeRef.current.updateElements(batch),
    groupSelection: () => {
      const ids = storeRef.current.getSelectedIds();
      return ids.length > 1 ? storeRef.current.groupElements(ids) : null;
    },
    /** Moves an element to a position in the page's stacking order (0 = bottom) */
    moveElementTo: (id: string, index: number) => storeRef.current.moveElementTo(id, index),
    /** Starts typing into a text element on the canvas */
    editText: (id: string) => {
      const engine = engineRef.current;
      // A just-inserted element is drawn asynchronously: start typing once it exists
      if (engine) engine.waitForRender().then(() => engine.editText(id));
    },
    updateElement: (id: string, updates: Partial<DesignElement>) =>
      storeRef.current.updateElement(id, updates),
    deleteElement: (id?: string) => storeRef.current.deleteElement(id),
    duplicateElement: (id?: string) => storeRef.current.duplicateElement(id),
    bringForward: (id?: string) => storeRef.current.bringForward(id),
    sendBackward: (id?: string) => storeRef.current.sendBackward(id),
    bringToFront: (id?: string) => storeRef.current.bringToFront(id),
    sendToBack: (id?: string) => storeRef.current.sendToBack(id),
    selectElement: (id: string | null) => {
      storeRef.current.selectElement(id);
      if (engineRef.current) {
        if (id) engineRef.current.select(id);
        else engineRef.current.deselect();
      }
    },
    updateSelectedSvgColor: (fill?: string, stroke?: string, strokeWidth?: number) =>
      storeRef.current.updateSelectedSvgColor(fill, stroke, strokeWidth),
    updateSelectedSvgColorMap: (colorMap: Record<string, string>) =>
      storeRef.current.updateSelectedSvgColorMap(colorMap),
    updateSelectedSvgComponentColor: (
      componentIdOrIndex: string | number,
      colors: { fill?: string; stroke?: string }
    ) => storeRef.current.updateSelectedSvgComponentColor(componentIdOrIndex, colors),
    applyScientificPreset: (
      presetIdOrPreset: string,
      componentIdOrIndex?: string | number
    ) => storeRef.current.applyScientificPresetToSelected(presetIdOrPreset, componentIdOrIndex),
    distributeSvgComponents: () => storeRef.current.distributeSelectedSvgComponentsAsync(),
    groupEditSession: state.groupEditSession,
    enterGroupEdit: (elementId?: string) => storeRef.current.enterGroupEdit(elementId),
    exitGroupEdit: () => storeRef.current.exitGroupEdit(),
    exitAllGroupEdits: () => storeRef.current.exitAllGroupEdits(),
    deleteSelectedLayer: () => storeRef.current.deleteSelectedLayer(),
    ungroupSelectedLayer: () => storeRef.current.ungroupSelectedLayer(),
    canEnterGroup: (elementId: string) => storeRef.current.canEnterGroup(elementId),
    groupElements: (elementIds: string[]) => storeRef.current.groupElements(elementIds),
    ungroupSelected: () => storeRef.current.ungroupSelectedElement(),
    resetSelectedSvgColors: () => storeRef.current.resetSelectedSvgColors(),
    /** Background of every page */
    setCanvasBackgroundColor: (color: string) => storeRef.current.setCanvasBackgroundColor(color),
    /** Background of one page (the active page by default) */
    setPageBackgroundColor: (color: string, pageIndex?: number) =>
      storeRef.current.setPageBackgroundColor(color, pageIndex),
    setCanvasDimensions: (width: number, height: number) =>
      storeRef.current.setCanvasDimensions(width, height),
    exportImage: (pixelRatio: number = 2.0) =>
      engineRef.current ? engineRef.current.exportThumbnail(pixelRatio) : "",
    renameDocument: (name: string) => storeRef.current.renameDocument(name),
    undo: () => storeRef.current.undo(),
    redo: () => storeRef.current.redo(),
    // Canvas Pages
    activePageIndex: state.activePageIndex,
    pages: state.document.pages || [],
    setActivePage: activatePage,
    /** Adds a page at the end, or right after `afterIndex` */
    addPage: (name?: string, afterIndex?: number) =>
      storeRef.current.addPage(typeof name === "string" ? name : undefined, afterIndex),
    duplicatePage: (index?: number) =>
      storeRef.current.duplicatePage(
        typeof index === "number" && !isNaN(index) ? index : undefined
      ),
    deletePage: (index?: number) =>
      storeRef.current.deletePage(typeof index === "number" && !isNaN(index) ? index : undefined),
    reorderPages: (fromIndex: number, toIndex: number) => {
      if (typeof fromIndex === "number" && typeof toIndex === "number") {
        storeRef.current.reorderPages(fromIndex, toIndex);
      }
    },
    setPageName: (index: number, name: string) => {
      if (typeof index === "number" && typeof name === "string") {
        storeRef.current.setPageName(index, name);
      }
    },
    /** Hands canvas positioning to a page-stack viewport (Canva-style scrolling pages) */
    setViewportController,
    // Zoom
    setZoom,
    zoomIn,
    zoomOut,
    fitToScreen,
    resetZoom,
    centerPage,
  };
}

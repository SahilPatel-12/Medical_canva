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
import { CanvasEngine } from "../canvas/CanvasEngine";
import { fetchSvgMarkup } from "../canvas/svgUtils";

export interface UseEditorOptions {
  initialDocument: DesignDocument;
  repository?: DesignRepository;
  isReadOnly?: boolean;
}

export function useEditor({ initialDocument, repository, isReadOnly = false }: UseEditorOptions) {
  const storeRef = useRef<EditorStore>(new EditorStore(initialDocument));
  const engineRef = useRef<CanvasEngine | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<EditorState>(() => storeRef.current.getState());

  // Subscribe React state to Store updates
  useEffect(() => {
    let lastDoc = storeRef.current.getDocument();
    let lastSelectedId = storeRef.current.getSelectedId();
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
        if (newState.selectedId !== lastSelectedId) {
          lastSelectedId = newState.selectedId;
          if (newState.selectedId && !isReadOnly) {
            engineRef.current.select(newState.selectedId);
          } else {
            engineRef.current.deselect();
          }
        }
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
      onSelect: (id) => {
        if (!isReadOnly) storeRef.current.selectElement(id);
      },
      onElementChange: (id, updates) => {
        if (!isReadOnly) storeRef.current.updateElement(id, updates);
      },
      onDropAsset: (asset, position) => {
        if (!isReadOnly) {
          const newElement = storeRef.current.createFromAsset(asset, position);
          storeRef.current.addElement(newElement);
        }
      },
      onZoomChange: (newZoom) => {
        storeRef.current.setZoom(newZoom);
      },
      isReadOnly,
    });

    engineRef.current = engine;
    engine.renderDocument(storeRef.current.getDocument());

    // Window resize observer
    const resizeObserver = new ResizeObserver(() => {
      engine.handleResize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
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
        storeRef.current.copySelected();
        return;
      }

      // Paste: Cmd/Ctrl + V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        storeRef.current.pasteClipboard();
        return;
      }

      // Duplicate: Cmd/Ctrl + D
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        storeRef.current.duplicateElement();
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

      // Delete: Delete or Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        storeRef.current.deleteElement();
        return;
      }

      // Nudge position with arrow keys
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        const selected = storeRef.current.getSelectedElement();
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
    updateSelectedSvgColor: (fill?: string, stroke?: string) =>
      storeRef.current.updateSelectedSvgColor(fill, stroke),
    updateSelectedSvgColorMap: (colorMap: Record<string, string>) =>
      storeRef.current.updateSelectedSvgColorMap(colorMap),
    resetSelectedSvgColors: () => storeRef.current.resetSelectedSvgColors(),
    setCanvasBackgroundColor: (color: string) => storeRef.current.setCanvasBackgroundColor(color),
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
    setActivePage: (index: number) => {
      const safeIndex = typeof index === "number" && !isNaN(index) ? index : 0;
      storeRef.current.setActivePageIndex(safeIndex);
      if (engineRef.current) {
        engineRef.current.setActivePageIndex(safeIndex);
      }
    },
    addPage: (name?: string) =>
      storeRef.current.addPage(typeof name === "string" ? name : undefined),
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
    // Zoom
    setZoom,
    zoomIn,
    zoomOut,
    fitToScreen,
    resetZoom,
    centerPage,
  };
}

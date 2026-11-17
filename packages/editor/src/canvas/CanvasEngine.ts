import Konva from "konva";
import {
  DesignDocument,
  DesignElement,
  ShapeProperties,
  TextProperties,
  SvgProperties,
  ImageProperties,
  Asset,
  getPageBackground,
} from "@design-platform/types";
import { loadSvgImage, loadUrlImage, SvgLayerGeometry } from "./svgUtils";
import { dashPattern, isPolygonShape, polygonPoints } from "../elements/shapeGeometry";

export interface PointerModifiers {
  /** Cmd/Ctrl held: select the deepest layer under the cursor */
  deep: boolean;
  shift: boolean;
}

/** What the canvas shows while a group inside an SVG is open */
export interface CanvasLayerContext {
  elementId: string;
  containerBox: SvgLayerGeometry | null;
  children: SvgLayerGeometry[];
  /** Main (top-level) groups of the illustration: what a single click selects */
  clickTargets: SvgLayerGeometry[];
  selected: SvgLayerGeometry | null;
  selectedChildren: SvgLayerGeometry[];
  hiddenMarkup: string | null;
}

/**
 * Owns where pages sit on screen (Canva-style page stack inside a scroll container).
 * When set, the engine never pans freely: wheel scrolls through pages, Ctrl/Cmd+wheel or
 * pinch zooms, and the controller places the active page via `applyView`.
 */
export interface CanvasViewportController {
  /** Called when attached to an engine; the controller should apply its view right away */
  attach(engine: CanvasEngine): void;
  detach(): void;
  /** Zooms keeping `anchor` (container pixels, default: viewport center) in place */
  zoomTo(zoom: number, anchor?: { x: number; y: number }): void;
  /** Fits the active page in the viewport and brings it into view */
  fit(): void;
  scrollBy(dx: number, dy: number): void;
  /** The page under a container point, with the point in that page's units */
  locate(point: { x: number; y: number }): { pageIndex: number; x: number; y: number } | null;
  /** Image of a page as it looked when it stopped being the active (live) page */
  /** `background` is the page color the image was captured with */
  onPageSnapshot?(pageId: string, elements: DesignElement[], dataUrl: string, background?: string): void;
}

export interface CanvasEngineCallbacks {
  /** `pagePoint`/`modifiers` let the editor resolve clicks inside an open illustration */
  onSelect: (elementId: string | null, pagePoint?: { x: number; y: number }, modifiers?: PointerModifiers) => void;
  onElementChange: (elementId: string, updates: Partial<DesignElement>) => void;
  /** `pageIndex` is set when the asset was dropped on a page other than the active one */
  onDropAsset: (asset: Asset, position: { x: number; y: number }, pageIndex?: number) => void;
  /** The user pressed on another page of the page stack */
  onActivatePage?: (pageIndex: number) => void;
  /** `pagePoint` is the pointer position in page coordinates (used to pick the part under the cursor) */
  onDoubleClick?: (elementId: string, pagePoint?: { x: number; y: number }) => void;
  /** A layer inside an SVG was moved/resized/rotated; `deltaPage` is an affine [a,b,c,d,e,f] in page space */
  onLayerTransform?: (elementId: string, path: number[], deltaPage: number[]) => void;
  onZoomChange?: (zoom: number) => void;
  /** Any mouse/touch press on the canvas (before click / drag handling) */
  onPointerDown?: () => void;
  /** Several elements changed at once (multi-selection drag / resize): apply as one step */
  onElementsChange?: (batch: Array<{ id: string; updates: Partial<DesignElement> }>) => void;
  /** Drag-selection box finished; `additive` when Shift was held */
  onMarqueeSelect?: (ids: string[], additive: boolean) => void;
  /**
   * Right-click on the canvas. `elementId` is the element under the pointer (null on empty
   * canvas); `client` is the viewport position for placing the menu.
   */
  onContextMenu?: (info: CanvasContextMenuInfo) => void;
  /** Size the canvas measured itself (auto-height text); applied without an undo step */
  onElementAutoSize?: (elementId: string, updates: Partial<DesignElement>) => void;
  isReadOnly?: boolean;
}

export interface CanvasContextMenuInfo {
  elementId: string | null;
  client: { x: number; y: number };
  pagePoint?: { x: number; y: number };
}

/** Only the main button selects (Konva also fires "click" for right / middle presses) */
function isSecondaryPress(evt: Event): boolean {
  return typeof (evt as MouseEvent).button === "number" && (evt as MouseEvent).button !== 0;
}

interface HitMask {
  image: CanvasImageSource;
  width: number;
  height: number;
  colorKey: string;
  ok: boolean;
  canvas: HTMLCanvasElement | null;
  alpha: Uint8Array | null;
  maskWidth: number;
  maskHeight: number;
}

interface LayerMask {
  alpha: Uint8Array;
  maskWidth: number;
  maskHeight: number;
}

/**
 * Rasterizes an image into a binary alpha mask (1 = painted), slightly dilated so thin
 * lines stay easy to hit. Returns null when the image cannot be read (tainted canvas).
 */
function buildAlphaMask(image: CanvasImageSource, mw: number, mh: number, dilation: number): Uint8Array | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = mw;
    canvas.height = mh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const r = dilation;
    const offsets: Array<[number, number]> = [
      [0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r],
    ];
    for (const [dx, dy] of offsets) ctx.drawImage(image, dx, dy, mw, mh);
    const px = ctx.getImageData(0, 0, mw, mh).data;
    const alpha = new Uint8Array(mw * mh);
    for (let i = 0; i < mw * mh; i++) alpha[i] = (px[i * 4 + 3] || 0) > 16 ? 1 : 0;
    return alpha;
  } catch {
    return null;
  }
}

/** Opacity applied to elements outside the group being edited */
const ISOLATION_DIM_OPACITY = 0.3;

export class CanvasEngine {
  private container: HTMLDivElement;
  private stage: Konva.Stage | null = null;
  private layer: Konva.Layer | null = null;
  private pageGroup: Konva.Group | null = null;
  private pageBackground: Konva.Rect | null = null;
  private transformer: Konva.Transformer | null = null;
  private nodeMap: Map<string, Konva.Shape | Konva.Group> = new Map();
  private callbacks: CanvasEngineCallbacks;
  private currentDoc: DesignDocument | null = null;
  private activePageIndex: number = 0;
  private zoomLevel: number = 1;
  private isReadOnly: boolean = false;

  // Pan state
  private isSpacePressed: boolean = false;
  private isPanning: boolean = false;
  private lastPointerPos: { x: number; y: number } | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;

  // Render concurrency lock
  private isRendering: boolean = false;
  private pendingRenderDoc: DesignDocument | null = null;
  private pendingRenderPageIndex: number | null = null;
  private renderWaiters: Array<() => void> = [];

  // Selection requested by the store; applied as soon as the node exists
  private selectedId: string | null = null;

  // Click-vs-pan disambiguation
  private panStartPointer: { x: number; y: number } | null = null;
  private panMoved: boolean = false;

  // Group editing (isolation) context
  private groupMemberIds: Set<string> | null = null;
  private groupOutline: Konva.Rect | null = null;
  private suppressIsolation: boolean = false;

  // Pixel-accurate hit regions for SVG parts
  private hitMasks: WeakMap<Konva.Shape, HitMask> = new WeakMap();

  // Layer editing inside an open SVG
  private layerCtx: CanvasLayerContext | null = null;
  private viewport: CanvasViewportController | null = null;
  /** All selected element ids (the transformer wraps every one of them) */
  private selectedIds: string[] = [];
  /** Changes from one gesture (e.g. dragging several elements) reported together */
  private pendingChanges: Map<string, Partial<DesignElement>> | null = null;
  /** Drag-to-select box */
  private marquee: {
    start: { x: number; y: number };
    startScreen: { x: number; y: number };
    rect: Konva.Rect;
    moved: boolean;
    additive: boolean;
    onMove: (e: MouseEvent) => void;
    onUp: (e: MouseEvent) => void;
  } | null = null;
  private suppressEmptyClick = false;
  /** In-place text editor (textarea over a text element) */
  private textEditor: { id: string; textarea: HTMLTextAreaElement; original: string } | null = null;
  private layerProxy: Konva.Rect | null = null;
  private hoverRect: Konva.Rect | null = null;
  private proxyStart: Konva.Transform | null = null;
  private layerMasks: Map<string, LayerMask | "loading" | "failed"> = new Map();
  private previewImages: Map<string, HTMLImageElement | null> = new Map();
  private preview: {
    elementId: string;
    overlay: Konva.Image;
    originalImage: CanvasImageSource;
    hiddenImage: CanvasImageSource;
    committed: boolean;
  } | null = null;

  constructor(container: HTMLDivElement, callbacks: CanvasEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isReadOnly = Boolean(callbacks.isReadOnly);
    this.initStage();
    this.setupDropHandlers();
    this.setupZoomAndPan();
  }

  private initStage(): void {
    if (typeof window === "undefined" || !this.container) return;

    const width = this.container.clientWidth || 1200;
    const height = this.container.clientHeight || 800;

    this.stage = new Konva.Stage({
      container: this.container,
      width,
      height,
    });

    this.layer = new Konva.Layer();
    this.stage.add(this.layer);

    // Page group holds the document page & all its elements at local (0, 0)
    this.pageGroup = new Konva.Group({
      x: 0,
      y: 0,
    });
    this.layer.add(this.pageGroup);

    // Page background rect with modern drop shadow
    this.pageBackground = new Konva.Rect({
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
      fill: "#ffffff",
      shadowColor: "rgba(0, 0, 0, 0.45)",
      shadowBlur: 24,
      shadowOffset: { x: 0, y: 10 },
      shadowOpacity: 0.35,
      cornerRadius: 4,
      listening: true, // Click page background to deselect or pan
    });
    this.pageGroup.add(this.pageBackground);

    // Deselect when clicking on page background (ignored right after a pan gesture)
    this.pageBackground.on("click tap", (e) => {
      e.cancelBubble = true;
      if (isSecondaryPress(e.evt)) return;
      this.handleEmptyClick();
    });

    // Deselect when clicking on empty stage area outside the page
    this.stage.on("click tap", (e) => {
      if (e.target === this.stage && !isSecondaryPress(e.evt)) {
        this.handleEmptyClick();
      }
    });

    // Dashed outline around the group being edited
    this.groupOutline = new Konva.Rect({
      stroke: "#0d9488",
      strokeWidth: 1.5,
      dash: [6, 4],
      strokeScaleEnabled: false,
      listening: false,
      visible: false,
      name: "__group-outline",
    });
    this.pageGroup.add(this.groupOutline);

    // Hover outline of the layer a click would select
    this.hoverRect = new Konva.Rect({
      stroke: "#10b981",
      strokeWidth: 1.5,
      strokeScaleEnabled: false,
      listening: false,
      visible: false,
      name: "__hover-outline",
    });
    this.pageGroup.add(this.hoverRect);

    // Transformer for selection, resizing, and rotation (only enabled if not read-only)
    if (!this.isReadOnly) {
      this.initTransformer();
    }
    this.layer.draw();
  }

  private initTransformer(): void {
    if (this.transformer || !this.layer) return;

    this.transformer = new Konva.Transformer({
      borderStroke: "#10b981",
      borderStrokeWidth: 1.5,
      anchorStroke: "#047857",
      anchorFill: "#ffffff",
      anchorSize: 8,
      anchorCornerRadius: 2,
      rotateAnchorOffset: 24,
      rotateAnchorCursor: "grab",
      rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
      enabledAnchors: [
        "top-left",
        "top-center",
        "top-right",
        "middle-right",
        "middle-left",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
      boundBoxFunc: (oldBox, newBox) => {
        if (Math.abs(newBox.width) < 5) return oldBox;
        // Thin elements (lines) keep their height; others need at least 5px
        if (Math.abs(newBox.height) < 5 && Math.abs(oldBox.height) >= 5) return oldBox;
        return newBox;
      },
    });

    this.layer.add(this.transformer);
    this.initLayerProxy();
  }

  /**
   * Setup interactive zoom via mouse wheel, trackpad pinch, and canvas panning
   */
  private setupZoomAndPan(): void {
    if (!this.stage) return;

    // 1. Mouse Wheel & Trackpad Pinch-to-Zoom / Two-Finger Panning
    this.stage.on("wheel", (e) => {
      e.evt.preventDefault();
      if (!this.stage) return;

      const oldScale = this.zoomLevel;
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      // Trackpad pinch (browser sets ctrlKey) or mouse wheel with Ctrl/Cmd
      const isPinchOrCtrl = e.evt.ctrlKey || e.evt.metaKey;

      if (this.viewport) {
        // Page stack: scroll through pages, zoom around the pointer. Never pan freely.
        if (isPinchOrCtrl) {
          this.viewport.zoomTo(oldScale * Math.pow(0.998, e.evt.deltaY), pointer);
        } else {
          const lineScale = e.evt.deltaMode === 1 ? 16 : e.evt.deltaMode === 2 ? this.stage.height() : 1;
          const dx = (e.evt.shiftKey ? e.evt.deltaY : e.evt.deltaX) * lineScale;
          const dy = (e.evt.shiftKey ? 0 : e.evt.deltaY) * lineScale;
          this.viewport.scrollBy(dx, dy);
        }
        return;
      }

      if (!isPinchOrCtrl) {
        // Natural Pan: Trackpad scroll or mouse wheel in any direction
        // ShiftKey: pan horizontally
        const dx = e.evt.shiftKey ? e.evt.deltaY : e.evt.deltaX;
        const dy = e.evt.shiftKey ? 0 : e.evt.deltaY;

        const currentPos = this.stage.position();
        this.stage.position({
          x: currentPos.x - dx,
          y: currentPos.y - dy,
        });
        this.stage.batchDraw();
        return;
      }

      // Smooth zoom towards pointer position
      const mousePointTo = {
        x: (pointer.x - this.stage.x()) / oldScale,
        y: (pointer.y - this.stage.y()) / oldScale,
      };

      const zoomFactor = Math.pow(0.998, e.evt.deltaY);
      let newScale = oldScale * zoomFactor;

      // Clamp zoom between 10% (0.1) and 500% (5.0)
      newScale = Math.max(0.1, Math.min(5, Math.round(newScale * 100) / 100));

      this.zoomLevel = newScale;
      this.stage.scale({ x: newScale, y: newScale });

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      this.stage.position(newPos);
      this.stage.batchDraw();

      this.callbacks.onZoomChange?.(this.zoomLevel);
    });

    // 2. Pan with Middle Click, Spacebar + Drag, or Empty Canvas Drag
    this.stage.on("mousedown touchstart", (e) => {
      if (!this.stage) return;
      this.callbacks.onPointerDown?.();
      const isMiddleClick = e.evt.button === 1;
      const isSpaceDrag = this.isSpacePressed && e.evt.button === 0;
      // In the page stack, an empty drag does not move the page around (it stays centered)
      const isEmptyStageClick =
        !this.viewport && (e.target === this.stage || e.target === this.pageBackground) && e.evt.button === 0;
      const isReadOnlyDrag = this.isReadOnly && e.evt.button === 0;

      // Pressing on another page of the stack makes it the active (editable) page
      let onOtherPage = false;
      if (this.viewport && e.target === this.stage && e.evt.button !== 1 && !this.isSpacePressed) {
        const pointer = this.stage.getPointerPosition();
        const hit = pointer ? this.viewport.locate(pointer) : null;
        if (hit && hit.pageIndex !== this.activePageIndex) {
          onOtherPage = true;
          this.callbacks.onActivatePage?.(hit.pageIndex);
        }
      }
      // Dragging from an empty spot draws a selection box
      if (
        this.viewport &&
        !this.isReadOnly &&
        !onOtherPage &&
        !this.isSpacePressed &&
        e.evt.button === 0 &&
        (e.target === this.stage || e.target === this.pageBackground)
      ) {
        this.startMarquee(e.evt as MouseEvent);
      }

      this.panMoved = false;
      if (isMiddleClick || isSpaceDrag || isEmptyStageClick || isReadOnlyDrag) {
        this.isPanning = true;
        this.lastPointerPos = this.stage.getPointerPosition();
        this.panStartPointer = this.lastPointerPos;
        if (this.container) {
          this.container.style.cursor = "grabbing";
        }
      }
    });

    this.stage.on("mousemove touchmove", () => {
      if (!this.isPanning) this.updateHover();
      if (!this.isPanning || !this.stage || !this.lastPointerPos) return;

      const currentPointer = this.stage.getPointerPosition();
      if (!currentPointer) return;

      const dx = currentPointer.x - this.lastPointerPos.x;
      const dy = currentPointer.y - this.lastPointerPos.y;
      if (
        this.panStartPointer &&
        Math.hypot(currentPointer.x - this.panStartPointer.x, currentPointer.y - this.panStartPointer.y) > 3
      ) {
        this.panMoved = true;
      }

      this.lastPointerPos = currentPointer;
      if (this.viewport) {
        this.viewport.scrollBy(-dx, -dy);
        return;
      }
      const currentPos = this.stage.position();
      this.stage.position({
        x: currentPos.x + dx,
        y: currentPos.y + dy,
      });
      this.stage.batchDraw();
    });

    const stopPan = () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.lastPointerPos = null;
        if (this.container) {
          this.container.style.cursor = this.isSpacePressed ? "grab" : "default";
        }
      }
    };

    this.stage.on("mouseup touchend", stopPan);
    this.stage.on("mouseleave", stopPan);

    // Double-click on empty canvas stage
    this.stage.on("dblclick dbltap", (e) => {
      if (e.target === this.stage || e.target === this.pageBackground) {
        if (this.callbacks.onDoubleClick) {
          this.callbacks.onDoubleClick("", this.getPagePointer() || undefined);
        }
      }
    });

    // Right-click: quick actions menu for whatever is under the pointer
    this.stage.on("contextmenu", (e) => {
      e.evt.preventDefault();
      if (this.isReadOnly || !this.stage) return;
      const evt = e.evt as MouseEvent;
      let elementId: string | null = null;
      if (e.target !== this.stage && e.target !== this.pageBackground) {
        elementId = this.elementIdForNode(e.target);
      }
      if (!elementId && this.viewport && e.target === this.stage) {
        // On another page of the stack: make it the active page first
        const pointer = this.stage.getPointerPosition();
        const hit = pointer ? this.viewport.locate(pointer) : null;
        if (hit && hit.pageIndex !== this.activePageIndex) this.callbacks.onActivatePage?.(hit.pageIndex);
      }
      this.callbacks.onContextMenu?.({
        elementId,
        client: { x: evt.clientX, y: evt.clientY },
        pagePoint: this.getPagePointer() || undefined,
      });
    });

    // 3. Spacebar listener for Hand/Pan cursor
    this.keydownHandler = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !this.isSpacePressed &&
        !(e.target as HTMLElement).matches("input, textarea")
      ) {
        this.isSpacePressed = true;
        if (this.container) {
          this.container.style.cursor = "grab";
        }
      }
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        this.isSpacePressed = false;
        if (!this.isPanning && this.container) {
          this.container.style.cursor = "default";
        }
      }
    };

    window.addEventListener("keydown", this.keydownHandler);
    window.addEventListener("keyup", this.keyupHandler);
  }

  private setupDropHandlers(): void {
    if (this.isReadOnly || !this.container) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (!this.stage || !e.dataTransfer) return;

      const rawData = e.dataTransfer.getData("application/json");
      if (!rawData) return;

      try {
        const asset: Asset = JSON.parse(rawData);
        const rect = this.container.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        // Page stack: drop onto whichever page is under the pointer
        const hit = this.viewport?.locate({ x: clientX, y: clientY });
        if (hit) {
          this.callbacks.onDropAsset(
            asset,
            { x: Math.round(hit.x), y: Math.round(hit.y) },
            hit.pageIndex !== this.activePageIndex ? hit.pageIndex : undefined
          );
          return;
        }

        // Convert client coordinates to page local coordinates taking stage scale & pan into account
        const stageX = this.stage.x();
        const stageY = this.stage.y();
        const scale = this.stage.scaleX() || 1;

        const x = (clientX - stageX) / scale;
        const y = (clientY - stageY) / scale;

        this.callbacks.onDropAsset(asset, {
          x: Math.round(x),
          y: Math.round(y),
        });
      } catch (err) {
        console.error("Failed to parse dropped asset:", err);
      }
    };

    this.container.addEventListener("dragover", handleDragOver);
    this.container.addEventListener("drop", handleDrop);
  }

  /**
   * Render or synchronize the entire DesignDocument on canvas
   */
  public async renderDocument(doc: DesignDocument, targetPageIndex?: number): Promise<void> {
    if (!this.stage || !this.layer || !this.pageGroup || !this.pageBackground) return;

    if (typeof targetPageIndex === "number" && !isNaN(targetPageIndex) && targetPageIndex >= 0) {
      if (targetPageIndex !== this.activePageIndex) this.snapshotActivePage();
      this.activePageIndex = targetPageIndex;
    }

    const isFirstLoad = !this.currentDoc;
    this.currentDoc = doc;

    // Concurrency lock: queue latest document and requested page if already rendering
    if (this.isRendering) {
      this.pendingRenderDoc = doc;
      this.pendingRenderPageIndex = this.activePageIndex;
      return;
    }

    this.isRendering = true;

    try {
      // Update page size and background color
      this.pageBackground.width(doc.width);
      this.pageBackground.height(doc.height);
      const bgIndex = Math.min(this.activePageIndex, Math.max(0, (doc.pages?.length || 1) - 1));
      this.pageBackground.fill(getPageBackground(doc, bgIndex));
      this.applyPageClip();

      // On initial load, fit to screen with nice margin
      if (isFirstLoad) {
        this.fitToScreen();
      }

      const pageCount = doc.pages ? doc.pages.length : 0;
      if (this.activePageIndex >= pageCount) {
        this.activePageIndex = Math.max(0, pageCount - 1);
      }
      const activePage = (doc.pages && doc.pages[this.activePageIndex]) || doc.pages[0];
      const elements = activePage ? activePage.elements : [];

      // Keep track of active IDs
      const currentElementIds = new Set(elements.map((el) => el.id));

      // Remove nodes that are no longer in document / active page
      this.nodeMap.forEach((node, id) => {
        if (!currentElementIds.has(id)) {
          node.destroy();
          this.nodeMap.delete(id);
        }
      });

      // Purge any orphan or duplicate children in pageGroup
      const seenChildIds = new Set<string>();
      const existingChildren = [...this.pageGroup.getChildren()];
      for (const child of existingChildren) {
        if (child === this.pageBackground || child.name().startsWith("__")) continue;
        const childId = child.name();
        if (!childId || !currentElementIds.has(childId) || seenChildIds.has(childId)) {
          child.destroy();
        } else {
          seenChildIds.add(childId);
        }
      }

      // Render or update each element sequentially
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el) {
          try {
            await this.renderElement(el, i, currentElementIds);
          } catch (elementErr) {
            console.warn(`[CanvasEngine] Error rendering element ${el.id}:`, elementErr);
          }
        }
      }

      // Attach the transformer to the requested selection (it may have just been created)
      this.placeLayerProxy();
      this.applySelection();
      this.applyIsolation();
      this.updateGroupOutline();

      // Draw synchronously so the hit graph matches the new nodes immediately
      // (otherwise a quick click could hit the previous, already destroyed nodes)
      this.layer.draw();
    } finally {
      this.isRendering = false;
      if (this.pendingRenderDoc) {
        const nextDoc = this.pendingRenderDoc;
        const nextIdx = this.pendingRenderPageIndex;
        this.pendingRenderDoc = null;
        this.pendingRenderPageIndex = null;
        this.renderDocument(nextDoc, nextIdx ?? undefined);
      } else {
        const waiters = this.renderWaiters;
        this.renderWaiters = [];
        waiters.forEach((resolve) => resolve());
      }
    }
  }

  private async renderElement(
    el: DesignElement,
    zIndex: number,
    activeIds: Set<string>
  ): Promise<void> {
    if (!this.pageGroup || !this.layer) return;

    let node = this.nodeMap.get(el.id);

    if (!node) {
      // Check if pageGroup already has a child with this element ID
      const existing = this.pageGroup.findOne(`.${el.id}`) as Konva.Shape | Konva.Group | undefined;
      if (existing) {
        node = existing;
        this.nodeMap.set(el.id, node);
      } else {
        const created = await this.createElementNode(el);
        if (!created) return;

        // If the element was deleted or superseded while awaiting async creation, discard it
        if (!activeIds.has(el.id) || this.nodeMap.has(el.id)) {
          created.destroy();
          return;
        }

        node = created;
        this.nodeMap.set(el.id, node);
        this.pageGroup.add(node);
        this.setupNodeEvents(node, el.id);
      }
    }

    await this.updateElementNode(node, el);

    // Index 0 is pageBackground, so elements start at index 1
    node.zIndex(zIndex + 1);
  }

  private async createElementNode(el: DesignElement): Promise<Konva.Shape | Konva.Group | null> {
    const commonProps = {
      id: el.id,
      name: el.id,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: el.rotation || 0,
      opacity: this.effectiveOpacity(el),
      draggable: this.isReadOnly ? false : !el.locked,
      listening: !this.isReadOnly,
    };

    if (el.type === "shape") {
      const props = el.properties as ShapeProperties;
      if (props.shapeType === "circle") {
        const radius = Math.min(el.width, el.height) / 2;
        return new Konva.Circle({
          ...commonProps,
          x: el.x + radius,
          y: el.y + radius,
          radius,
          fill: props.fill || "#3b82f6",
          stroke: props.stroke || "transparent",
          strokeWidth: props.strokeWidth || 0,
        });
      }

      if (props.shapeType === "line") {
        const line = new Konva.Shape({ ...commonProps, sceneFunc: drawLineScene, hitFunc: drawLineHit });
        applyLineAttrs(line, props);
        return line;
      }

      if (isPolygonShape(props.shapeType)) {
        const poly = new Konva.Shape({ ...commonProps, sceneFunc: drawPolygonScene });
        applyPolygonAttrs(poly, props);
        return poly;
      }

      return new Konva.Rect({
        ...commonProps,
        fill: props.fill || "#3b82f6",
        stroke: props.stroke || "transparent",
        strokeWidth: props.strokeWidth || 0,
        cornerRadius: props.cornerRadius || 0,
      });
    }

    if (el.type === "text") {
      const props = el.properties as TextProperties;
      // Height follows the text (no clipped lines); the store is told the measured height
      const { height: _ignored, ...textCommon } = commonProps;
      void _ignored;
      const text = new Konva.Text({ ...textCommon, wrap: "word" });
      applyTextAttrs(text, props);
      return text;
    }

    if (el.type === "image") {
      const props = el.properties as ImageProperties;
      const src = props.src || props.originalSrc || "";
      if (!src) return null;
      try {
        const img = await loadUrlImage(src);
        return new Konva.Image({
          ...commonProps,
          image: orientedImage(img, props.flipX, props.flipY),
        });
      } catch (err) {
        console.error("Failed to load image element:", err);
        return null;
      }
    }

    if (el.type === "svg") {
      const props = el.properties as SvgProperties;
      const svgSource = props.svgContent || props.originalSvg || "";
      
      // If svgSource is a URL rather than raw SVG XML
      if (svgSource.startsWith("http://") || svgSource.startsWith("https://")) {
        try {
          const img = await loadUrlImage(svgSource);
          return new Konva.Image({
            ...commonProps,
            image: img,
          });
        } catch (err) {
          console.error("Failed to load SVG from URL:", err);
          return null;
        }
      }

      try {
        const img = await loadSvgImage(svgSource);
        return new Konva.Image({
          ...commonProps,
          image: img,
        });
      } catch (err) {
        console.warn(`[CanvasEngine] Failed to decode SVG markup for element ${el.id}:`, err);
        return null;
      }
    }

    return null;
  }

  private async updateElementNode(node: Konva.Node, el: DesignElement): Promise<void> {
    if (!node.isDragging()) {
      node.x(el.x);
      node.y(el.y);
      node.width(el.width);
      if (el.type !== "text") node.height(el.height);
      node.rotation(el.rotation || 0);
      node.opacity(this.effectiveOpacity(el));
      node.draggable(this.isReadOnly ? false : !el.locked && this.layerCtx?.elementId !== el.id);
      node.listening(!this.isReadOnly);
    }

    if (el.type === "shape") {
      const props = el.properties as ShapeProperties;
      if (node instanceof Konva.Circle) {
        const radius = Math.min(el.width, el.height) / 2;
        node.x(el.x + radius);
        node.y(el.y + radius);
        node.radius(radius);
        node.fill(props.fill || "#3b82f6");
        node.stroke(props.stroke || "transparent");
        node.strokeWidth(props.strokeWidth || 0);
        node.dash(dashPattern(props.dash, props.strokeWidth || 0));
      } else if (node instanceof Konva.Rect) {
        node.fill(props.fill || "#3b82f6");
        node.stroke(props.stroke || "transparent");
        node.strokeWidth(props.strokeWidth || 0);
        node.cornerRadius(props.cornerRadius || 0);
        node.dash(dashPattern(props.dash, props.strokeWidth || 0));
      } else if (node instanceof Konva.Line) {
        node.points([0, 0, el.width, el.height]);
        node.stroke(props.fill || "#3b82f6");
        node.strokeWidth(props.strokeWidth || 4);
      } else if (node instanceof Konva.Shape && node.getAttr("lineShape")) {
        applyLineAttrs(node, props);
      } else if (node instanceof Konva.Shape && node.getAttr("polygonType")) {
        applyPolygonAttrs(node, props);
      }
    } else if (el.type === "text" && node instanceof Konva.Text) {
      applyTextAttrs(node, el.properties as TextProperties);
      // Report the real (wrapped) height so selection, alignment and export stay accurate
      const measured = Math.round(node.height());
      if (Math.abs(measured - el.height) > 1 && !this.textEditor) {
        this.callbacks.onElementAutoSize?.(el.id, { height: measured });
      }
    } else if (el.type === "image" && node instanceof Konva.Image) {
      const props = el.properties as ImageProperties;
      const src = props.src || props.originalSrc || "";
      if (src) {
        try {
          const img = await loadUrlImage(src);
          node.image(orientedImage(img, props.flipX, props.flipY));
        } catch (err) {
          console.error("Failed to update image:", err);
        }
      }
    }

    if (el.type === "svg" && node instanceof Konva.Image) {
      this.configureHitRegion(node, el);
      const props = el.properties as SvgProperties;
      const currentSvg = props.svgContent || props.originalSvg || "";
      try {
        const img =
          currentSvg.startsWith("http://") || currentSvg.startsWith("https://")
            ? await loadUrlImage(currentSvg)
            : await loadSvgImage(currentSvg);
        const preview = this.preview && this.preview.elementId === el.id ? this.preview : null;
        if (preview && !preview.committed) {
          // Mid-drag: keep showing the preview, remember the latest image for cancel
          preview.originalImage = img;
        } else {
          node.image(img);
          // The edited illustration is on screen: drop the drag preview without a flash
          if (preview && img !== preview.originalImage) this.endLayerPreview(false);
        }
      } catch (err) {
        console.error("Failed to update SVG image:", err);
      }
    }
  }

  private setupNodeEvents(node: Konva.Node, elementId: string): void {
    if (this.isReadOnly) {
      node.listening(false);
      node.draggable(false);
      return;
    }

    node.on("click tap", (e) => {
      e.cancelBubble = true;
      if (isSecondaryPress(e.evt)) return;
      const evt = e.evt as MouseEvent;
      if (this.layerCtx?.elementId !== elementId && !evt.shiftKey) this.select(elementId);
      this.callbacks.onSelect(elementId, this.getPagePointer() || undefined, {
        deep: Boolean(evt.metaKey || evt.ctrlKey),
        shift: Boolean(evt.shiftKey),
      });
    });

    node.on("dblclick dbltap", (e) => {
      e.cancelBubble = true;
      if (isSecondaryPress(e.evt)) return;
      if (this.callbacks.onDoubleClick) {
        this.callbacks.onDoubleClick(elementId, this.getPagePointer() || undefined);
      }
    });

    node.on("mouseleave", () => {
      if (this.hoverRect?.visible()) {
        this.hoverRect.visible(false);
        this.layer?.batchDraw();
      }
    });

    node.on("dragend", () => {
      let x = Math.round(node.x());
      let y = Math.round(node.y());

      if (node instanceof Konva.Circle) {
        const r = node.radius();
        x = Math.round(node.x() - r);
        y = Math.round(node.y() - r);
      }

      this.reportChange(elementId, { x, y });
    });

    if (node instanceof Konva.Text) {
      // Side handles change the box width (text rewraps) instead of stretching letters
      node.on("transform", () => {
        const anchor = this.transformer?.getActiveAnchor() || "";
        if (anchor === "middle-left" || anchor === "middle-right") {
          node.setAttrs({ width: Math.max(20, node.width() * node.scaleX()), scaleX: 1, scaleY: 1 });
        }
      });
    }

    node.on("transformend", () => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      if (node instanceof Konva.Text) {
        // Corner handles scale the text: grow the font with the box
        node.scaleX(1);
        node.scaleY(1);
        const el = this.findElement(elementId);
        const props = (el?.properties || {}) as TextProperties;
        const fontScale = Math.abs(scaleY - 1) > 0.001 ? scaleY : 1;
        const fontSize = Math.max(4, Math.round((props.fontSize || node.fontSize()) * fontScale * 10) / 10);
        this.reportChange(elementId, {
          x: Math.round(node.x()),
          y: Math.round(node.y()),
          width: Math.max(20, Math.round(node.width() * scaleX)),
          rotation: Math.round(node.rotation()),
          ...(fontScale !== 1 ? { properties: { ...props, fontSize } } : {}),
        });
        return;
      }

      node.scaleX(1);
      node.scaleY(1);

      let width = Math.max(5, Math.round(node.width() * scaleX));
      let height = Math.max(5, Math.round(node.height() * scaleY));
      let x = Math.round(node.x());
      let y = Math.round(node.y());

      if (node instanceof Konva.Circle) {
        const newRadius = Math.max(2, Math.round(node.radius() * Math.max(scaleX, scaleY)));
        node.radius(newRadius);
        width = newRadius * 2;
        height = newRadius * 2;
        x = Math.round(node.x() - newRadius);
        y = Math.round(node.y() - newRadius);
      }

      const rotation = Math.round(node.rotation());

      this.reportChange(elementId, {
        x,
        y,
        width,
        height,
        rotation,
      });
    });
  }

  /**
   * Shows the selection for an element. Does not notify the store (the store is the
   * source of truth); if the node is still being created it is selected once rendered.
   */
  public select(elementId: string): void {
    this.setSelection([elementId]);
  }

  /** Shows a (multi-)selection; the last id is the primary one */
  public setSelection(ids: string[]): void {
    if (this.isReadOnly) return;
    this.selectedIds = [...ids];
    this.selectedId = ids.length ? ids[ids.length - 1]! : null;
    this.applySelection();
  }

  /** Clears the visible selection without notifying the store */
  public deselect(): void {
    this.selectedIds = [];
    this.selectedId = null;
    this.applySelection();
  }

  /** Collects element changes from one gesture and hands them over together */
  private reportChange(id: string, updates: Partial<DesignElement>): void {
    if (!this.callbacks.onElementsChange) {
      this.callbacks.onElementChange(id, updates);
      return;
    }
    if (!this.pendingChanges) {
      this.pendingChanges = new Map();
      queueMicrotask(() => {
        const batch = this.pendingChanges;
        this.pendingChanges = null;
        if (!batch || batch.size === 0) return;
        if (batch.size === 1) {
          const [[bid, bupdates]] = [...batch.entries()] as [[string, Partial<DesignElement>]];
          this.callbacks.onElementChange(bid, bupdates);
        } else {
          this.callbacks.onElementsChange!([...batch.entries()].map(([bid, u]) => ({ id: bid, updates: u })));
        }
      });
    }
    this.pendingChanges.set(id, { ...(this.pendingChanges.get(id) || {}), ...updates });
  }

  private applySelection(): void {
    if (!this.transformer || !this.layer) return;
    const ctx = this.layerCtx;
    const showLayer = ctx && ctx.elementId === this.selectedId;
    const multi = !showLayer && this.selectedIds.length > 1;
    const multiNodes = multi
      ? this.selectedIds.map((id) => this.nodeMap.get(id)).filter((n): n is Konva.Shape | Konva.Group => Boolean(n))
      : [];
    const node = showLayer
      ? ctx.selected && this.layerProxy?.visible()
        ? this.layerProxy
        : undefined
      : this.selectedId
        ? this.nodeMap.get(this.selectedId)
        : undefined;
    const current = this.transformer.nodes();
    if (multi) {
      // Several elements: scale together from the corners, keeping proportions
      if (!this.transformer.resizeEnabled()) this.transformer.resizeEnabled(true);
      if (!this.transformer.rotateEnabled()) this.transformer.rotateEnabled(true);
      if (this.transformer.enabledAnchors().join() !== CORNER_ANCHORS.join()) this.transformer.enabledAnchors(CORNER_ANCHORS);
      this.transformer.keepRatio(true);
      const same = current.length === multiNodes.length && current.every((n, i) => n === multiNodes[i]);
      if (!same) this.transformer.nodes(multiNodes);
      else this.transformer.forceUpdate();
      this.layer.batchDraw();
      return;
    }
    // A locked element can be selected but not resized or rotated
    const selectedEl = !showLayer && this.selectedId
      ? this.currentDoc?.pages?.[this.activePageIndex]?.elements.find((e) => e.id === this.selectedId)
      : undefined;
    const editable = !selectedEl?.locked;
    if (this.transformer.resizeEnabled() !== editable) this.transformer.resizeEnabled(editable);
    if (this.transformer.rotateEnabled() !== editable) this.transformer.rotateEnabled(editable);
    const shapeType = selectedEl?.type === "shape" ? (selectedEl.properties as ShapeProperties).shapeType : null;
    const anchors =
      selectedEl?.type === "text"
        ? TEXT_ANCHORS
        : shapeType === "line"
          ? LINE_ANCHORS
          : ALL_ANCHORS;
    if (this.transformer.enabledAnchors().join() !== anchors.join()) this.transformer.enabledAnchors(anchors);
    this.transformer.keepRatio(selectedEl?.type === "text");
    if (node) {
      if (current.length !== 1 || current[0] !== node) {
        this.transformer.nodes([node]);
      } else {
        this.transformer.forceUpdate();
      }
    } else if (current.length > 0) {
      this.transformer.nodes([]);
    }
    this.layer.batchDraw();
  }

  /** User clicked empty canvas (not the end of a pan gesture) */
  private handleEmptyClick(): void {
    if (this.panMoved) {
      this.panMoved = false;
      return;
    }
    if (this.suppressEmptyClick) {
      this.suppressEmptyClick = false;
      return;
    }
    // Mid-render the hit graph may still show removed nodes: what's "under" the pointer is unknown
    if (this.isRendering || this.pendingRenderDoc) return;
    this.deselect();
    this.callbacks.onSelect(null);
  }

  /** Pointer position in page coordinates */
  private getPagePointer(): { x: number; y: number } | null {
    if (!this.pageGroup) return null;
    const pos = this.pageGroup.getRelativePointerPosition();
    return pos ? { x: pos.x, y: pos.y } : null;
  }

  /** Resolves once every queued render has finished (nodes exist for the latest document) */
  public waitForRender(): Promise<void> {
    if (!this.isRendering && !this.pendingRenderDoc) return Promise.resolve();
    return new Promise((resolve) => this.renderWaiters.push(resolve));
  }

  // ==========================================
  // Group editing isolation
  // ==========================================

  private effectiveOpacity(el: DesignElement): number {
    const base = el.opacity ?? 1;
    if (!this.groupMemberIds || this.suppressIsolation || this.groupMemberIds.has(el.id)) return base;
    return base * ISOLATION_DIM_OPACITY;
  }

  private applyIsolation(): void {
    const page = this.currentDoc?.pages?.[this.activePageIndex];
    if (!page) return;
    for (const el of page.elements) {
      const node = this.nodeMap.get(el.id);
      if (node && !node.isDragging()) node.opacity(this.effectiveOpacity(el));
    }
  }

  // ==========================================
  // Layer editing inside an SVG (Figma-style)
  // ------------------------------------------
  // The illustration stays one image. The selected layer gets an invisible proxy box
  // carrying the transformer; dragging it shows a live preview (illustration without
  // the layer + the layer on its own) and commits a single markup edit on release.
  // ==========================================

  /**
   * Shows the open group and selected layer of an SVG element (null when no group is open).
   * Pass the same object again to make this a no-op (the store memoizes it).
   */
  public setLayerEditContext(ctx: CanvasLayerContext | null): void {
    if (ctx === this.layerCtx) return;
    const prevElementId = this.layerCtx?.elementId;
    this.layerCtx = ctx;
    this.groupMemberIds = ctx ? new Set([ctx.elementId]) : null;

    // The open illustration itself must not be dragged around: drags go to its layers
    const restoreDraggable = (id: string | undefined) => {
      if (!id) return;
      const node = this.nodeMap.get(id);
      const el = this.currentDoc?.pages?.[this.activePageIndex]?.elements.find((e) => e.id === id);
      if (node) node.draggable(!this.isReadOnly && !el?.locked && this.layerCtx?.elementId !== id);
    };
    restoreDraggable(prevElementId);
    restoreDraggable(ctx?.elementId);

    if (ctx) {
      [...ctx.clickTargets, ...ctx.children, ...ctx.selectedChildren].forEach((g) => this.ensureLayerMask(g));
      if (ctx.selected) {
        this.preloadPreviewImage(ctx.selected.markup);
        if (ctx.hiddenMarkup) this.preloadPreviewImage(ctx.hiddenMarkup);
      }
    }

    this.hoverRect?.visible(false);
    this.applyIsolation();
    this.updateGroupOutline();
    this.placeLayerProxy();
    this.applySelection();
    this.layer?.batchDraw();
  }

  /** Places a rect in an element's local frame (follows its position and rotation) */
  private placeInElementFrame(
    rect: Konva.Rect,
    elementId: string,
    box: { x: number; y: number; width: number; height: number }
  ): boolean {
    const node = this.nodeMap.get(elementId);
    if (!node) return false;
    const origin = node.getTransform().point({ x: box.x, y: box.y });
    rect.setAttrs({
      x: origin.x,
      y: origin.y,
      rotation: node.rotation(),
      scaleX: 1,
      scaleY: 1,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
    });
    return true;
  }

  private updateGroupOutline(): void {
    if (!this.groupOutline) return;
    const ctx = this.layerCtx;
    const node = ctx ? this.nodeMap.get(ctx.elementId) : undefined;
    if (!ctx || !node || this.suppressIsolation) {
      this.groupOutline.visible(false);
      return;
    }
    const box = ctx.containerBox?.box || { x: 0, y: 0, width: node.width(), height: node.height() };
    this.placeInElementFrame(this.groupOutline, ctx.elementId, box);
    this.groupOutline.visible(true);
    this.groupOutline.moveToTop();
    this.layerProxy?.moveToTop();
  }

  private placeLayerProxy(): void {
    const proxy = this.layerProxy;
    if (!proxy) return;
    if (proxy.isDragging() || this.transformer?.isTransforming()) return;
    const ctx = this.layerCtx;
    if (!ctx || !ctx.selected || !this.placeInElementFrame(proxy, ctx.elementId, ctx.selected.box)) {
      proxy.visible(false);
      return;
    }
    proxy.visible(true);
    proxy.moveToTop();
    this.proxyStart = proxy.getTransform().copy();
  }

  private initLayerProxy(): void {
    if (this.layerProxy || !this.pageGroup) return;
    const proxy = new Konva.Rect({
      name: "__layer-proxy",
      fill: "rgba(0,0,0,0)",
      draggable: true,
      visible: false,
    });
    this.pageGroup.add(proxy);
    this.layerProxy = proxy;

    const modifiers = (evt: MouseEvent | TouchEvent): PointerModifiers => ({
      deep: Boolean((evt as MouseEvent).metaKey || (evt as MouseEvent).ctrlKey),
      shift: Boolean((evt as MouseEvent).shiftKey),
    });
    // Clicks on the selection box are resolved by position (another layer may be under it)
    proxy.on("click tap", (e) => {
      e.cancelBubble = true;
      if (isSecondaryPress(e.evt)) return;
      const ctx = this.layerCtx;
      if (ctx) this.callbacks.onSelect(ctx.elementId, this.getPagePointer() || undefined, modifiers(e.evt));
    });
    proxy.on("dblclick dbltap", (e) => {
      e.cancelBubble = true;
      if (isSecondaryPress(e.evt)) return;
      const ctx = this.layerCtx;
      if (ctx) this.callbacks.onDoubleClick?.(ctx.elementId, this.getPagePointer() || undefined);
    });
    proxy.on("dragstart transformstart", () => this.startLayerPreview());
    proxy.on("dragmove transform", () => this.syncLayerPreview());
    proxy.on("dragend transformend", () => this.commitLayerTransform());
  }

  private preloadPreviewImage(markup: string): void {
    if (this.previewImages.has(markup)) return;
    this.previewImages.set(markup, null);
    loadSvgImage(markup)
      .then((img) => this.previewImages.set(markup, img))
      .catch(() => this.previewImages.delete(markup));
    if (this.previewImages.size > 40) {
      const oldest = this.previewImages.keys().next().value;
      if (oldest !== undefined) this.previewImages.delete(oldest);
    }
  }

  private startLayerPreview(): void {
    const ctx = this.layerCtx;
    if (this.preview || !ctx || !ctx.selected || !ctx.hiddenMarkup || !this.pageGroup) return;
    const node = this.nodeMap.get(ctx.elementId);
    const hidden = this.previewImages.get(ctx.hiddenMarkup);
    const part = this.previewImages.get(ctx.selected.markup);
    // Images still loading: only the selection box moves until release
    if (!(node instanceof Konva.Image) || !hidden || !part) return;

    const overlay = new Konva.Image({
      name: "__layer-preview",
      image: part,
      listening: false,
      opacity: node.opacity(),
    });
    this.pageGroup.add(overlay);
    overlay.zIndex(node.zIndex() + 1);
    this.preview = {
      elementId: ctx.elementId,
      overlay,
      originalImage: node.image() as CanvasImageSource,
      hiddenImage: hidden,
      committed: false,
    };
    node.image(hidden);
    this.syncLayerPreview();
  }

  private syncLayerPreview(): void {
    const proxy = this.layerProxy;
    if (!this.preview || !proxy) return;
    this.preview.overlay.setAttrs({
      image: this.preview.overlay.image(),
      x: proxy.x(),
      y: proxy.y(),
      rotation: proxy.rotation(),
      scaleX: proxy.scaleX(),
      scaleY: proxy.scaleY(),
      width: proxy.width(),
      height: proxy.height(),
    });
  }

  /** Removes the drag preview. `restore` puts the original image back (cancelled edit). */
  private endLayerPreview(restore: boolean): void {
    const preview = this.preview;
    if (!preview) return;
    this.preview = null;
    preview.overlay.destroy();
    const node = this.nodeMap.get(preview.elementId);
    if (restore && node instanceof Konva.Image && node.image() === preview.hiddenImage) {
      node.image(preview.originalImage);
    }
    this.layer?.batchDraw();
  }

  private commitLayerTransform(): void {
    const ctx = this.layerCtx;
    const proxy = this.layerProxy;
    if (!ctx || !ctx.selected || !proxy || !this.proxyStart) {
      this.endLayerPreview(true);
      return;
    }
    const delta = proxy.getTransform().copy().multiply(this.proxyStart.copy().invert()).m;
    const isIdentity =
      Math.abs(delta[0]! - 1) < 1e-6 &&
      Math.abs(delta[1]!) < 1e-6 &&
      Math.abs(delta[2]!) < 1e-6 &&
      Math.abs(delta[3]! - 1) < 1e-6 &&
      Math.abs(delta[4]!) < 0.01 &&
      Math.abs(delta[5]!) < 0.01;
    if (isIdentity || !this.callbacks.onLayerTransform) {
      this.endLayerPreview(true);
      this.placeLayerProxy();
      return;
    }
    // Keep the preview on screen until the edited illustration image is ready (no flash)
    if (this.preview) {
      this.preview.committed = true;
      const preview = this.preview;
      setTimeout(() => {
        if (this.preview === preview) this.endLayerPreview(true);
      }, 3000);
    }
    this.callbacks.onLayerTransform(ctx.elementId, [...ctx.selected.path], delta.slice(0, 6));
  }

  /** Builds (async) a pixel mask so clicks pick a layer only where it is painted */
  private ensureLayerMask(geom: SvgLayerGeometry): void {
    if (this.layerMasks.has(geom.markup) || typeof document === "undefined") return;
    this.layerMasks.set(geom.markup, "loading");
    loadSvgImage(geom.markup)
      .then((img) => {
        const scale = Math.min(1, 256 / Math.max(geom.box.width, geom.box.height, 1));
        const mw = Math.max(1, Math.round(geom.box.width * scale));
        const mh = Math.max(1, Math.round(geom.box.height * scale));
        const alpha = buildAlphaMask(img, mw, mh, Math.max(1, Math.round(3 * scale)));
        this.layerMasks.set(geom.markup, alpha ? { alpha, maskWidth: mw, maskHeight: mh } : "failed");
      })
      .catch(() => this.layerMasks.set(geom.markup, "failed"));
    if (this.layerMasks.size > 400) {
      const oldest = this.layerMasks.keys().next().value;
      if (oldest !== undefined) this.layerMasks.delete(oldest);
    }
  }

  /**
   * Returns the index of the top-most layer painted under `pagePoint`, or null.
   * Uses pixel masks when ready (bounding boxes until then).
   */
  public hitTestLayers(elementId: string, pagePoint: { x: number; y: number }, layers: SvgLayerGeometry[]): number | null {
    const node = this.nodeMap.get(elementId);
    if (!node) return null;
    const local = node.getTransform().copy().invert().point(pagePoint);
    for (let i = layers.length - 1; i >= 0; i--) {
      const g = layers[i]!;
      const b = g.box;
      if (local.x < b.x || local.y < b.y || local.x > b.x + b.width || local.y > b.y + b.height) continue;
      const mask = this.layerMasks.get(g.markup);
      if (mask === undefined) this.ensureLayerMask(g);
      if (!mask || mask === "loading" || mask === "failed") return i;
      const mx = Math.min(mask.maskWidth - 1, Math.floor(((local.x - b.x) / b.width) * mask.maskWidth));
      const my = Math.min(mask.maskHeight - 1, Math.floor(((local.y - b.y) / b.height) * mask.maskHeight));
      if (mask.alpha[my * mask.maskWidth + mx]) return i;
    }
    return null;
  }

  /** Top-most element under a page point (optionally ignoring one element) */
  public elementAtPoint(pagePoint: { x: number; y: number }, excludeId?: string): string | null {
    if (!this.pageGroup) return null;
    for (const child of [...this.pageGroup.getChildren()].reverse()) {
      const id = child.name();
      if (!id || id.startsWith("__") || child === this.pageBackground || id === excludeId) continue;
      if (!child.visible() || !child.listening()) continue;
      const rect = child.getClientRect({ relativeTo: this.pageGroup, skipShadow: true });
      if (pagePoint.x < rect.x || pagePoint.y < rect.y || pagePoint.x > rect.x + rect.width || pagePoint.y > rect.y + rect.height) {
        continue;
      }
      if (child instanceof Konva.Image && child.hitFunc() === this.pixelHitFunc) {
        const mask = this.getHitMask(child);
        if (mask && mask.alpha) {
          const local = child.getTransform().copy().invert().point(pagePoint);
          const mx = Math.min(mask.maskWidth - 1, Math.max(0, Math.floor((local.x / child.width()) * mask.maskWidth)));
          const my = Math.min(mask.maskHeight - 1, Math.max(0, Math.floor((local.y / child.height()) * mask.maskHeight)));
          if (!mask.alpha[my * mask.maskWidth + mx]) continue;
        }
      }
      return id;
    }
    return null;
  }

  /** Max delay between the two clicks of a double-click (ms) */
  public getDoubleClickWindow(): number {
    return Konva.dblClickWindow;
  }

  /** True while a layer or element is being dragged / transformed */
  public isInteracting(): boolean {
    return Boolean(
      this.preview || this.layerProxy?.isDragging() || this.transformer?.isTransforming() || this.isPanning
    );
  }

  /** Hover outline: the main group that a click would select */
  private updateHover(): void {
    const hover = this.hoverRect;
    if (!hover) return;
    const ctx = this.layerCtx;
    const pointer = this.getPagePointer();
    if (!ctx || !pointer || this.isPanning || this.layerProxy?.isDragging() || this.transformer?.isTransforming()) {
      if (hover.visible()) {
        hover.visible(false);
        this.layer?.batchDraw();
      }
      return;
    }
    const idx = this.hitTestLayers(ctx.elementId, pointer, ctx.clickTargets);
    const geom = idx !== null ? ctx.clickTargets[idx] : null;
    const isSelected = geom && ctx.selected && geom.path.join("/") === ctx.selected.path.join("/");
    if (!geom || isSelected) {
      if (hover.visible()) {
        hover.visible(false);
        this.layer?.batchDraw();
      }
      return;
    }
    if (this.placeInElementFrame(hover, ctx.elementId, geom.box)) {
      hover.visible(true);
      hover.moveToTop();
      this.layerProxy?.moveToTop();
      this.layer?.batchDraw();
    }
  }

  // ==========================================
  // Pixel-accurate hit testing for SVG parts
  // ==========================================

  /**
   * SVG parts (ungrouped / group-edit members) are hit-tested on their painted pixels
   * instead of their bounding box, so overlapping parts can each be clicked precisely.
   */
  private configureHitRegion(node: Konva.Image, el: DesignElement): void {
    const isPart = Boolean((el.properties as Record<string, unknown>)?.groupId);
    if (isPart) {
      if (node.hitFunc() !== this.pixelHitFunc) node.hitFunc(this.pixelHitFunc);
    } else if (node.hitFunc() === this.pixelHitFunc) {
      node.hitFunc(undefined as unknown as typeof this.pixelHitFunc);
    }
  }

  private pixelHitFunc = (context: Konva.Context, shape: Konva.Shape): void => {
    const width = shape.width();
    const height = shape.height();
    const mask = shape instanceof Konva.Image ? this.getHitMask(shape) : null;
    if (!mask || !mask.canvas) {
      context.beginPath();
      context.rect(0, 0, width, height);
      context.closePath();
      context.fillStrokeShape(shape);
      return;
    }
    const native = context._context;
    const prevSmoothing = native.imageSmoothingEnabled;
    // Nearest-neighbour keeps the exact color key Konva uses to identify the shape
    native.imageSmoothingEnabled = false;
    context.drawImage(mask.canvas, 0, 0, width, height);
    native.imageSmoothingEnabled = prevSmoothing;
  };

  private getHitMask(shape: Konva.Image): HitMask | null {
    if (typeof document === "undefined") return null;
    const image = shape.image();
    const width = shape.width();
    const height = shape.height();
    const colorKey = (shape as unknown as { colorKey?: string }).colorKey || "";
    if (!image || width <= 0 || height <= 0 || !colorKey) return null;

    const cached = this.hitMasks.get(shape);
    if (
      cached &&
      cached.image === image &&
      cached.width === width &&
      cached.height === height &&
      cached.colorKey === colorKey
    ) {
      return cached.ok ? cached : null;
    }

    const mask: HitMask = {
      image,
      width,
      height,
      colorKey,
      ok: false,
      canvas: null,
      alpha: null,
      maskWidth: 0,
      maskHeight: 0,
    };
    this.hitMasks.set(shape, mask);

    try {
      const scale = Math.min(2, 768 / Math.max(width, height));
      const mw = Math.max(1, Math.round(width * scale));
      const mh = Math.max(1, Math.round(height * scale));
      const alpha = buildAlphaMask(image, mw, mh, Math.max(1, Math.round(3 * scale)));
      if (!alpha) return null;
      // Colored copy for Konva's hit canvas (exact color key = this shape)
      const canvas = document.createElement("canvas");
      canvas.width = mw;
      canvas.height = mh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const data = ctx.createImageData(mw, mh);
      const hex = colorKey.replace("#", "");
      const cr = parseInt(hex.substring(0, 2), 16);
      const cg = parseInt(hex.substring(2, 4), 16);
      const cb = parseInt(hex.substring(4, 6), 16);
      for (let i = 0; i < mw * mh; i++) {
        if (!alpha[i]) continue;
        const o = i * 4;
        data.data[o] = cr;
        data.data[o + 1] = cg;
        data.data[o + 2] = cb;
        data.data[o + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);

      mask.ok = true;
      mask.canvas = canvas;
      mask.alpha = alpha;
      mask.maskWidth = mw;
      mask.maskHeight = mh;
      return mask;
    } catch {
      // Cross-origin / tainted image: fall back to the bounding box
      return null;
    }
  }

  /**
   * Returns the top-most element (optionally restricted to `candidateIds`) whose painted
   * pixels are under `pagePoint`. Waits for pending renders so new nodes are included.
   */
  public async findElementAtPoint(
    pagePoint: { x: number; y: number },
    candidateIds?: string[]
  ): Promise<string | null> {
    await this.waitForRender();
    if (!this.pageGroup) return null;
    const allowed = candidateIds ? new Set(candidateIds) : null;
    const children = [...this.pageGroup.getChildren()].reverse();

    for (const child of children) {
      const id = child.name();
      if (!id || child === this.pageBackground || child === this.groupOutline) continue;
      if (allowed && !allowed.has(id)) continue;
      if (!child.visible() || !child.listening()) continue;

      const local = child.getTransform().copy().invert().point(pagePoint);
      const w = child.width();
      const h = child.height();
      if (local.x < 0 || local.y < 0 || local.x > w || local.y > h) continue;

      const mask = child instanceof Konva.Image ? this.getHitMask(child) : null;
      if (!mask || !mask.alpha) return id;
      const mx = Math.min(mask.maskWidth - 1, Math.floor((local.x / w) * mask.maskWidth));
      const my = Math.min(mask.maskHeight - 1, Math.floor((local.y / h) * mask.maskHeight));
      if (mask.alpha[my * mask.maskWidth + mx]) return id;
    }
    return null;
  }

  public setActivePageIndex(index: number): void {
    if (this.activePageIndex !== index) {
      this.snapshotActivePage();
      this.activePageIndex = index;
      this.deselect();
      if (this.currentDoc) {
        this.renderDocument(this.currentDoc, index);
      }
    }
  }

  public getActivePageIndex(): number {
    return this.activePageIndex;
  }

  /**
   * Center the canvas page nicely in the viewport
   */
  public centerPage(): void {
    if (this.viewport) {
      this.viewport.zoomTo(this.zoomLevel);
      return;
    }
    if (!this.stage || !this.currentDoc) return;

    const containerWidth = this.container.clientWidth || 1200;
    const containerHeight = this.container.clientHeight || 800;

    const docWidth = this.currentDoc.width;
    const docHeight = this.currentDoc.height;

    const x = (containerWidth - docWidth * this.zoomLevel) / 2;
    const y = (containerHeight - docHeight * this.zoomLevel) / 2;

    this.stage.position({ x, y });
    this.stage.scale({ x: this.zoomLevel, y: this.zoomLevel });
    this.stage.batchDraw();
  }

  /**
   * Set zoom level, smoothly scaling towards center or a target point
   */
  public setZoom(zoom: number, targetPoint?: { x: number; y: number }): void {
    if (!this.stage) return;
    const newZoom = Math.max(0.1, Math.min(5, Math.round(zoom * 100) / 100));
    if (this.viewport) {
      this.viewport.zoomTo(newZoom, targetPoint);
      return;
    }
    const oldScale = this.zoomLevel;
    this.zoomLevel = newZoom;

    const containerWidth = this.container.clientWidth || 1200;
    const containerHeight = this.container.clientHeight || 800;

    const center = targetPoint || {
      x: containerWidth / 2,
      y: containerHeight / 2,
    };

    const mousePointTo = {
      x: (center.x - this.stage.x()) / oldScale,
      y: (center.y - this.stage.y()) / oldScale,
    };

    this.stage.scale({ x: newZoom, y: newZoom });

    const newPos = {
      x: center.x - mousePointTo.x * newZoom,
      y: center.y - mousePointTo.y * newZoom,
    };

    this.stage.position(newPos);
    this.stage.batchDraw();
    this.callbacks.onZoomChange?.(this.zoomLevel);
  }

  public getZoom(): number {
    return this.zoomLevel;
  }

  /**
   * Zoom in by a fixed step
   */
  public zoomIn(): void {
    this.setZoom(this.zoomLevel + 0.15);
  }

  /**
   * Zoom out by a fixed step
   */
  public zoomOut(): void {
    this.setZoom(this.zoomLevel - 0.15);
  }

  /**
   * Fit page to viewport with comfortable margin
   */
  public fitToScreen(): void {
    if (this.viewport) {
      this.viewport.fit();
      return;
    }
    if (!this.currentDoc || !this.container || !this.stage) return;

    const containerWidth = Math.max(200, this.container.clientWidth - 80);
    const containerHeight = Math.max(200, this.container.clientHeight - 80);

    const scaleX = containerWidth / this.currentDoc.width;
    const scaleY = containerHeight / this.currentDoc.height;
    const fitScale = Math.min(scaleX, scaleY, 1.5); // Cap at 150%

    this.zoomLevel = Math.round(fitScale * 100) / 100;
    this.centerPage();
    this.callbacks.onZoomChange?.(this.zoomLevel);
  }

  /**
   * Reset zoom to 100% and center
   */
  public resetZoom(): void {
    if (this.viewport) {
      this.viewport.zoomTo(1);
      return;
    }
    this.zoomLevel = 1;
    this.centerPage();
    this.callbacks.onZoomChange?.(this.zoomLevel);
  }

  /**
   * Export the canvas page as a PNG Data URL for thumbnails / preview
   */
  public exportThumbnail(pixelRatio: number = 0.4): string {
    if (!this.stage || !this.pageGroup || !this.currentDoc) return "";

    const wasVisible = this.transformer?.visible();
    if (this.transformer) this.transformer.visible(false);
    // Export what the design really looks like (no group-edit dimming / outline)
    const wasIsolated = Boolean(this.groupMemberIds);
    if (wasIsolated) {
      this.suppressIsolation = true;
      this.applyIsolation();
      this.updateGroupOutline();
    }

    // toDataURL works in screen space: render the page at 1:1, at the origin
    const stagePos = this.stage.position();
    const stageScale = this.stage.scale();
    const hoverVisible = Boolean(this.hoverRect?.visible());
    this.hoverRect?.visible(false);
    this.stage.position({ x: 0, y: 0 });
    this.stage.scale({ x: 1, y: 1 });

    try {
      const dataUrl = this.pageGroup.toDataURL({
        pixelRatio,
        x: 0,
        y: 0,
        width: this.currentDoc.width,
        height: this.currentDoc.height,
        mimeType: "image/png",
      });
      return dataUrl;
    } catch (err) {
      console.warn(
        "[CanvasEngine] exportThumbnail skipped (e.g. tainted canvas or headless context):",
        (err as Error)?.message || err
      );
      return "";
    } finally {
      this.stage.position(stagePos);
      this.stage.scale(stageScale);
      if (hoverVisible) this.hoverRect?.visible(true);
      if (wasIsolated) {
        this.suppressIsolation = false;
        this.applyIsolation();
        this.updateGroupOutline();
      }
      if (this.transformer && wasVisible) {
        this.transformer.visible(true);
      }
      this.layer?.batchDraw();
    }
  }

  // ==========================================
  // Page stack viewport (Canva-style)
  // ==========================================

  /** Hands positioning and zooming to a page-stack controller (null restores free panning) */
  public setViewportController(controller: CanvasViewportController | null): void {
    if (controller === this.viewport) return;
    this.viewport?.detach();
    this.viewport = controller;
    // The page stack draws page shadows itself, and pages clip their content like Canva
    this.pageBackground?.shadowEnabled(!controller);
    this.applyPageClip();
    controller?.attach(this);
    this.layer?.batchDraw();
  }

  // ---------- Drag-to-select ----------

  private startMarquee(evt: MouseEvent): void {
    if (!this.stage || !this.layer || this.marquee) return;
    const start = this.getPagePointer();
    if (!start) return;
    const rect = new Konva.Rect({
      name: "__marquee",
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
      fill: "rgba(16, 185, 129, 0.08)",
      stroke: "#10b981",
      strokeWidth: 1,
      strokeScaleEnabled: false,
      listening: false,
      visible: false,
    });
    // Same space as the page (the layer is transformed like the page group)
    rect.position({ x: start.x + (this.pageGroup?.x() || 0), y: start.y + (this.pageGroup?.y() || 0) });
    this.layer.add(rect);
    const onMove = (e: MouseEvent) => this.updateMarquee(e);
    const onUp = (e: MouseEvent) => this.finishMarquee(e);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    this.marquee = {
      start,
      startScreen: { x: evt.clientX, y: evt.clientY },
      rect,
      moved: false,
      additive: evt.shiftKey,
      onMove,
      onUp,
    };
  }

  private marqueeBox(e: MouseEvent): { x: number; y: number; width: number; height: number } | null {
    const m = this.marquee;
    if (!m || !this.stage) return null;
    this.stage.setPointersPositions(e);
    const p = this.getPagePointer();
    if (!p) return null;
    return {
      x: Math.min(m.start.x, p.x),
      y: Math.min(m.start.y, p.y),
      width: Math.abs(p.x - m.start.x),
      height: Math.abs(p.y - m.start.y),
    };
  }

  private updateMarquee(e: MouseEvent): void {
    const m = this.marquee;
    if (!m) return;
    if (!m.moved && Math.hypot(e.clientX - m.startScreen.x, e.clientY - m.startScreen.y) < 4) return;
    m.moved = true;
    const box = this.marqueeBox(e);
    if (!box) return;
    const ox = this.pageGroup?.x() || 0;
    const oy = this.pageGroup?.y() || 0;
    m.rect.setAttrs({ x: box.x + ox, y: box.y + oy, width: box.width, height: box.height, visible: true });
    m.rect.moveToTop();
    this.layer?.batchDraw();
  }

  private finishMarquee(e: MouseEvent): void {
    const m = this.marquee;
    if (!m) return;
    window.removeEventListener("mousemove", m.onMove);
    window.removeEventListener("mouseup", m.onUp);
    const box = m.moved ? this.marqueeBox(e) : null;
    m.rect.destroy();
    this.marquee = null;
    this.layer?.batchDraw();
    if (!box) return;
    // The click that ends this drag must not clear the new selection
    this.suppressEmptyClick = true;
    setTimeout(() => (this.suppressEmptyClick = false), 0);
    const ids = this.elementsInBox(box);
    this.callbacks.onMarqueeSelect?.(ids, m.additive);
  }

  /** Unlocked elements of the active page whose boxes touch a page-space rectangle */
  public elementsInBox(box: { x: number; y: number; width: number; height: number }): string[] {
    if (!this.pageGroup) return [];
    const elements = this.currentDoc?.pages?.[this.activePageIndex]?.elements || [];
    const ids: string[] = [];
    for (const el of elements) {
      if (el.locked) continue;
      const node = this.nodeMap.get(el.id);
      if (!node || !node.visible()) continue;
      const r = node.getClientRect({ relativeTo: this.pageGroup, skipShadow: true });
      if (r.x <= box.x + box.width && r.x + r.width >= box.x && r.y <= box.y + box.height && r.y + r.height >= box.y) {
        ids.push(el.id);
      }
    }
    return ids;
  }

  /** Places the active page: its top-left corner at (x, y) container pixels, at `zoom` */
  public applyView(x: number, y: number, zoom: number): void {
    if (!this.stage) return;
    const z = Math.max(0.1, Math.min(5, zoom));
    const changed = Math.abs(z - this.zoomLevel) > 1e-6;
    this.zoomLevel = z;
    this.stage.scale({ x: z, y: z });
    this.stage.position({ x, y });
    this.stage.batchDraw();
    this.positionTextEditor();
    if (changed) this.callbacks.onZoomChange?.(z);
  }

  // ==========================================
  // In-place text editing (double-click a text element)
  // ==========================================

  /** The element a Konva node belongs to (the parts box and the transformer map to the selection) */
  private elementIdForNode(target: Konva.Node): string | null {
    let n: Konva.Node | null = target;
    while (n && n !== this.pageGroup && n !== this.stage) {
      if (n === this.layerProxy) return this.layerCtx?.elementId ?? null;
      if (n === this.transformer) return this.selectedId;
      const name = n.name();
      if (name && this.nodeMap.get(name) === n) return name;
      n = n.getParent();
    }
    return null;
  }

  private findElement(id: string): DesignElement | undefined {
    return this.currentDoc?.pages?.[this.activePageIndex]?.elements.find((e) => e.id === id);
  }

  public isEditingText(): boolean {
    return Boolean(this.textEditor);
  }

  /** Opens a text box for typing right on the canvas */
  public editText(elementId: string): void {
    if (this.isReadOnly || typeof document === "undefined") return;
    const node = this.nodeMap.get(elementId);
    const el = this.findElement(elementId);
    if (!(node instanceof Konva.Text) || !el || el.locked) return;
    this.finishTextEdit(true);

    const props = el.properties as TextProperties;
    const textarea = document.createElement("textarea");
    textarea.value = props.text || "";
    textarea.setAttribute("aria-label", "Edit text");
    textarea.spellcheck = true;
    Object.assign(textarea.style, {
      position: "absolute",
      margin: "0",
      padding: "0",
      border: "none",
      outline: "none",
      background: "transparent",
      resize: "none",
      overflow: "hidden",
      whiteSpace: "pre-wrap",
      overflowWrap: "break-word",
      transformOrigin: "left top",
      zIndex: "5",
      caretColor: "#047857",
      boxShadow: "0 0 0 1.5px #10b981",
    } as Partial<CSSStyleDeclaration>);
    this.container.appendChild(textarea);
    this.textEditor = { id: elementId, textarea, original: props.text || "" };

    node.visible(false);
    this.transformer?.visible(false);
    this.layer?.batchDraw();
    this.positionTextEditor();

    textarea.addEventListener("input", () => this.positionTextEditor());
    textarea.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        textarea.blur();
      }
    });
    textarea.addEventListener("blur", () => this.finishTextEdit(true));
    textarea.focus();
    textarea.select();
  }

  private positionTextEditor(): void {
    const editor = this.textEditor;
    if (!editor || !this.stage) return;
    const node = this.nodeMap.get(editor.id);
    const el = this.findElement(editor.id);
    if (!(node instanceof Konva.Text) || !el) return;
    const props = el.properties as TextProperties;
    const scale = this.stage.scaleX();
    const pos = node.getAbsolutePosition();
    const ta = editor.textarea;
    const lineHeight = props.lineHeight || 1.2;
    Object.assign(ta.style, {
      left: `${pos.x}px`,
      top: `${pos.y}px`,
      width: `${node.width() * scale}px`,
      fontSize: `${(props.fontSize || 24) * scale}px`,
      fontFamily: props.fontFamily || "Inter, -apple-system, sans-serif",
      fontWeight: props.fontWeight === "bold" ? "700" : props.fontWeight || "400",
      fontStyle: props.fontStyle === "italic" ? "italic" : "normal",
      lineHeight: String(lineHeight),
      color: props.fill || "#18181b",
      textAlign: props.align || "left",
      transform: `rotate(${el.rotation || 0}deg)`,
    } as Partial<CSSStyleDeclaration>);
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, (props.fontSize || 24) * lineHeight * scale)}px`;
  }

  /** Closes the text editor, saving the text (empty text keeps the previous text) */
  public finishTextEdit(save: boolean): void {
    const editor = this.textEditor;
    if (!editor) return;
    this.textEditor = null;
    const { id, textarea, original } = editor;
    const value = textarea.value;
    textarea.remove();
    const node = this.nodeMap.get(id);
    node?.visible(true);
    this.transformer?.visible(true);
    this.layer?.batchDraw();
    const el = this.findElement(id);
    if (save && el && value !== original && value.trim().length > 0) {
      this.callbacks.onElementChange(id, { properties: { ...(el.properties as TextProperties), text: value } });
    }
  }

  private applyPageClip(): void {
    if (!this.pageGroup) return;
    if (this.viewport && this.currentDoc) {
      this.pageGroup.clip({ x: 0, y: 0, width: this.currentDoc.width, height: this.currentDoc.height });
    } else {
      this.pageGroup.setAttrs({ clipX: undefined, clipY: undefined, clipWidth: undefined, clipHeight: undefined });
    }
  }

  /** Captures the live page before another page becomes active (shown in its slot meanwhile) */
  private snapshotActivePage(): void {
    const viewport = this.viewport;
    const doc = this.currentDoc;
    if (!viewport?.onPageSnapshot || !doc || this.isRendering || typeof window === "undefined") return;
    const page = doc.pages?.[this.activePageIndex];
    if (!page) return;
    const ratio = Math.min(2, Math.max(0.5, this.zoomLevel * (window.devicePixelRatio || 1)));
    const dataUrl = this.exportThumbnail(ratio);
    if (dataUrl) {
      viewport.onPageSnapshot(page.id, page.elements, dataUrl, getPageBackground(doc, this.activePageIndex));
    }
  }

  public setReadOnly(readOnly: boolean): void {
    this.isReadOnly = readOnly;
    if (readOnly) {
      this.deselect();
      this.nodeMap.forEach((node) => {
        node.draggable(false);
        node.listening(false);
      });
      if (this.transformer) {
        this.transformer.nodes([]);
        this.transformer.visible(false);
      }
    } else {
      if (!this.transformer && this.layer) {
        this.initTransformer();
      }
      this.nodeMap.forEach((node, id) => {
        const el = this.currentDoc?.pages[this.activePageIndex]?.elements.find((e) => e.id === id);
        node.draggable(el ? !el.locked : true);
        node.listening(true);
      });
      if (this.transformer) {
        this.transformer.visible(true);
      }
    }
    this.layer?.batchDraw();
  }

  public getReadOnly(): boolean {
    return this.isReadOnly;
  }

  public handleResize(): void {
    if (!this.stage || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.stage.width(width);
    this.stage.height(height);
    // In the page stack the viewport controller re-applies the view itself
    if (this.viewport) this.stage.batchDraw();
    else this.centerPage();
  }

  public destroy(): void {
    this.finishTextEdit(false);
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
    }
    if (this.keyupHandler) {
      window.removeEventListener("keyup", this.keyupHandler);
    }
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
  }
}

// ==========================================
// Shape drawing helpers
// ==========================================

const ALL_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-right",
  "middle-left",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];
const TEXT_ANCHORS = ["top-left", "top-right", "middle-left", "middle-right", "bottom-left", "bottom-right"];
const LINE_ANCHORS = ["middle-left", "middle-right"];
const CORNER_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];

function applyTextAttrs(node: Konva.Text, props: TextProperties): void {
  const weight = props.fontWeight === "bold" ? "bold" : props.fontWeight === "600" || props.fontWeight === "500" ? props.fontWeight : "";
  const style = [props.fontStyle === "italic" ? "italic" : "", weight].filter(Boolean).join(" ") || "normal";
  node.setAttrs({
    text: props.text || "",
    fontSize: props.fontSize || 24,
    fontFamily: props.fontFamily || "Inter, -apple-system, sans-serif",
    fill: props.fill || "#18181b",
    align: props.align || "left",
    fontStyle: style,
    lineHeight: props.lineHeight || 1.2,
  });
}

const orientedCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

/** The photo itself, or a mirrored copy of it (cached per image and orientation) */
function orientedImage(img: HTMLImageElement, flipX?: boolean, flipY?: boolean): CanvasImageSource {
  if (!flipX && !flipY) return img;
  const key = `${flipX ? "x" : ""}${flipY ? "y" : ""}`;
  let byKey = orientedCache.get(img);
  const cached = byKey?.get(key);
  if (cached) return cached;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h || typeof document === "undefined") return img;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img;
  ctx.translate(flipX ? w : 0, flipY ? h : 0);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(img, 0, 0, w, h);
  if (!byKey) {
    byKey = new Map();
    orientedCache.set(img, byKey);
  }
  byKey.set(key, canvas);
  return canvas;
}

function applyPolygonAttrs(node: Konva.Shape, props: ShapeProperties): void {
  const strokeWidth = props.stroke && props.stroke !== "transparent" ? props.strokeWidth || 0 : 0;
  node.setAttrs({
    polygonType: props.shapeType,
    flipX: Boolean(props.flipX),
    flipY: Boolean(props.flipY),
    fill: props.fill || "#3b82f6",
    stroke: strokeWidth > 0 ? props.stroke : undefined,
    strokeWidth,
    dash: dashPattern(props.dash, strokeWidth),
    lineJoin: "round",
  });
}

function applyLineAttrs(node: Konva.Shape, props: ShapeProperties): void {
  node.setAttrs({
    lineShape: true,
    stroke: props.fill || "#3b82f6",
    strokeWidth: props.strokeWidth || 4,
    lineDash: props.dash || "solid",
    startCap: props.startCap || "none",
    endCap: props.endCap || "none",
  });
}

/** Polygon outline scaled to the node's box */
function drawPolygonScene(ctx: Konva.Context, shape: Konva.Shape): void {
  const w = shape.width();
  const h = shape.height();
  const pts = polygonPoints(shape.getAttr("polygonType"), w, h);
  if (pts.length < 6) return;
  // Mirrored shapes: reflect the outline inside its own box
  if (shape.getAttr("flipX")) for (let i = 0; i < pts.length; i += 2) pts[i] = w - pts[i]!;
  if (shape.getAttr("flipY")) for (let i = 1; i < pts.length; i += 2) pts[i] = h - pts[i]!;
  ctx.beginPath();
  ctx.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

/** Horizontal line through the middle of the box, with optional end caps */
function drawLineScene(ctx: Konva.Context, shape: Konva.Shape): void {
  const w = shape.width();
  const y = shape.height() / 2;
  const sw = Math.max(1, shape.strokeWidth());
  const color = shape.stroke() as string;
  const head = Math.max(8, sw * 3);
  const startCap = shape.getAttr("startCap") as string;
  const endCap = shape.getAttr("endCap") as string;
  const inset = (cap: string) => (cap === "arrow" ? head * 0.8 : cap === "dot" ? sw * 1.2 : 0);
  const x0 = inset(startCap);
  const x1 = w - inset(endCap);
  const native = ctx._context;

  native.save();
  native.lineCap = shape.getAttr("lineDash") === "dotted" ? "round" : "butt";
  native.strokeStyle = color;
  native.lineWidth = sw;
  native.setLineDash(dashPattern(shape.getAttr("lineDash"), sw));
  native.beginPath();
  native.moveTo(x0, y);
  native.lineTo(Math.max(x0, x1), y);
  native.stroke();
  native.setLineDash([]);
  native.fillStyle = color;
  drawCap(native, startCap, 0, y, -1, sw, head);
  drawCap(native, endCap, w, y, 1, sw, head);
  native.restore();
}

function drawCap(
  ctx: CanvasRenderingContext2D,
  cap: string,
  x: number,
  y: number,
  dir: 1 | -1,
  sw: number,
  head: number
): void {
  if (cap === "arrow") {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dir * head, y - head * 0.55);
    ctx.lineTo(x - dir * head, y + head * 0.55);
    ctx.closePath();
    ctx.fill();
  } else if (cap === "bar") {
    ctx.fillRect(x - (dir === 1 ? sw : 0), y - head * 0.7, sw, head * 1.4);
  } else if (cap === "dot") {
    ctx.beginPath();
    ctx.arc(x - dir * sw * 1.2, y, sw * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Generous click target around the line */
function drawLineHit(ctx: Konva.Context, shape: Konva.Shape): void {
  const h = Math.max(shape.height(), 16);
  ctx.beginPath();
  ctx.rect(0, shape.height() / 2 - h / 2, shape.width(), h);
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

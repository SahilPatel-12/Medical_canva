import Konva from "konva";
import {
  DesignDocument,
  DesignElement,
  ShapeProperties,
  TextProperties,
  SvgProperties,
  ImageProperties,
  Asset,
} from "@design-platform/types";
import { loadSvgImage, loadUrlImage } from "./svgUtils";

export interface CanvasEngineCallbacks {
  onSelect: (elementId: string | null) => void;
  onElementChange: (elementId: string, updates: Partial<DesignElement>) => void;
  onDropAsset: (asset: Asset, position: { x: number; y: number }) => void;
  onZoomChange?: (zoom: number) => void;
  isReadOnly?: boolean;
}

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

    // Deselect when clicking on page background
    this.pageBackground.on("click tap", (e) => {
      e.cancelBubble = true;
      this.deselect();
    });

    // Deselect when clicking on empty stage area outside the page
    this.stage.on("click tap", (e) => {
      if (e.target === this.stage) {
        this.deselect();
      }
    });

    // Transformer for selection, resizing, and rotation (only enabled if not read-only)
    if (!this.isReadOnly) {
      this.initTransformer();
    }
    this.layer.draw();
  }

  private initTransformer(): void {
    if (this.transformer || !this.layer) return;

    this.transformer = new Konva.Transformer({
      borderStroke: "#3b82f6",
      borderStrokeWidth: 1.5,
      anchorStroke: "#2563eb",
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
        if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
          return oldBox;
        }
        return newBox;
      },
    });

    this.layer.add(this.transformer);
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
      const isMiddleClick = e.evt.button === 1;
      const isSpaceDrag = this.isSpacePressed && e.evt.button === 0;
      const isEmptyStageClick = (e.target === this.stage || e.target === this.pageBackground) && e.evt.button === 0;
      const isReadOnlyDrag = this.isReadOnly && e.evt.button === 0;

      if (isMiddleClick || isSpaceDrag || isEmptyStageClick || isReadOnlyDrag) {
        this.isPanning = true;
        this.lastPointerPos = this.stage.getPointerPosition();
        if (this.container) {
          this.container.style.cursor = "grabbing";
        }
      }
    });

    this.stage.on("mousemove touchmove", () => {
      if (!this.isPanning || !this.stage || !this.lastPointerPos) return;

      const currentPointer = this.stage.getPointerPosition();
      if (!currentPointer) return;

      const dx = currentPointer.x - this.lastPointerPos.x;
      const dy = currentPointer.y - this.lastPointerPos.y;

      const currentPos = this.stage.position();
      this.stage.position({
        x: currentPos.x + dx,
        y: currentPos.y + dy,
      });

      this.lastPointerPos = currentPointer;
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
      this.pageBackground.fill(doc.backgroundColor || "#ffffff");

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
        if (child === this.pageBackground) continue;
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
          await this.renderElement(el, i, currentElementIds);
        }
      }

      // Re-attach transformer if a selected node is still present
      const selectedNodes = this.transformer?.nodes();
      if (selectedNodes && selectedNodes.length > 0) {
        const activeNode = selectedNodes[0];
        if (activeNode) {
          const activeId = activeNode.name();
          if (!currentElementIds.has(activeId)) {
            this.deselect();
          } else {
            this.transformer?.forceUpdate();
          }
        }
      }

      this.layer.batchDraw();
    } finally {
      this.isRendering = false;
      if (this.pendingRenderDoc) {
        const nextDoc = this.pendingRenderDoc;
        const nextIdx = this.pendingRenderPageIndex;
        this.pendingRenderDoc = null;
        this.pendingRenderPageIndex = null;
        this.renderDocument(nextDoc, nextIdx ?? undefined);
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
      opacity: el.opacity ?? 1,
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
        return new Konva.Line({
          ...commonProps,
          points: [0, 0, el.width, el.height],
          stroke: props.fill || "#3b82f6",
          strokeWidth: props.strokeWidth || 4,
          lineCap: "round",
          lineJoin: "round",
        });
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
      return new Konva.Text({
        ...commonProps,
        text: props.text || "Heading",
        fontSize: props.fontSize || 24,
        fontFamily: props.fontFamily || "Inter, -apple-system, sans-serif",
        fill: props.fill || "#18181b",
        align: props.align || "left",
        fontStyle: props.fontWeight === "bold" ? "bold" : "normal",
        lineHeight: props.lineHeight || 1.2,
      });
    }

    if (el.type === "image") {
      const props = el.properties as ImageProperties;
      const src = props.src || props.originalSrc || "";
      if (!src) return null;
      try {
        const img = await loadUrlImage(src);
        return new Konva.Image({
          ...commonProps,
          image: img,
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

      const img = await loadSvgImage(svgSource);

      return new Konva.Image({
        ...commonProps,
        image: img,
      });
    }

    return null;
  }

  private async updateElementNode(node: Konva.Node, el: DesignElement): Promise<void> {
    if (!node.isDragging()) {
      node.x(el.x);
      node.y(el.y);
      node.width(el.width);
      node.height(el.height);
      node.rotation(el.rotation || 0);
      node.opacity(el.opacity ?? 1);
      node.draggable(this.isReadOnly ? false : !el.locked);
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
      } else if (node instanceof Konva.Rect) {
        node.fill(props.fill || "#3b82f6");
        node.stroke(props.stroke || "transparent");
        node.strokeWidth(props.strokeWidth || 0);
        node.cornerRadius(props.cornerRadius || 0);
      } else if (node instanceof Konva.Line) {
        node.points([0, 0, el.width, el.height]);
        node.stroke(props.fill || "#3b82f6");
        node.strokeWidth(props.strokeWidth || 4);
      }
    } else if (el.type === "text" && node instanceof Konva.Text) {
      const props = el.properties as TextProperties;
      node.text(props.text || "");
      node.fontSize(props.fontSize || 24);
      node.fontFamily(props.fontFamily || "Inter, -apple-system, sans-serif");
      node.fill(props.fill || "#18181b");
      node.align(props.align || "left");
      node.fontStyle(props.fontWeight === "bold" ? "bold" : "normal");
    } else if (el.type === "image" && node instanceof Konva.Image) {
      const props = el.properties as ImageProperties;
      const src = props.src || props.originalSrc || "";
      if (src) {
        try {
          const img = await loadUrlImage(src);
          node.image(img);
        } catch (err) {
          console.error("Failed to update image:", err);
        }
      }
    } else if (el.type === "svg" && node instanceof Konva.Image) {
      const props = el.properties as SvgProperties;
      const currentSvg = props.svgContent || props.originalSvg;
      try {
        if (currentSvg.startsWith("http://") || currentSvg.startsWith("https://")) {
          const img = await loadUrlImage(currentSvg);
          node.image(img);
        } else {
          const img = await loadSvgImage(currentSvg);
          node.image(img);
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
      this.select(elementId);
    });

    node.on("dragend", () => {
      let x = Math.round(node.x());
      let y = Math.round(node.y());

      if (node instanceof Konva.Circle) {
        const r = node.radius();
        x = Math.round(node.x() - r);
        y = Math.round(node.y() - r);
      }

      this.callbacks.onElementChange(elementId, { x, y });
    });

    node.on("transformend", () => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

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

      this.callbacks.onElementChange(elementId, {
        x,
        y,
        width,
        height,
        rotation,
      });
    });
  }

  public select(elementId: string): void {
    if (this.isReadOnly || !this.transformer || !this.layer) return;

    const node = this.nodeMap.get(elementId);
    if (node) {
      this.transformer.nodes([node]);
      this.layer.batchDraw();
      this.callbacks.onSelect(elementId);
    } else {
      this.deselect();
    }
  }

  public deselect(): void {
    if (!this.transformer || !this.layer) return;
    this.transformer.nodes([]);
    this.layer.batchDraw();
    this.callbacks.onSelect(null);
  }

  public setActivePageIndex(index: number): void {
    if (this.activePageIndex !== index) {
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
      if (this.transformer && wasVisible) {
        this.transformer.visible(true);
        this.layer?.batchDraw();
      }
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
    this.centerPage();
  }

  public destroy(): void {
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

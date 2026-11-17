import {
  DesignDocument,
  DesignElement,
  DesignRepository,
  Asset,
  Page,
  sanitizePages,
  getPageBackground,
  ShapeProperties,
  SvgProperties,
  ImageProperties,
} from "@design-platform/types";
import { isPolygonShape } from "../elements/shapeGeometry";
import { HistoryManager, Command } from "../commands/history";
import {
  modifySvgColors,
  decomposeSvgComponents,
  modifySvgComponentColor,
  applyScientificPreset,
  ScientificColorPreset,
  fetchSvgMarkup,
  combineElementsIntoSvgGroup,
  extractSvgViewBox,
  svgHasEditableLayers,
  getSvgLayerChildren,
  getSvgLayer,
  getSvgContentBounds,
  setSvgRootViewBox,
  transformSvgLayer,
  removeSvgLayer,
  duplicateSvgLayer,
  ungroupSvgLayer,
  recolorSvgLayer,
  hideSvgLayer,
  multiplySvgMatrix,
  invertSvgMatrix,
  SvgMatrix,
  SvgLayerInfo,
  SvgLayerGeometry,
} from "../canvas/svgUtils";
import { replaceSvgColors } from "../canvas/svgColors";
import { flipSvgMarkup, type FlipAxis } from "../canvas/svgFlip";

export type SaveStatus = "saved" | "saving" | "unsaved";

export interface GroupEditSession {
  /** Id of the illustration being edited (kept as `groupId` for compatibility) */
  groupId: string;
  groupName: string;
  elementId: string;
  /** Open group inside the illustration ([] = its top level) */
  containerPath: number[];
  selectedLayerPath: number[] | null;
  selectedLayerName: string | null;
  selectedLayerIsGroup: boolean;
  depth: number;
  /** Names from the illustration down to the open group, e.g. ["Heart", "Left ventricle"] */
  breadcrumb: string[];
  memberElementIds: string[];
}

export interface LayerNavState {
  elementId: string;
  containerPath: number[];
  selectedPath: number[] | null;
}

export interface LayerEditContext {
  elementId: string;
  /** Box of the open nested group (null when the illustration's top level is open) */
  containerBox: SvgLayerGeometry | null;
  /** Layers of the open group, bottom to top */
  children: SvgLayerGeometry[];
  /** Main (top-level) groups of the illustration: what a single click selects */
  clickTargets: SvgLayerGeometry[];
  selected: SvgLayerGeometry | null;
  /** Children of the selected layer when it is a group (preloaded for drilling in) */
  selectedChildren: SvgLayerGeometry[];
  /** Illustration markup without the selected layer (used for live drag previews) */
  hiddenMarkup: string | null;
}

export interface EditorState {
  document: DesignDocument;
  selectedId: string | null;
  /** Every selected element (one entry for a single selection, empty when nothing is selected) */
  selectedIds: string[];
  activePageIndex: number;
  zoom: number;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  groupEditSession: GroupEditSession | null;
}

export type StateListener = (state: EditorState) => void;

export type DocumentChangeAction =
  | {
      type: "element_update";
      elementId: string;
      updates: Partial<DesignElement>;
      pageIndex?: number;
      pageId?: string;
    }
  | {
      type: "element_add";
      element: DesignElement;
      pageIndex?: number;
      pageId?: string;
    }
  | {
      type: "element_delete";
      elementId: string;
      pageIndex?: number;
      pageId?: string;
    }
  | { type: "background_color"; color: string }
  | { type: "dimensions"; width: number; height: number }
  | { type: "page_add"; page: Page }
  | { type: "page_delete"; pageIndex: number }
  | { type: "pages_sync"; pages: Page[] };

export type ChangeBroadcastListener = (action: DocumentChangeAction) => void;

export class EditorStore {
  private document: DesignDocument;
  private selectedId: string | null = null;
  /** Multi-selection; only meaningful while it contains the primary `selectedId` */
  private multiIds: string[] | null = null;
  private clipboardMany: DesignElement[] | null = null;
  private activePageIndex: number = 0;
  private zoom: number = 1;
  private saveStatus: SaveStatus = "saved";
  private history: HistoryManager;
  private listeners: Set<StateListener> = new Set();
  private changeListeners: Set<ChangeBroadcastListener> = new Set();
  private isApplyingRemoteChange: boolean = false;
  private clipboard: DesignElement | null = null;
  private layerNav: LayerNavState | null = null;
  private layerCtxCache: { element: DesignElement; key: string; ctx: LayerEditContext } | null = null;

  constructor(initialDoc: DesignDocument) {
    this.document = initialDoc;
    this.ensurePage();
    this.history = new HistoryManager(50);
    this.history.subscribe(() => this.notify());
  }

  public onDocumentChange(listener: ChangeBroadcastListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private emitChange(action: DocumentChangeAction): void {
    if (this.isApplyingRemoteChange) return;
    this.changeListeners.forEach((fn) => {
      try {
        fn(action);
      } catch (err) {
        console.warn("[EditorStore] Error in change listener:", err);
      }
    });
  }

  private ensurePage(): Page {
    if (!this.document.pages || this.document.pages.length === 0) {
      const defaultPage: Page = { id: "page-1", name: "Page 1", elements: [] };
      this.document = {
        ...this.document,
        pages: [defaultPage],
      };
      this.activePageIndex = 0;
      return defaultPage;
    }
    if (this.activePageIndex >= this.document.pages.length) {
      this.activePageIndex = Math.max(0, this.document.pages.length - 1);
    }
    return this.document.pages[this.activePageIndex] as Page;
  }

  private setPageElements(elements: DesignElement[]): void {
    const page = this.ensurePage();
    const updatedPage: Page = {
      ...page,
      elements,
    };
    const newPages = [...this.document.pages];
    newPages[this.activePageIndex] = updatedPage;
    this.document = {
      ...this.document,
      pages: newPages,
    };
    this.markDirty();
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.validateLayerNav();
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  public getState(): EditorState {
    return {
      document: this.document,
      selectedId: this.selectedId,
      selectedIds: this.getSelectedIds(),
      activePageIndex: this.activePageIndex,
      zoom: this.zoom,
      saveStatus: this.saveStatus,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      groupEditSession: this.currentGroupEditSnapshot(),
    };
  }

  public getDocument(): DesignDocument {
    return this.document;
  }

  public getSelectedId(): string | null {
    return this.selectedId;
  }

  public getSelectedElement(): DesignElement | null {
    if (!this.selectedId) return null;
    const activePage = this.ensurePage();
    return activePage.elements.find((el) => el.id === this.selectedId) || null;
  }

  public getActivePageIndex(): number {
    return this.activePageIndex;
  }

  public setActivePageIndex(index: number): void {
    const pageCount = this.document.pages ? this.document.pages.length : 1;
    const clamped = Math.max(0, Math.min(pageCount - 1, index));
    if (this.activePageIndex !== clamped) {
      this.exitAllGroupEdits();
      this.activePageIndex = clamped;
      this.selectedId = null;
      this.notify();
    }
  }

  public getActivePage(): Page {
    return this.ensurePage();
  }

  public addPage(name?: string, afterIndex?: number): Page {
    this.exitAllGroupEdits();
    const pageCount = this.document.pages ? this.document.pages.length : 0;
    const insertAt =
      typeof afterIndex === "number" && !isNaN(afterIndex) && afterIndex >= 0 && afterIndex < pageCount
        ? afterIndex + 1
        : pageCount;
    const appended = insertAt === pageCount;
    const safeName =
      typeof name === "string" && name.trim().length > 0
        ? name.trim()
        : `Page ${pageCount + 1}`;

    const newPage: Page = {
      id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: safeName,
      elements: [],
    };
    const previousPages = this.document.pages ? [...this.document.pages] : [];
    const newPages = [...previousPages];
    newPages.splice(insertAt, 0, newPage);
    // Collaborators append on "page_add"; an insertion in the middle syncs the full page list
    const emitAdd = () =>
      this.emitChange(appended ? { type: "page_add", page: newPage } : { type: "pages_sync", pages: newPages });

    const command: Command = {
      name: "Add Canvas Page",
      execute: () => {
        this.document = { ...this.document, pages: newPages };
        this.activePageIndex = insertAt;
        this.selectedId = null;
        this.markDirty();
        emitAdd();
      },
      undo: () => {
        this.document = { ...this.document, pages: previousPages };
        this.activePageIndex = Math.max(0, Math.min(insertAt - 1, previousPages.length - 1));
        this.selectedId = null;
        this.markDirty();
        this.emitChange({ type: "page_delete", pageIndex: insertAt });
      },
      redo: () => {
        this.document = { ...this.document, pages: newPages };
        this.activePageIndex = insertAt;
        this.selectedId = null;
        this.markDirty();
        emitAdd();
      },
    };

    this.history.execute(command);
    return newPage;
  }

  public duplicatePage(indexToDuplicate?: number): Page {
    this.exitAllGroupEdits();
    const idx =
      typeof indexToDuplicate === "number" && !isNaN(indexToDuplicate)
        ? indexToDuplicate
        : this.activePageIndex;
    const sourcePage = (this.document.pages && this.document.pages[idx]) || this.ensurePage();
    const clonedElements: DesignElement[] = sourcePage.elements.map((el) => ({
      ...el,
      id: `elem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      properties: { ...el.properties },
    }));

    const rawName = sourcePage.name;
    const baseName =
      typeof rawName === "string" && rawName.trim().length > 0
        ? rawName.trim()
        : `Page ${idx + 1}`;

    const newPage: Page = {
      id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `${baseName} (Copy)`,
      ...(sourcePage.backgroundColor ? { backgroundColor: sourcePage.backgroundColor } : {}),
      elements: clonedElements,
    };

    const previousPages = this.document.pages ? [...this.document.pages] : [];
    const newPages = [...previousPages];
    newPages.splice(idx + 1, 0, newPage);

    const command: Command = {
      name: "Duplicate Canvas Page",
      execute: () => {
        this.document = { ...this.document, pages: newPages };
        this.activePageIndex = idx + 1;
        this.selectedId = null;
        this.markDirty();
        this.emitChange({ type: "pages_sync", pages: newPages });
      },
      undo: () => {
        this.document = { ...this.document, pages: previousPages };
        this.activePageIndex = Math.min(idx, previousPages.length - 1);
        this.selectedId = null;
        this.markDirty();
        this.emitChange({ type: "pages_sync", pages: previousPages });
      },
      redo: () => {
        this.document = { ...this.document, pages: newPages };
        this.activePageIndex = idx + 1;
        this.selectedId = null;
        this.markDirty();
        this.emitChange({ type: "pages_sync", pages: newPages });
      },
    };

    this.history.execute(command);
    return newPage;
  }

  public deletePage(pageIndex?: number): boolean {
    if (!this.document.pages || this.document.pages.length <= 1) {
      return false;
    }
    this.exitAllGroupEdits();
    const idx =
      typeof pageIndex === "number" && !isNaN(pageIndex)
        ? pageIndex
        : this.activePageIndex;
    if (idx < 0 || idx >= this.document.pages.length) return false;

    const previousPages = [...this.document.pages];
    const newPages = previousPages.filter((_, i) => i !== idx);
    const nextActiveIndex = Math.min(idx, newPages.length - 1);

    const command: Command = {
      name: "Delete Canvas Page",
      execute: () => {
        this.document = { ...this.document, pages: newPages };
        this.activePageIndex = nextActiveIndex;
        this.selectedId = null;
        this.markDirty();
        this.emitChange({ type: "page_delete", pageIndex: idx });
      },
      undo: () => {
        this.document = { ...this.document, pages: previousPages };
        this.activePageIndex = idx;
        this.selectedId = null;
        this.markDirty();
        this.emitChange({ type: "pages_sync", pages: previousPages });
      },
      redo: () => {
        this.document = { ...this.document, pages: newPages };
        this.activePageIndex = nextActiveIndex;
        this.selectedId = null;
        this.markDirty();
        this.emitChange({ type: "page_delete", pageIndex: idx });
      },
    };

    this.history.execute(command);
    return true;
  }

  public reorderPages(fromIndex: number, toIndex: number): void {
    if (
      !this.document.pages ||
      typeof fromIndex !== "number" ||
      typeof toIndex !== "number" ||
      isNaN(fromIndex) ||
      isNaN(toIndex) ||
      fromIndex === toIndex ||
      fromIndex < 0 ||
      fromIndex >= this.document.pages.length ||
      toIndex < 0 ||
      toIndex >= this.document.pages.length
    ) {
      return;
    }

    const previousPages = [...this.document.pages];
    const newPages = [...previousPages];
    const [moved] = newPages.splice(fromIndex, 1);
    if (moved) {
      newPages.splice(toIndex, 0, moved);
    }

    this.document = { ...this.document, pages: newPages };
    this.activePageIndex = toIndex;
    this.markDirty();
    this.emitChange({ type: "pages_sync", pages: newPages });
  }

  public setPageName(pageIndex: number, name: string): void {
    if (
      typeof pageIndex !== "number" ||
      typeof name !== "string" ||
      !this.document.pages ||
      !this.document.pages[pageIndex]
    ) {
      return;
    }
    const page = this.document.pages[pageIndex];
    const safeName = name.trim();
    if (page && page.name !== safeName) {
      const pages = this.document.pages.map((p, i) => (i === pageIndex ? { ...p, name: safeName } : p));
      this.document = { ...this.document, pages };
      this.markDirty();
      this.emitChange({ type: "pages_sync", pages });
    }
  }

  public updatePageThumbnail(pageIndex: number, thumbnail: string): void {
    if (
      typeof pageIndex !== "number" ||
      typeof thumbnail !== "string" ||
      !this.document.pages ||
      !this.document.pages[pageIndex]
    ) {
      return;
    }
    const page = this.document.pages[pageIndex];
    if (page && page.thumbnail !== thumbnail) {
      page.thumbnail = thumbnail;
      this.notify();
    }
  }

  public setDocument(doc: DesignDocument): void {
    this.document = doc;
    this.layerNav = null;
    if (!this.document.pages || this.document.pages.length === 0) {
      this.document.pages = [{ id: "page-1", name: "Page 1", elements: [] }];
    }
    if (this.activePageIndex >= this.document.pages.length) {
      this.activePageIndex = 0;
    }
    this.selectedId = null;
    this.history.clear();
    this.saveStatus = "saved";
    this.notify();
  }

  public setZoom(zoom: number): void {
    this.zoom = zoom;
    this.notify();
  }

  public selectElement(id: string | null): void {
    const wasMulti = this.getSelectedIds().length > 1;
    if (this.selectedId !== id || this.layerNav || wasMulti) {
      this.layerNav = null;
      this.multiIds = null;
      this.selectedId = id;
      this.notify();
    }
  }

  // ==========================================
  // Multi-selection
  // ==========================================

  /** All selected element ids on the active page (in stacking order) */
  public getSelectedIds(): string[] {
    const elements = this.document.pages?.[this.activePageIndex]?.elements || [];
    if (this.multiIds && this.selectedId && this.multiIds.includes(this.selectedId)) {
      const set = new Set(this.multiIds);
      const ids = elements.filter((el) => set.has(el.id)).map((el) => el.id);
      if (ids.length > 1) return ids;
    }
    return this.selectedId && elements.some((el) => el.id === this.selectedId) ? [this.selectedId] : [];
  }

  public getSelectedElements(): DesignElement[] {
    const set = new Set(this.getSelectedIds());
    return (this.document.pages?.[this.activePageIndex]?.elements || []).filter((el) => set.has(el.id));
  }

  /** Replaces the selection. Locked elements are left out of multi-selections. */
  public setSelection(ids: string[]): void {
    const elements = this.document.pages?.[this.activePageIndex]?.elements || [];
    const byId = new Map(elements.map((el) => [el.id, el]));
    let next = [...new Set(ids)].filter((id) => byId.has(id));
    if (next.length > 1) next = next.filter((id) => !byId.get(id)!.locked);
    this.layerNav = null;
    if (next.length === 0) {
      this.multiIds = null;
      this.selectedId = null;
    } else if (next.length === 1) {
      this.multiIds = null;
      this.selectedId = next[0]!;
    } else {
      this.multiIds = next;
      this.selectedId = next[next.length - 1]!;
    }
    this.notify();
  }

  /** Shift-click: add or remove one element */
  public toggleInSelection(id: string): void {
    const current = this.getSelectedIds();
    this.setSelection(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  public selectAll(): void {
    this.setSelection((this.document.pages?.[this.activePageIndex]?.elements || []).map((el) => el.id));
  }

  /** Applies several element updates as one undoable step */
  public updateElements(batch: Array<{ id: string; updates: Partial<DesignElement> }>): void {
    const pageIdx = this.activePageIndex;
    const page = this.document.pages?.[pageIdx];
    if (!page || batch.length === 0) return;
    if (batch.length === 1) {
      this.updateElement(batch[0]!.id, batch[0]!.updates);
      return;
    }
    const byId = new Map(page.elements.map((el) => [el.id, el]));
    const before = new Map<string, DesignElement>();
    const after = new Map<string, DesignElement>();
    for (const { id, updates } of batch) {
      const el = after.get(id) || byId.get(id);
      if (!el) continue;
      if (!before.has(id)) before.set(id, byId.get(id)!);
      after.set(id, {
        ...el,
        ...updates,
        properties: updates.properties ? { ...el.properties, ...updates.properties } : el.properties,
      });
    }
    if (after.size === 0) return;
    const pageId = page.id;
    const apply = (states: Map<string, DesignElement>) => {
      const pages = this.document.pages ? [...this.document.pages] : [];
      const cur = pages[pageIdx];
      if (!cur) return;
      pages[pageIdx] = { ...cur, elements: cur.elements.map((el) => states.get(el.id) || el) };
      this.document = { ...this.document, pages };
      this.markDirty();
      states.forEach((state, id) =>
        this.emitChange({ type: "element_update", elementId: id, updates: state, pageIndex: pageIdx, pageId })
      );
    };
    this.history.execute({
      name: `Update ${after.size} elements`,
      execute: () => apply(after),
      undo: () => apply(before),
      redo: () => apply(after),
    });
  }

  /** Deletes every selected element in one undoable step */
  public deleteSelection(): void {
    const ids = this.getSelectedIds();
    if (ids.length <= 1) {
      this.deleteElement();
      return;
    }
    const pageIdx = this.activePageIndex;
    const page = this.document.pages?.[pageIdx];
    if (!page) return;
    const pageId = page.id;
    const removed = new Set(ids);
    const previous = page.elements;
    const next = previous.filter((el) => !removed.has(el.id));
    const setElements = (elements: DesignElement[], select: string[] | null) => {
      const pages = this.document.pages ? [...this.document.pages] : [];
      const cur = pages[pageIdx];
      if (!cur) return;
      pages[pageIdx] = { ...cur, elements };
      this.document = { ...this.document, pages };
      this.layerNav = null;
      this.multiIds = select && select.length > 1 ? select : null;
      this.selectedId = select && select.length ? select[select.length - 1]! : null;
      this.markDirty();
      this.emitChange({ type: "pages_sync", pages });
    };
    this.history.execute({
      name: `Delete ${ids.length} elements`,
      execute: () => setElements(next, null),
      undo: () => setElements(previous, ids),
      redo: () => setElements(next, null),
    });
    void pageId;
  }

  /** Duplicates every selected element (offset by 24px) and selects the copies */
  public duplicateSelection(): void {
    const selected = this.getSelectedElements();
    if (selected.length <= 1) {
      this.duplicateElement();
      return;
    }
    this.insertMany(selected.map((el) => ({ ...el, x: el.x + 24, y: el.y + 24 })), "Duplicate");
  }

  public copySelection(): void {
    const selected = this.getSelectedElements();
    if (selected.length > 1) {
      this.clipboardMany = JSON.parse(JSON.stringify(selected));
      this.clipboard = null;
    } else {
      this.clipboardMany = null;
      this.copySelected();
    }
  }

  public pasteSelection(): void {
    if (this.clipboardMany && this.clipboardMany.length > 0) {
      this.insertMany(
        this.clipboardMany.map((el) => ({ ...el, x: el.x + 24, y: el.y + 24 })),
        "Paste"
      );
      // Next paste lands a bit further
      this.clipboardMany = this.clipboardMany.map((el) => ({ ...el, x: el.x + 24, y: el.y + 24 }));
      return;
    }
    this.pasteClipboard();
  }

  /** Adds copies of elements (new ids) above everything, as one step, and selects them */
  private insertMany(sources: DesignElement[], label: string): void {
    const pageIdx = this.activePageIndex;
    const page = this.document.pages?.[pageIdx];
    if (!page) return;
    const copies = sources.map((el) => ({
      ...el,
      id: `elem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      properties: JSON.parse(JSON.stringify(el.properties)),
    }));
    const previous = page.elements;
    const next = [...previous, ...copies];
    const ids = copies.map((c) => c.id);
    const setElements = (elements: DesignElement[], select: string[] | null) => {
      const pages = this.document.pages ? [...this.document.pages] : [];
      const cur = pages[pageIdx];
      if (!cur) return;
      pages[pageIdx] = { ...cur, elements };
      this.document = { ...this.document, pages };
      this.layerNav = null;
      this.multiIds = select && select.length > 1 ? select : null;
      this.selectedId = select && select.length ? select[select.length - 1]! : null;
      this.markDirty();
      this.emitChange({ type: "pages_sync", pages });
    };
    this.history.execute({
      name: `${label} ${copies.length} elements`,
      execute: () => setElements(next, ids),
      undo: () => setElements(previous, null),
      redo: () => setElements(next, ids),
    });
  }

  /** True when something was copied and can be pasted */
  public hasClipboard(): boolean {
    return Boolean(this.clipboard || (this.clipboardMany && this.clipboardMany.length));
  }

  /** Copies the selection to the clipboard, then removes it */
  public cutSelection(): void {
    if (this.getSelectedIds().length === 0) return;
    this.copySelection();
    this.deleteSelection();
  }

  /** Whether an element can be mirrored (symmetric boxes, text and URL-only artwork cannot) */
  public canFlip(el: DesignElement | null | undefined, axis: FlipAxis = "horizontal"): boolean {
    if (!el || el.locked) return false;
    if (el.type === "svg") return Boolean(this.markupOf(el));
    if (el.type === "image") return true;
    if (el.type === "shape") {
      const props = el.properties as ShapeProperties;
      if (props.shapeType === "line") return axis === "horizontal" && props.startCap !== props.endCap;
      return isPolygonShape(props.shapeType);
    }
    return false;
  }

  /** The property changes that mirror one element in place, or null when it cannot flip */
  private flippedProperties(el: DesignElement, axis: FlipAxis): DesignElement["properties"] | null {
    if (!this.canFlip(el, axis)) return null;
    const horizontal = axis === "horizontal";
    if (el.type === "svg") {
      const props = el.properties as SvgProperties;
      const next: SvgProperties = { ...props };
      if (props.svgContent?.includes("<svg")) next.svgContent = flipSvgMarkup(props.svgContent, axis);
      // The original stays mirrored too, so "reset colors" keeps the orientation
      if (props.originalSvg?.includes("<svg")) next.originalSvg = flipSvgMarkup(props.originalSvg, axis);
      return next;
    }
    if (el.type === "image") {
      const props = el.properties as ImageProperties;
      return horizontal ? { ...props, flipX: !props.flipX } : { ...props, flipY: !props.flipY };
    }
    const props = el.properties as ShapeProperties;
    if (props.shapeType === "line") return { ...props, startCap: props.endCap, endCap: props.startCap };
    return horizontal ? { ...props, flipX: !props.flipX } : { ...props, flipY: !props.flipY };
  }

  /** Mirrors every selected element in place (one undo step) */
  public flipSelection(axis: FlipAxis): void {
    const batch = this.getSelectedElements()
      .map((el) => ({ id: el.id, properties: this.flippedProperties(el, axis) }))
      .filter((b): b is { id: string; properties: DesignElement["properties"] } => b.properties !== null)
      .map(({ id, properties }) => ({ id, updates: { properties } }));
    this.updateElements(batch);
  }

  /** Locks the selection, or unlocks it when everything selected is already locked */
  public toggleLockSelection(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    const lock = !selected.every((el) => el.locked);
    this.updateElements(selected.map((el) => ({ id: el.id, updates: { locked: lock } })));
  }

  /** Moves every selected (unlocked) element */
  public nudgeSelection(dx: number, dy: number): void {
    const batch = this.getSelectedElements()
      .filter((el) => !el.locked)
      .map((el) => ({ id: el.id, updates: { x: el.x + dx, y: el.y + dy } }));
    this.updateElements(batch);
  }

  /** Bounding box of the selection (unrotated element boxes) */
  public getSelectionBounds(): { x: number; y: number; width: number; height: number } | null {
    const els = this.getSelectedElements();
    if (els.length === 0) return null;
    const minX = Math.min(...els.map((e) => e.x));
    const minY = Math.min(...els.map((e) => e.y));
    const maxX = Math.max(...els.map((e) => e.x + e.width));
    const maxY = Math.max(...els.map((e) => e.y + e.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  /** Aligns the selected elements to each other (one step) */
  public alignSelection(edge: "left" | "center" | "right" | "top" | "middle" | "bottom"): void {
    const els = this.getSelectedElements().filter((el) => !el.locked);
    const b = this.getSelectionBounds();
    if (els.length < 2 || !b) return;
    const r = (n: number) => Math.round(n);
    this.updateElements(
      els.map((el) => ({
        id: el.id,
        updates:
          edge === "left"
            ? { x: b.x }
            : edge === "center"
              ? { x: r(b.x + b.width / 2 - el.width / 2) }
              : edge === "right"
                ? { x: r(b.x + b.width - el.width) }
                : edge === "top"
                  ? { y: b.y }
                  : edge === "middle"
                    ? { y: r(b.y + b.height / 2 - el.height / 2) }
                    : { y: r(b.y + b.height - el.height) },
      }))
    );
  }

  /** Moves the selection (as one block) to an edge or the center of the page */
  public alignSelectionToPage(edge: "left" | "center" | "right" | "top" | "middle" | "bottom"): void {
    const els = this.getSelectedElements().filter((el) => !el.locked);
    const b = this.getSelectionBounds();
    if (els.length === 0 || !b) return;
    const W = this.document.width;
    const H = this.document.height;
    const dx =
      edge === "left" ? -b.x : edge === "center" ? W / 2 - (b.x + b.width / 2) : edge === "right" ? W - (b.x + b.width) : 0;
    const dy =
      edge === "top" ? -b.y : edge === "middle" ? H / 2 - (b.y + b.height / 2) : edge === "bottom" ? H - (b.y + b.height) : 0;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    this.updateElements(
      els.map((el) => ({ id: el.id, updates: { x: Math.round(el.x + dx), y: Math.round(el.y + dy) } }))
    );
  }

  /** Spaces the selected elements evenly (needs three or more) */
  public distributeSelection(axis: "horizontal" | "vertical"): void {
    const els = this.getSelectedElements().filter((el) => !el.locked);
    if (els.length < 3) return;
    const pos = (el: DesignElement) => (axis === "horizontal" ? el.x : el.y);
    const size = (el: DesignElement) => (axis === "horizontal" ? el.width : el.height);
    const sorted = [...els].sort((a, b) => pos(a) - pos(b));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const span = pos(last) + size(last) - pos(first);
    const total = sorted.reduce((sum, el) => sum + size(el), 0);
    const gap = (span - total) / (sorted.length - 1);
    let cursor = pos(first);
    const batch = sorted.map((el) => {
      const update = axis === "horizontal" ? { x: Math.round(cursor) } : { y: Math.round(cursor) };
      cursor += size(el) + gap;
      return { id: el.id, updates: update };
    });
    this.updateElements(batch);
  }

  public setSaveStatus(status: SaveStatus): void {
    if (this.saveStatus !== status) {
      this.saveStatus = status;
      this.notify();
    }
  }

  private markDirty(): void {
    if (this.isApplyingRemoteChange) return;
    this.saveStatus = "unsaved";
    this.document = {
      ...this.document,
      updatedAt: new Date().toISOString(),
    };
    this.notify();
  }

  // ==========================================
  // Element Actions with Command History
  // ==========================================

  public addElement(element: DesignElement, targetPageIndex?: number): void {
    const targetIdx =
      typeof targetPageIndex === "number" && !isNaN(targetPageIndex)
        ? Math.max(0, Math.min(this.document.pages ? this.document.pages.length - 1 : 0, targetPageIndex))
        : this.activePageIndex;

    const command: Command = {
      name: `Add ${element.type}`,
      execute: () => {
        const pages = this.document.pages ? [...this.document.pages] : [];
        if (pages.length === 0) {
          pages.push({ id: "page-1", name: "Page 1", elements: [] });
        }
        const safeIdx = Math.max(0, Math.min(pages.length - 1, targetIdx));
        const page = pages[safeIdx] || pages[0]!;
        const pageId = page.id;

        const updatedPage: Page = {
          ...page,
          elements: [...page.elements, element],
        };
        const newPages = [...pages];
        newPages[safeIdx] = updatedPage;
        this.document = {
          ...this.document,
          pages: newPages,
        };
        // A new element becomes the selection; leave any parts editing of another illustration
        this.layerNav = null;
        this.selectedId = element.id;
        this.markDirty();
        this.emitChange({
          type: "element_add",
          element,
          pageIndex: safeIdx,
          pageId,
        });
      },
      undo: () => {
        const pages = this.document.pages ? [...this.document.pages] : [];
        const safeIdx = Math.max(0, Math.min(pages.length - 1, targetIdx));
        const page = pages[safeIdx];
        if (page) {
          const updatedPage: Page = {
            ...page,
            elements: page.elements.filter((el) => el.id !== element.id),
          };
          const newPages = [...pages];
          newPages[safeIdx] = updatedPage;
          this.document = {
            ...this.document,
            pages: newPages,
          };
          if (this.selectedId === element.id) {
            this.selectedId = null;
          }
          this.markDirty();
          this.emitChange({
            type: "element_delete",
            elementId: element.id,
            pageIndex: safeIdx,
            pageId: page.id,
          });
        }
      },
      redo: () => {
        const pages = this.document.pages ? [...this.document.pages] : [];
        if (pages.length === 0) {
          pages.push({ id: "page-1", name: "Page 1", elements: [] });
        }
        const safeIdx = Math.max(0, Math.min(pages.length - 1, targetIdx));
        const page = pages[safeIdx] || pages[0]!;
        const pageId = page.id;

        const updatedPage: Page = {
          ...page,
          elements: [...page.elements, element],
        };
        const newPages = [...pages];
        newPages[safeIdx] = updatedPage;
        this.document = {
          ...this.document,
          pages: newPages,
        };
        // A new element becomes the selection; leave any parts editing of another illustration
        this.layerNav = null;
        this.selectedId = element.id;
        this.markDirty();
        this.emitChange({
          type: "element_add",
          element,
          pageIndex: safeIdx,
          pageId,
        });
      },
    };

    this.history.execute(command);
  }

  public updateElement(
    id: string,
    updates: Partial<DesignElement>,
    skipHistory: boolean = false
  ): void {
    const pages = this.document.pages ? [...this.document.pages] : [];
    let pageIdx = this.activePageIndex;
    let targetElement = pages[pageIdx]?.elements.find((el) => el.id === id);

    if (!targetElement) {
      for (let i = 0; i < pages.length; i++) {
        const found = pages[i]?.elements.find((el) => el.id === id);
        if (found) {
          pageIdx = i;
          targetElement = found;
          break;
        }
      }
    }
    if (!targetElement || !pages[pageIdx]) return;

    const targetPage = pages[pageIdx]!;
    const pageId = targetPage.id;

    const previousState = { ...targetElement, properties: { ...targetElement.properties } };
    const nextState = {
      ...targetElement,
      ...updates,
      properties: updates.properties
        ? { ...targetElement.properties, ...updates.properties }
        : targetElement.properties,
    };

    const applyState = (state: DesignElement) => {
      const currentPages = this.document.pages ? [...this.document.pages] : [];
      const curPage = currentPages[pageIdx];
      if (!curPage) return;

      const updatedPage: Page = {
        ...curPage,
        elements: curPage.elements.map((el) => (el.id === id ? state : el)),
      };
      const newPages = [...currentPages];
      newPages[pageIdx] = updatedPage;
      this.document = {
        ...this.document,
        pages: newPages,
      };
      this.markDirty();
      this.emitChange({
        type: "element_update",
        elementId: id,
        updates,
        pageIndex: pageIdx,
        pageId,
      });
    };

    if (skipHistory) {
      applyState(nextState);
      return;
    }

    const command: Command = {
      name: `Update ${targetElement.type}`,
      execute: () => applyState(nextState),
      undo: () => applyState(previousState),
      redo: () => applyState(nextState),
    };

    this.history.execute(command);
  }

  public deleteElement(id?: string): void {
    // With a layer selected inside an illustration, Delete removes just that layer
    if (!id && this.layerNav?.selectedPath) {
      this.deleteSelectedLayer();
      return;
    }
    if (this.layerNav && (!id || id === this.layerNav.elementId)) this.layerNav = null;
    const targetId = id || this.selectedId;
    if (!targetId) return;

    const pages = this.document.pages ? [...this.document.pages] : [];
    let pageIdx = this.activePageIndex;
    let targetElement = pages[pageIdx]?.elements.find((el) => el.id === targetId);

    if (!targetElement) {
      for (let i = 0; i < pages.length; i++) {
        const found = pages[i]?.elements.find((el) => el.id === targetId);
        if (found) {
          pageIdx = i;
          targetElement = found;
          break;
        }
      }
    }
    if (!targetElement || !pages[pageIdx]) return;

    const targetPage = pages[pageIdx]!;
    const pageId = targetPage.id;
    const element = targetElement;
    const elementIndex = targetPage.elements.indexOf(targetElement);

    const command: Command = {
      name: `Delete ${element.type}`,
      execute: () => {
        const currentPages = this.document.pages ? [...this.document.pages] : [];
        const curPage = currentPages[pageIdx];
        if (!curPage) return;

        const updatedPage: Page = {
          ...curPage,
          elements: curPage.elements.filter((el) => el.id !== targetId),
        };
        const newPages = [...currentPages];
        newPages[pageIdx] = updatedPage;
        this.document = { ...this.document, pages: newPages };

        if (this.selectedId === targetId) {
          this.selectedId = null;
        }
        this.markDirty();
        this.emitChange({
          type: "element_delete",
          elementId: targetId,
          pageIndex: pageIdx,
          pageId,
        });
      },
      undo: () => {
        const currentPages = this.document.pages ? [...this.document.pages] : [];
        const curPage = currentPages[pageIdx];
        if (!curPage) return;

        const newElements = [...curPage.elements];
        newElements.splice(elementIndex, 0, element);
        const updatedPage: Page = {
          ...curPage,
          elements: newElements,
        };
        const newPages = [...currentPages];
        newPages[pageIdx] = updatedPage;
        this.document = { ...this.document, pages: newPages };

        this.selectedId = targetId;
        this.markDirty();
        this.emitChange({
          type: "element_add",
          element,
          pageIndex: pageIdx,
          pageId,
        });
      },
      redo: () => {
        const currentPages = this.document.pages ? [...this.document.pages] : [];
        const curPage = currentPages[pageIdx];
        if (!curPage) return;

        const updatedPage: Page = {
          ...curPage,
          elements: curPage.elements.filter((el) => el.id !== targetId),
        };
        const newPages = [...currentPages];
        newPages[pageIdx] = updatedPage;
        this.document = { ...this.document, pages: newPages };

        if (this.selectedId === targetId) {
          this.selectedId = null;
        }
        this.markDirty();
        this.emitChange({
          type: "element_delete",
          elementId: targetId,
          pageIndex: pageIdx,
          pageId,
        });
      },
    };

    this.history.execute(command);
  }


  public duplicateElement(id?: string): void {
    if (!id && this.layerNav?.selectedPath) {
      this.duplicateSelectedLayer();
      return;
    }
    const targetId = id || this.selectedId;
    if (!targetId) return;

    const pages = this.document.pages || [];
    let pageIdx = this.activePageIndex;
    let original = pages[pageIdx]?.elements.find((el) => el.id === targetId);
    if (!original) {
      for (let i = 0; i < pages.length; i++) {
        const found = pages[i]?.elements.find((el) => el.id === targetId);
        if (found) {
          pageIdx = i;
          original = found;
          break;
        }
      }
    }
    if (!original) return;

    const cloned: DesignElement = {
      ...original,
      id: `elem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      x: original.x + 24,
      y: original.y + 24,
      properties: { ...original.properties },
    };

    this.addElement(cloned, pageIdx);
  }

  public copySelected(): void {
    const selected = this.getSelectedElement();
    if (selected) {
      this.clipboard = JSON.parse(JSON.stringify(selected));
    }
  }

  public pasteClipboard(): void {
    if (!this.clipboard) return;

    const newElement: DesignElement = {
      ...this.clipboard,
      id: `elem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      x: this.clipboard.x + 24,
      y: this.clipboard.y + 24,
      properties: { ...this.clipboard.properties },
    };

    this.addElement(newElement);
  }

  // ==========================================
  // Layer Reordering
  // ==========================================

  /** Moves an element to a position in the active page's stacking order (0 = bottom) */
  public moveElementTo(id: string, toIndex: number): void {
    const elements = [...this.ensurePage().elements];
    const from = elements.findIndex((el) => el.id === id);
    if (from === -1) return;
    const to = Math.max(0, Math.min(elements.length - 1, Math.round(toIndex)));
    if (from === to) return;
    const [moved] = elements.splice(from, 1);
    if (!moved) return;
    elements.splice(to, 0, moved);
    this.reorderElements(elements);
  }

  public bringForward(id?: string): void {
    const targetId = id || this.selectedId;
    if (!targetId) return;

    const activePage = this.ensurePage();
    const index = activePage.elements.findIndex((el) => el.id === targetId);
    if (index === -1 || index >= activePage.elements.length - 1) return;

    const elements = [...activePage.elements];
    const current = elements[index];
    const next = elements[index + 1];
    if (current && next) {
      elements[index] = next;
      elements[index + 1] = current;
      this.reorderElements(elements);
    }
  }

  public sendBackward(id?: string): void {
    const targetId = id || this.selectedId;
    if (!targetId) return;

    const activePage = this.ensurePage();
    const index = activePage.elements.findIndex((el) => el.id === targetId);
    if (index <= 0) return;

    const elements = [...activePage.elements];
    const current = elements[index];
    const prev = elements[index - 1];
    if (current && prev) {
      elements[index] = prev;
      elements[index - 1] = current;
      this.reorderElements(elements);
    }
  }

  public bringToFront(id?: string): void {
    const targetId = id || this.selectedId;
    if (!targetId) return;

    const activePage = this.ensurePage();
    const index = activePage.elements.findIndex((el) => el.id === targetId);
    if (index === -1 || index >= activePage.elements.length - 1) return;

    const elements = [...activePage.elements];
    const [target] = elements.splice(index, 1);
    if (target) {
      elements.push(target);
      this.reorderElements(elements);
    }
  }

  public sendToBack(id?: string): void {
    const targetId = id || this.selectedId;
    if (!targetId) return;

    const activePage = this.ensurePage();
    const index = activePage.elements.findIndex((el) => el.id === targetId);
    if (index <= 0) return;

    const elements = [...activePage.elements];
    const [target] = elements.splice(index, 1);
    if (target) {
      elements.unshift(target);
      this.reorderElements(elements);
    }
  }

  private reorderElements(newElements: DesignElement[]): void {
    const previousElements = [...this.ensurePage().elements];

    const command: Command = {
      name: "Reorder layers",
      execute: () => {
        this.setPageElements(newElements);
        this.notify();
      },
      undo: () => {
        this.setPageElements(previousElements);
        this.notify();
      },
      redo: () => {
        this.setPageElements(newElements);
        this.notify();
      },
    };

    this.history.execute(command);
  }

  // ==========================================
  // Document-Level Properties
  // ==========================================

  /**
   * Background of every page: sets the design-wide color and clears per-page colors
   * (one undo step).
   */
  public setCanvasBackgroundColor(color: string): void {
    const previousColor = this.document.backgroundColor;
    const previousPages = this.document.pages || [];
    const hadPageColors = previousPages.some((p) => p.backgroundColor);
    const clearedPages = previousPages.map((p) => {
      if (!p.backgroundColor) return p;
      const { backgroundColor: _drop, ...rest } = p;
      void _drop;
      return rest;
    });
    const apply = (bg: string, pages: Page[]) => {
      this.document = { ...this.document, backgroundColor: bg, pages };
      this.markDirty();
      this.emitChange({ type: "background_color", color: bg });
      if (hadPageColors) this.emitChange({ type: "pages_sync", pages });
    };
    this.history.execute({
      name: "Change background color (all pages)",
      execute: () => apply(color, clearedPages),
      undo: () => apply(previousColor, previousPages),
      redo: () => apply(color, clearedPages),
    });
  }

  /** Background of one page (the active page by default) */
  public setPageBackgroundColor(color: string, pageIndex: number = this.activePageIndex): void {
    const previousPages = this.document.pages || [];
    const page = previousPages[pageIndex];
    if (!page || page.backgroundColor === color) return;
    const nextPages = previousPages.map((p, i) => (i === pageIndex ? { ...p, backgroundColor: color } : p));
    const apply = (pages: Page[]) => {
      this.document = { ...this.document, pages };
      this.markDirty();
      this.emitChange({ type: "pages_sync", pages });
    };
    this.history.execute({
      name: "Change page background",
      execute: () => apply(nextPages),
      undo: () => apply(previousPages),
      redo: () => apply(nextPages),
    });
  }

  /** Effective background color of a page */
  public getPageBackgroundColor(pageIndex: number = this.activePageIndex): string {
    return getPageBackground(this.document, pageIndex);
  }

  public setCanvasDimensions(width: number, height: number): void {
    const validWidth = Math.max(100, Math.round(width));
    const validHeight = Math.max(100, Math.round(height));
    const previous = { width: this.document.width, height: this.document.height };

    const command: Command = {
      name: "Change canvas dimensions",
      execute: () => {
        this.document = { ...this.document, width: validWidth, height: validHeight };
        this.markDirty();
        this.emitChange({ type: "dimensions", width: validWidth, height: validHeight });
      },
      undo: () => {
        this.document = { ...this.document, width: previous.width, height: previous.height };
        this.markDirty();
        this.emitChange({ type: "dimensions", width: previous.width, height: previous.height });
      },
      redo: () => {
        this.document = { ...this.document, width: validWidth, height: validHeight };
        this.markDirty();
        this.emitChange({ type: "dimensions", width: validWidth, height: validHeight });
      },
    };
    this.history.execute(command);
  }

  // ==========================================
  // Collaborative Remote Sync Receivers
  // ==========================================

  public applyRemoteDimensions(width: number, height: number): void {
    this.isApplyingRemoteChange = true;
    try {
      this.document = {
        ...this.document,
        width: Math.max(100, Math.round(width)),
        height: Math.max(100, Math.round(height)),
      };
      this.markDirty();
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }

  public applyRemoteElementUpdate(
    id: string,
    updates: Partial<DesignElement>,
    pageIndex?: number,
    pageId?: string
  ): void {
    this.isApplyingRemoteChange = true;
    try {
      const pages = this.document.pages ? [...this.document.pages] : [];
      let targetIdx = -1;

      if (pageId) {
        targetIdx = pages.findIndex((p) => p.id === pageId);
      }
      if (
        targetIdx === -1 &&
        typeof pageIndex === "number" &&
        pageIndex >= 0 &&
        pageIndex < pages.length
      ) {
        targetIdx = pageIndex;
      }
      if (targetIdx === -1 || !pages[targetIdx]?.elements.some((el) => el.id === id)) {
        targetIdx = pages.findIndex((p) => p.elements.some((el) => el.id === id));
      }

      if (targetIdx === -1 || !pages[targetIdx]) return;

      const page = pages[targetIdx]!;
      const updatedElements = page.elements.map((el) => {
        if (el.id !== id) return el;
        return {
          ...el,
          ...updates,
          properties: updates.properties
            ? { ...el.properties, ...updates.properties }
            : el.properties,
        };
      });

      pages[targetIdx] = {
        ...page,
        elements: updatedElements,
      };

      this.document = { ...this.document, pages };
      this.notify();
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }

  public applyRemoteElementAdd(
    element: DesignElement,
    pageIndex?: number,
    pageId?: string
  ): void {
    this.isApplyingRemoteChange = true;
    try {
      const pages = this.document.pages ? [...this.document.pages] : [];
      if (pages.length === 0) {
        pages.push({ id: "page-1", name: "Page 1", elements: [] });
      }

      // Check if element is already present in any page to avoid duplicate addition
      if (pages.some((p) => p.elements.some((el) => el.id === element.id))) {
        return;
      }

      let targetIdx = -1;
      if (pageId) {
        targetIdx = pages.findIndex((p) => p.id === pageId);
      }
      if (
        targetIdx === -1 &&
        typeof pageIndex === "number" &&
        pageIndex >= 0 &&
        pageIndex < pages.length
      ) {
        targetIdx = pageIndex;
      }
      if (targetIdx === -1) {
        targetIdx = Math.max(0, Math.min(pages.length - 1, this.activePageIndex));
      }

      const page = pages[targetIdx] || pages[0]!;
      pages[targetIdx] = {
        ...page,
        elements: [...page.elements, element],
      };

      this.document = { ...this.document, pages };
      this.notify();
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }

  public applyRemoteElementDelete(
    id: string,
    pageIndex?: number,
    pageId?: string
  ): void {
    this.isApplyingRemoteChange = true;
    try {
      const pages = this.document.pages ? [...this.document.pages] : [];
      let found = false;

      const newPages = pages.map((page, idx) => {
        if (pageId && page.id !== pageId) return page;
        if (!pageId && pageIndex !== undefined && idx !== pageIndex) return page;

        if (page.elements.some((el) => el.id === id)) {
          found = true;
          return {
            ...page,
            elements: page.elements.filter((el) => el.id !== id),
          };
        }
        return page;
      });

      if (!found) {
        const fallbackPages = pages.map((page) => {
          if (page.elements.some((el) => el.id === id)) {
            found = true;
            return {
              ...page,
              elements: page.elements.filter((el) => el.id !== id),
            };
          }
          return page;
        });
        if (found) {
          this.document = { ...this.document, pages: fallbackPages };
          if (this.selectedId === id) this.selectedId = null;
          this.notify();
        }
      } else {
        this.document = { ...this.document, pages: newPages };
        if (this.selectedId === id) this.selectedId = null;
        this.notify();
      }
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }

  public applyRemoteBackgroundColor(color: string): void {
    this.isApplyingRemoteChange = true;
    try {
      this.document = { ...this.document, backgroundColor: color };
      this.markDirty();
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }

  public applyRemotePagesSync(pages: Page[]): void {
    this.isApplyingRemoteChange = true;
    try {
      this.document = { ...this.document, pages };
      if (this.activePageIndex >= pages.length) {
        this.activePageIndex = Math.max(0, pages.length - 1);
      }
      this.notify();
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }

  public applyRemotePageAdd(page: Page): void {
    this.isApplyingRemoteChange = true;
    try {
      const existing = this.document.pages || [];
      if (!existing.some((p) => p.id === page.id)) {
        this.document = { ...this.document, pages: [...existing, page] };
        this.notify();
      }
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }

  public applyRemotePageDelete(pageIndex: number): void {
    this.isApplyingRemoteChange = true;
    try {
      const existing = this.document.pages || [];
      if (existing.length > 1 && pageIndex >= 0 && pageIndex < existing.length) {
        const next = existing.filter((_, i) => i !== pageIndex);
        this.document = { ...this.document, pages: next };
        if (this.activePageIndex >= next.length) {
          this.activePageIndex = Math.max(0, next.length - 1);
        }
        this.notify();
      }
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }

  public renameDocument(newName: string): void {
    if (this.document.name !== newName) {
      this.document = { ...this.document, name: newName };
      this.markDirty();
    }
  }


  // ==========================================
  // Asset to Element Factory
  // ==========================================

  public createFromAsset(asset: Asset, position: { x: number; y: number }): DesignElement {
    const id = `elem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const width = asset.defaultWidth || 120;
    const height = asset.defaultHeight || 120;

    if (asset.type === "shape" && asset.id.includes("circle")) {
      return {
        id,
        type: "shape",
        name: asset.name,
        x: position.x,
        y: position.y,
        width,
        height,
        rotation: 0,
        opacity: 1,
        properties: {
          shapeType: "circle",
          fill: "#10b981",
          stroke: "transparent",
          strokeWidth: 0,
        },
      };
    }

    if (asset.type === "shape" && asset.id.includes("rect")) {
      return {
        id,
        type: "shape",
        name: asset.name,
        x: position.x,
        y: position.y,
        width,
        height,
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

    if (
      asset.type === "image" ||
      (asset.contentType && !asset.contentType.includes("svg") && !asset.source.startsWith("<svg"))
    ) {
      const src = asset.url || asset.source;
      return {
        id,
        type: "image",
        name: asset.name,
        x: position.x,
        y: position.y,
        width,
        height,
        rotation: 0,
        opacity: 1,
        properties: {
          src,
          originalSrc: src,
        },
      };
    }

    // Default SVG
    return {
      id,
      type: "svg",
      name: asset.name,
      x: position.x,
      y: position.y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      properties: {
        assetId: asset.id,
        assetName: asset.name,
        category: asset.category,
        subcategorySlug: asset.subcategorySlug,
        originalSvg: asset.source || asset.url || "",
        svgContent: asset.source || asset.url || "",
      },
    };
  }

  /**
   * Find an element across all pages or current page by ID
   */
  public getElementById(id: string): DesignElement | null {
    const pages = this.document.pages || [];
    // Prioritize active page first
    const activeFound = pages[this.activePageIndex]?.elements.find((el) => el.id === id);
    if (activeFound) return activeFound;

    for (let i = 0; i < pages.length; i++) {
      if (i === this.activePageIndex) continue;
      const found = pages[i]?.elements.find((el) => el.id === id);
      if (found) return found;
    }
    return null;
  }

  /**
   * Resolves raw SVG XML text for an element that was created from a remote URL.
   */
  public resolveAssetSvgMarkup(elementId: string, svgMarkup: string): void {
    const el = this.getElementById(elementId);
    if (!el || el.type !== "svg") return;

    const props = el.properties as Record<string, unknown>;
    const currentSvg = (props.svgContent as string) || "";
    // Only replace if current is not raw XML and markup is valid SVG XML
    if (!currentSvg.includes("<svg") && svgMarkup.includes("<svg")) {
      this.updateElement(elementId, {
        properties: {
          ...props,
          originalSvg: svgMarkup,
          svgContent: svgMarkup,
        },
      });
    }
  }

  /**
   * Modify vector colors (fill, stroke/line color, stroke width) for the selected SVG element
   */
  public updateSelectedSvgColor(fill?: string, stroke?: string, strokeWidth?: number): void {
    // A selected layer inside an illustration is recolored on its own
    if (this.layerNav?.selectedPath) {
      const colors: { fill?: string; stroke?: string; strokeWidth?: number } = {};
      if (fill !== undefined) colors.fill = fill;
      if (stroke !== undefined) colors.stroke = stroke;
      if (strokeWidth !== undefined) colors.strokeWidth = strokeWidth;
      this.recolorSelectedLayer(colors);
      return;
    }
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "svg") return;

    const props = selected.properties as {
      originalSvg?: string;
      svgContent?: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      colorMap?: Record<string, string>;
    };
    // Edits apply to the artwork as it is now; the original is only kept for "Reset colors"
    const baseSvg = props.svgContent || props.originalSvg || "";
    const modified = modifySvgColors(baseSvg, { fill, stroke, strokeWidth });
    if (modified === baseSvg) return;

    this.updateElement(selected.id, {
      properties: {
        ...selected.properties,
        svgContent: modified,
        // Remembered so the panel can show the last whole-illustration colors
        fill: fill !== undefined ? fill : props.fill,
        stroke: stroke !== undefined ? stroke : props.stroke,
        strokeWidth: strokeWidth !== undefined ? strokeWidth : props.strokeWidth,
        colorMap: undefined,
      },
    });
  }

  /**
   * Replaces colors of the selected illustration as it looks now ({ current color: new color }).
   * Works on every notation and on colors from CSS classes, inline styles and gradients.
   */
  public updateSelectedSvgColorMap(colorMap: Record<string, string>): void {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "svg") return;

    const props = selected.properties as { originalSvg?: string; svgContent?: string };
    const baseSvg = props.svgContent || props.originalSvg || "";
    const modified = replaceSvgColors(baseSvg, colorMap);
    if (modified === baseSvg) return;

    this.updateElement(selected.id, {
      properties: {
        ...selected.properties,
        svgContent: modified,
        colorMap: undefined,
      },
    });
  }

  /**
   * Resets the selected SVG element to its original author colors
   */
  public resetSelectedSvgColors(): void {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "svg") return;

    const props = selected.properties as {
      originalSvg?: string;
    };
    const original = props.originalSvg || "";

    this.updateElement(selected.id, {
      properties: {
        ...selected.properties,
        svgContent: original,
        fill: undefined,
        stroke: undefined,
        strokeWidth: undefined,
        colorMap: undefined,
      },
    });
  }

  // ==========================================
  // Layer navigation & editing (Figma / Illustrator style)
  // ------------------------------------------
  // Navigating into groups is pure selection state: the document is never rebuilt,
  // so nothing re-renders. Only real edits (move, resize, rotate, recolor, delete...)
  // rewrite the affected layer inside the SVG markup, as one undoable step.
  // ==========================================

  private markupOf(el: DesignElement | null | undefined): string {
    if (!el || el.type !== "svg") return "";
    const props = el.properties as { svgContent?: string; originalSvg?: string };
    const markup = props.svgContent || props.originalSvg || "";
    return markup.includes("<svg") ? markup : "";
  }

  private viewBoxOf(el: DesignElement, markup: string): [number, number, number, number] {
    const parts = extractSvgViewBox(markup)
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));
    return [
      parts[0] || 0,
      parts[1] || 0,
      parts[2] && parts[2] > 0 ? parts[2] : el.width || 1,
      parts[3] && parts[3] > 0 ? parts[3] : el.height || 1,
    ];
  }

  /** Matrix mapping the SVG's root viewBox space to page (canvas) coordinates */
  private rootToPageMatrix(el: DesignElement, markup: string): SvgMatrix {
    const [vbX, vbY, vbW, vbH] = this.viewBoxOf(el, markup);
    const rad = ((el.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return multiplySvgMatrix(
      multiplySvgMatrix([cos, sin, -sin, cos, el.x, el.y], [el.width / vbW, 0, 0, el.height / vbH, 0, 0]),
      [1, 0, 0, 1, -vbX, -vbY]
    );
  }

  private toLayerGeometry(el: DesignElement, markup: string, layer: SvgLayerInfo): SvgLayerGeometry {
    const [vbX, vbY, vbW, vbH] = this.viewBoxOf(el, markup);
    const sx = el.width / vbW;
    const sy = el.height / vbH;
    const b = layer.bbox || { x: vbX, y: vbY, width: vbW, height: vbH };
    return {
      path: layer.path,
      name: layer.name,
      isGroup: layer.isGroup,
      markup: layer.markup,
      box: { x: (b.x - vbX) * sx, y: (b.y - vbY) * sy, width: b.width * sx, height: b.height * sy },
    };
  }

  /** Layers directly inside `containerPath` of an SVG element, in element-local pixels */
  public getLayerGeoms(elementId: string, containerPath: number[] = []): SvgLayerGeometry[] {
    const el = this.getElementById(elementId);
    const markup = this.markupOf(el);
    if (!el || !markup) return [];
    if (typeof getSvgLayerChildren !== "function") return [];
    const layers = getSvgLayerChildren(markup, containerPath) || [];
    return layers.map((layer) => this.toLayerGeometry(el, markup, layer));
  }

  /** A single layer (by full path) of an SVG element, in element-local pixels */
  public getLayerGeom(elementId: string, path: number[]): SvgLayerGeometry | null {
    if (path.length === 0) return null;
    return this.getLayerGeoms(elementId, path.slice(0, -1))[path[path.length - 1]!] || null;
  }

  public getLayerNav(): LayerNavState | null {
    return this.layerNav
      ? {
          elementId: this.layerNav.elementId,
          containerPath: [...this.layerNav.containerPath],
          selectedPath: this.layerNav.selectedPath ? [...this.layerNav.selectedPath] : null,
        }
      : null;
  }

  /**
   * Sets which group of an SVG element is open (`containerPath`, [] = the illustration itself)
   * and which layer inside it is selected. Pure selection: no document change, no history.
   */
  public setLayerNav(elementId: string, containerPath: number[], selectedPath: number[] | null): void {
    const el = this.getElementById(elementId);
    if (!el || !this.markupOf(el)) return;
    const prev = this.layerNav;
    const same =
      prev &&
      prev.elementId === elementId &&
      prev.containerPath.join("/") === containerPath.join("/") &&
      (prev.selectedPath || []).join("/") === (selectedPath || []).join("/") &&
      Boolean(prev.selectedPath) === Boolean(selectedPath) &&
      this.selectedId === elementId;
    if (same) return;
    this.layerNav = { elementId, containerPath: [...containerPath], selectedPath: selectedPath ? [...selectedPath] : null };
    this.selectedId = elementId;
    this.notify();
  }

  /** Keeps navigation valid after undo/redo, remote edits or deletions */
  private validateLayerNav(): void {
    const nav = this.layerNav;
    if (!nav) return;
    const el = this.getActivePage().elements.find((e) => e.id === nav.elementId);
    const markup = this.markupOf(el);
    if (!el || !markup) {
      this.layerNav = null;
      return;
    }
    let container = nav.containerPath;
    while (container.length > 0 && typeof getSvgLayerChildren === "function" && !getSvgLayerChildren(markup, container)) {
      container = container.slice(0, -1);
    }
    let selected = nav.selectedPath;
    if (selected && !getSvgLayer(markup, selected)) selected = null;
    if (selected && selected.slice(0, -1).join("/") !== container.join("/")) selected = null;
    this.layerNav = { elementId: nav.elementId, containerPath: container, selectedPath: selected };
  }

  /** Everything the canvas needs to show the open group and the selected layer (memoized) */
  public getLayerEditContext(): LayerEditContext | null {
    const nav = this.layerNav;
    if (!nav) return null;
    const el = this.getElementById(nav.elementId);
    const markup = this.markupOf(el);
    if (!el || !markup) return null;

    const key = `${nav.containerPath.join("/")}|${nav.selectedPath ? nav.selectedPath.join("/") : "-"}`;
    if (this.layerCtxCache && this.layerCtxCache.element === el && this.layerCtxCache.key === key) {
      return this.layerCtxCache.ctx;
    }

    const selected = nav.selectedPath ? this.getLayerGeom(el.id, nav.selectedPath) : null;
    const ctx: LayerEditContext = {
      elementId: el.id,
      containerBox: nav.containerPath.length > 0 ? this.getLayerGeom(el.id, nav.containerPath) : null,
      children: this.getLayerGeoms(el.id, nav.containerPath),
      clickTargets: this.getLayerGeoms(el.id, []),
      selected,
      selectedChildren: selected && selected.isGroup ? this.getLayerGeoms(el.id, selected.path) : [],
      hiddenMarkup: selected ? hideSvgLayer(markup, selected.path) : null,
    };
    this.layerCtxCache = { element: el, key, ctx };
    return ctx;
  }

  /** Session snapshot for the UI (banner, breadcrumb, toolbar buttons) */
  private currentGroupEditSnapshot(): GroupEditSession | null {
    const nav = this.layerNav;
    if (!nav) return null;
    const el = this.getElementById(nav.elementId);
    if (!el) return null;
    const groupName = el.name || "Illustration";
    const breadcrumb = [groupName];
    for (let i = 1; i <= nav.containerPath.length; i++) {
      breadcrumb.push(this.getLayerGeom(el.id, nav.containerPath.slice(0, i))?.name || "Group");
    }
    const selected = nav.selectedPath ? this.getLayerGeom(el.id, nav.selectedPath) : null;
    return {
      groupId: el.id,
      groupName,
      elementId: el.id,
      containerPath: [...nav.containerPath],
      selectedLayerPath: selected ? [...selected.path] : null,
      selectedLayerName: selected ? selected.name : null,
      selectedLayerIsGroup: Boolean(selected?.isGroup),
      depth: nav.containerPath.length,
      breadcrumb,
      memberElementIds: [el.id],
    };
  }

  public getGroupEditSession(): GroupEditSession | null {
    return this.currentGroupEditSnapshot();
  }

  /** True when the element (or its selected layer) can be opened to edit inner layers */
  public canEnterGroup(elementId: string): boolean {
    const el = this.getElementById(elementId);
    if (!el || el.type !== "svg") return false;
    const nav = this.layerNav;
    if (nav && nav.elementId === elementId) {
      return nav.selectedPath ? Boolean(this.getLayerGeom(elementId, nav.selectedPath)?.isGroup) : true;
    }
    const props = el.properties as { svgContent?: string; originalSvg?: string };
    const markup = props.svgContent || props.originalSvg || "";
    if (!markup.includes("<svg")) return true; // remote SVG: resolved on demand
    return svgHasEditableLayers(markup);
  }

  /** Picks the layer whose box contains a page point; the smallest wins */
  private pickLayerAtPoint(
    el: DesignElement,
    geoms: SvgLayerGeometry[],
    point?: { x: number; y: number }
  ): number | null {
    if (!point) return null;
    const rad = ((el.rotation || 0) * Math.PI) / 180;
    const dx = point.x - el.x;
    const dy = point.y - el.y;
    const lx = Math.cos(rad) * dx + Math.sin(rad) * dy;
    const ly = -Math.sin(rad) * dx + Math.cos(rad) * dy;
    let best: number | null = null;
    geoms.forEach((g, i) => {
      const b = g.box;
      if (lx >= b.x && ly >= b.y && lx <= b.x + b.width && ly <= b.y + b.height) {
        if (best === null || b.width * b.height < geoms[best]!.box.width * geoms[best]!.box.height) best = i;
      }
    });
    return best;
  }

  /**
   * Opens a group (double-click / Enter). For an illustration that is not open yet, its top
   * level is opened; when its selected layer is a group, that group is opened. `point`
   * (page coordinates) selects the layer under the cursor. Never modifies the document.
   */
  public async enterGroupEdit(elementId?: string, point?: { x: number; y: number }): Promise<boolean> {
    const targetId = elementId || this.selectedId;
    if (!targetId) return false;
    let target = this.getActivePage().elements.find((el) => el.id === targetId) || null;
    if (!target || target.type !== "svg") return false;

    if (!this.markupOf(target)) {
      await this.resolveElementSvgMarkup(target);
      target = this.getActivePage().elements.find((el) => el.id === targetId) || null;
      if (!target || !this.markupOf(target)) return false;
    }

    const nav = this.layerNav;
    let container: number[] = [];
    if (nav && nav.elementId === targetId) {
      const sel = nav.selectedPath;
      if (!sel || !this.getLayerGeom(targetId, sel)?.isGroup) return false;
      container = sel;
    }

    const geoms = this.getLayerGeoms(targetId, container);
    if (container.length === 0 && geoms.length < 2) {
      // A single shape: nothing to open
      this.selectedId = targetId;
      this.notify();
      return false;
    }
    const picked = this.pickLayerAtPoint(target, geoms, point);
    this.setLayerNav(targetId, container, picked !== null ? [...container, picked] : point ? null : [...container, 0]);
    return true;
  }

  /** Goes up one level (Esc): the open group becomes the selection */
  public exitGroupEdit(): DesignElement | null {
    const nav = this.layerNav;
    if (!nav) return null;
    const el = this.getElementById(nav.elementId);
    if (nav.containerPath.length === 0) {
      this.layerNav = null;
      this.selectedId = el ? el.id : null;
    } else {
      this.layerNav = {
        elementId: nav.elementId,
        containerPath: nav.containerPath.slice(0, -1),
        selectedPath: nav.containerPath,
      };
      this.selectedId = nav.elementId;
    }
    this.notify();
    return el;
  }

  /** Leaves every open group; the illustration stays selected */
  public exitAllGroupEdits(): DesignElement | null {
    const nav = this.layerNav;
    if (!nav) return null;
    this.layerNav = null;
    this.selectedId = nav.elementId;
    this.notify();
    return this.getElementById(nav.elementId);
  }

  /** Selection from a canvas click: selecting anything else leaves the open group */
  public selectFromCanvas(id: string | null): void {
    // A click can land on a node whose element was just replaced; ignore it
    if (id && !this.getElementById(id)) return;
    if (this.layerNav && (!id || id !== this.layerNav.elementId)) {
      this.layerNav = null;
      this.selectedId = id;
      this.notify();
      return;
    }
    if (this.layerNav) return; // clicks inside the open illustration are resolved by the canvas
    this.selectElement(id);
  }

  // ---------- Layer edits ----------

  /**
   * Applies a markup edit to the element (both the current and the original markup, so
   * whole-illustration recoloring keeps the edit) and grows the viewBox when content
   * now extends beyond it, so nothing gets clipped. One undoable step.
   */
  private applyLayerMarkupEdit(
    el: DesignElement,
    edit: (markup: string) => string | null,
    nav?: LayerNavState | null,
    /** Color-only edits leave the original artwork alone, so "Reset colors" can undo them */
    contentOnly = false
  ): boolean {
    const props = el.properties as Record<string, unknown> & { svgContent?: string; originalSvg?: string };
    const content = this.markupOf(el);
    if (!content) return false;
    let nextContent = edit(content);
    if (!nextContent || nextContent === content) return false;

    const original = props.originalSvg;
    let nextOriginal = original;
    if (original && original.includes("<svg") && !contentOnly) {
      nextOriginal = original === content ? nextContent : edit(original) || original;
    }

    let geometry: Partial<DesignElement> = {};
    const [vbX, vbY, vbW, vbH] = this.viewBoxOf(el, content);
    const bounds = getSvgContentBounds(nextContent);
    if (bounds) {
      const nx = Math.min(vbX, bounds.x);
      const ny = Math.min(vbY, bounds.y);
      const nw = Math.max(vbX + vbW, bounds.x + bounds.width) - nx;
      const nh = Math.max(vbY + vbH, bounds.y + bounds.height) - ny;
      if (nx < vbX - 0.01 || ny < vbY - 0.01 || nw > vbW + 0.01 || nh > vbH + 0.01) {
        const vb = { x: nx, y: ny, width: nw, height: nh };
        nextContent = setSvgRootViewBox(nextContent, vb);
        if (nextOriginal && nextOriginal.includes("<svg")) nextOriginal = setSvgRootViewBox(nextOriginal, vb);
        const sx = el.width / vbW;
        const sy = el.height / vbH;
        const rad = ((el.rotation || 0) * Math.PI) / 180;
        const dx = (nx - vbX) * sx;
        const dy = (ny - vbY) * sy;
        const r2 = (n: number) => Math.round(n * 100) / 100;
        geometry = {
          x: r2(el.x + Math.cos(rad) * dx - Math.sin(rad) * dy),
          y: r2(el.y + Math.sin(rad) * dx + Math.cos(rad) * dy),
          width: r2(nw * sx),
          height: r2(nh * sy),
        };
      }
    }

    this.updateElement(el.id, {
      ...geometry,
      properties: { ...props, svgContent: nextContent, originalSvg: nextOriginal ?? nextContent },
    });
    if (nav !== undefined) {
      this.layerNav = nav;
      this.validateLayerNav();
      this.notify();
    } else {
      this.validateLayerNav();
    }
    return true;
  }

  private selectedLayerTarget(): { el: DesignElement; nav: LayerNavState; path: number[] } | null {
    const nav = this.layerNav;
    if (!nav || !nav.selectedPath) return null;
    const el = this.getElementById(nav.elementId);
    if (!el || !this.markupOf(el)) return null;
    return { el, nav, path: nav.selectedPath };
  }

  /**
   * Moves / resizes / rotates a layer. `deltaPage` is the affine change applied on the
   * canvas (page coordinates), e.g. from dragging the layer's selection box.
   */
  public transformLayer(elementId: string, path: number[], deltaPage: SvgMatrix): boolean {
    const el = this.getElementById(elementId);
    const markup = this.markupOf(el);
    if (!el || !markup || path.length === 0) return false;
    const ev = this.rootToPageMatrix(el, markup);
    const deltaRoot = multiplySvgMatrix(multiplySvgMatrix(invertSvgMatrix(ev), deltaPage), ev);
    return this.applyLayerMarkupEdit(el, (m) => transformSvgLayer(m, path, deltaRoot));
  }

  public transformSelectedLayer(deltaPage: SvgMatrix): boolean {
    const target = this.selectedLayerTarget();
    if (!target) return false;
    return this.transformLayer(target.el.id, target.path, deltaPage);
  }

  public deleteSelectedLayer(): boolean {
    const target = this.selectedLayerTarget();
    if (!target) return false;
    return this.applyLayerMarkupEdit(target.el, (m) => removeSvgLayer(m, target.path), {
      ...target.nav,
      selectedPath: null,
    });
  }

  public duplicateSelectedLayer(): boolean {
    const target = this.selectedLayerTarget();
    if (!target) return false;
    const markup = this.markupOf(target.el);
    const ev = this.rootToPageMatrix(target.el, markup);
    const offset: SvgMatrix = [1, 0, 0, 1, 16, 16];
    const deltaRoot = multiplySvgMatrix(multiplySvgMatrix(invertSvgMatrix(ev), offset), ev);
    const copyPath = [...target.path.slice(0, -1), target.path[target.path.length - 1]! + 1];
    return this.applyLayerMarkupEdit(target.el, (m) => duplicateSvgLayer(m, target.path, deltaRoot), {
      ...target.nav,
      selectedPath: copyPath,
    });
  }

  /** Dissolves the selected nested group into its parent (children stay where they are) */
  public ungroupSelectedLayer(): boolean {
    const target = this.selectedLayerTarget();
    if (!target || !this.getLayerGeom(target.el.id, target.path)?.isGroup) return false;
    return this.applyLayerMarkupEdit(target.el, (m) => ungroupSvgLayer(m, target.path)?.markup ?? null, {
      ...target.nav,
      selectedPath: target.path,
    });
  }

  /** Mirrors the selected part of an illustration around its own center */
  public flipSelectedLayer(axis: FlipAxis): boolean {
    const target = this.selectedLayerTarget();
    if (!target) return false;
    const geom = this.getLayerGeom(target.el.id, target.path);
    if (!geom) return false;
    const { el } = target;
    const cx = geom.box.x + geom.box.width / 2;
    const cy = geom.box.y + geom.box.height / 2;
    const mirror: SvgMatrix =
      axis === "horizontal" ? [-1, 0, 0, 1, 2 * cx, 0] : [1, 0, 0, -1, 0, 2 * cy];
    // Element-local pixels -> page (the element's rotation and position)
    const rad = ((el.rotation || 0) * Math.PI) / 180;
    const local: SvgMatrix = [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), el.x, el.y];
    const deltaPage = multiplySvgMatrix(multiplySvgMatrix(local, mirror), invertSvgMatrix(local));
    return this.transformLayer(el.id, target.path, deltaPage);
  }

  public recolorSelectedLayer(colors: { fill?: string; stroke?: string; strokeWidth?: number }): boolean {
    const target = this.selectedLayerTarget();
    if (!target) return false;
    return this.applyLayerMarkupEdit(target.el, (m) => recolorSvgLayer(m, target.path, colors), undefined, true);
  }

  private replacePageElements(pageIndex: number, elements: DesignElement[]): void {
    const pages = this.document.pages ? [...this.document.pages] : [];
    const page = pages[pageIndex];
    if (!page) return;
    pages[pageIndex] = { ...page, elements };
    this.document = { ...this.document, pages };
  }

  private emitPagesSync(): void {
    this.emitChange({ type: "pages_sync", pages: this.document.pages || [] });
  }

  /** Returns raw SVG markup for an element, fetching it first when the element only holds a URL */
  private async resolveElementSvgMarkup(el: DesignElement): Promise<string> {
    const props = el.properties as { originalSvg?: string; svgContent?: string };
    let markup = props.svgContent || props.originalSvg || "";
    if (
      !markup.includes("<svg") &&
      (markup.startsWith("http://") || markup.startsWith("https://") || markup.startsWith("/"))
    ) {
      try {
        const fetched = await fetchSvgMarkup(markup);
        if (fetched && fetched.includes("<svg")) {
          markup = fetched;
          this.resolveAssetSvgMarkup(el.id, markup);
        }
      } catch (err) {
        console.warn("[EditorStore] Failed to fetch SVG markup:", err);
      }
    }
    return markup;
  }

  /**
   * Splits an SVG element into one canvas element per editable layer, placed exactly
   * where the layer renders inside the parent (honoring viewBox scale and rotation).
   */
  private buildSvgParts(
    target: DesignElement,
    markup: string,
    groupTag: string,
    groupName: string,
    namePrefix?: string
  ): DesignElement[] | null {
    if (!markup.includes("<svg")) return null;
    const decomposed = decomposeSvgComponents(markup, namePrefix);
    if (decomposed.length <= 1) return null;

    const vbParts = extractSvgViewBox(markup)
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !isNaN(n));
    const vbX = vbParts[0] || 0;
    const vbY = vbParts[1] || 0;
    const vbW = vbParts[2] && vbParts[2] > 0 ? vbParts[2] : target.width;
    const vbH = vbParts[3] && vbParts[3] > 0 ? vbParts[3] : target.height;
    const scaleX = target.width / vbW;
    const scaleY = target.height / vbH;

    const rotation = target.rotation || 0;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const stamp = Date.now();

    return decomposed.map((comp, idx) => {
      let lx = 0;
      let ly = 0;
      let w = target.width;
      let h = target.height;
      if (comp.bbox && comp.bbox.width > 0 && comp.bbox.height > 0) {
        lx = (comp.bbox.x - vbX) * scaleX;
        ly = (comp.bbox.y - vbY) * scaleY;
        w = comp.bbox.width * scaleX;
        h = comp.bbox.height * scaleY;
      }
      // Konva rotates around the element origin, so rotate the local offset the same way
      const x = target.x + cos * lx - sin * ly;
      const y = target.y + sin * lx + cos * ly;

      return {
        id: `elem-${stamp}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        type: "svg",
        name: comp.name,
        x: r2(x),
        y: r2(y),
        width: Math.max(0.5, r2(w)),
        height: Math.max(0.5, r2(h)),
        rotation,
        opacity: target.opacity ?? 1,
        properties: {
          svgContent: comp.svgContent,
          originalSvg: comp.svgContent,
          fill: comp.fill,
          stroke: comp.stroke,
          strokeWidth: comp.strokeWidth,
          groupId: groupTag,
          groupName,
          bbox: comp.bbox,
          isGroup: comp.isGroup || undefined,
        },
      } as DesignElement;
    });
  }

  /**
   * Groups selected canvas elements into a single composite SVG illustration (Figma/BioRender Group)
   */
  public groupElements(elementIds: string[]): DesignElement | null {
    if (!elementIds || elementIds.length <= 1) return null;
    const activePage = this.getActivePage();
    if (!activePage) return null;

    const targets = activePage.elements.filter((el) => elementIds.includes(el.id));
    if (targets.length <= 1) return null;

    const regroupedData = combineElementsIntoSvgGroup(
      targets as {
        name?: string;
        x: number;
        y: number;
        width: number;
        height: number;
        properties: Record<string, unknown>;
      }[]
    );
    if (!regroupedData) return null;

    const groupElement: DesignElement = {
      id: `elem-group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: "svg",
      name: `Group (${targets.length} objects)`,
      x: regroupedData.x,
      y: regroupedData.y,
      width: regroupedData.width,
      height: regroupedData.height,
      rotation: 0,
      opacity: 1,
      properties: {
        originalSvg: regroupedData.svgMarkup,
        svgContent: regroupedData.svgMarkup,
      },
    };

    const pageIndex = this.activePageIndex;
    const originalElements = [...activePage.elements];
    const targetSet = new Set(targets.map((t) => t.id));

    const applyGroup = () => {
      const pgs = this.document.pages ? [...this.document.pages] : [];
      const pg = pgs[pageIndex];
      if (!pg) return;
      const newElements: DesignElement[] = [];
      let added = false;
      for (const el of pg.elements) {
        if (targetSet.has(el.id)) {
          if (!added) {
            newElements.push(groupElement);
            added = true;
          }
        } else {
          newElements.push(el);
        }
      }
      pgs[pageIndex] = { ...pg, elements: newElements };
      this.document = { ...this.document, pages: pgs };
      this.selectedId = groupElement.id;
      this.markDirty();
      this.notify();
    };

    const applyUndo = () => {
      const pgs = this.document.pages ? [...this.document.pages] : [];
      const pg = pgs[pageIndex];
      if (!pg) return;
      pgs[pageIndex] = { ...pg, elements: originalElements };
      this.document = { ...this.document, pages: pgs };
      this.selectedId = targets[0]?.id || null;
      this.markDirty();
      this.notify();
    };

    const command: Command = {
      name: `Group ${targets.length} elements`,
      execute: applyGroup,
      undo: applyUndo,
      redo: applyGroup,
    };

    this.history.execute(command);
    return groupElement;
  }

  /**
   * Ungroup (Cmd/Ctrl+Shift+G). With a nested group selected inside an illustration, that
   * group is dissolved into its parent. Otherwise the illustration is permanently split into
   * independent canvas elements, one per top-level layer.
   */
  public async ungroupSelectedElement(): Promise<DesignElement[] | null> {
    if (this.layerNav?.selectedPath) {
      this.ungroupSelectedLayer();
      return null;
    }
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "svg") return null;
    const markup = await this.resolveElementSvgMarkup(selected);
    const fresh = this.getElementById(selected.id);
    if (!fresh) return null;
    return this.ungroupElementWithMarkup(fresh, markup);
  }

  private ungroupElementWithMarkup(target: DesignElement, markup: string): DesignElement[] | null {
    const groupName = target.name || "Illustration";
    const parts = this.buildSvgParts(target, markup, target.id, groupName, groupName);
    if (!parts) return null;
    if (this.layerNav?.elementId === target.id) this.layerNav = null;

    const pageIndex = this.activePageIndex;
    const before = this.getActivePage().elements;
    const after = before.flatMap((el) => (el.id === target.id ? parts : [el]));
    const selectedBefore = this.selectedId;

    const command: Command = {
      name: `Ungroup SVG (${parts.length} components)`,
      execute: () => {
        this.replacePageElements(pageIndex, after);
        this.selectedId = parts[0]?.id || null;
        this.markDirty();
        this.emitPagesSync();
      },
      undo: () => {
        this.replacePageElements(pageIndex, before);
        this.selectedId = selectedBefore;
        this.markDirty();
        this.emitPagesSync();
      },
      redo: () => command.execute(),
    };

    this.history.execute(command);
    return parts;
  }

  /**
   * Distributes / ungroups the selected SVG into independent canvas elements for its subcomponents.
   * If the SVG content is a remote URL, it fetches the XML asynchronously and distributes.
   */
  public async distributeSelectedSvgComponentsAsync(): Promise<DesignElement[] | null> {
    return this.ungroupSelectedElement();
  }

  /**
   * Distributes / ungroups the selected SVG into independent canvas elements for its subcomponents
   */
  public distributeSelectedSvgComponents(): DesignElement[] | null {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "svg") return null;
    const props = selected.properties as { originalSvg?: string; svgContent?: string };
    const markup = props.svgContent || props.originalSvg || "";

    if (this.layerNav?.selectedPath) {
      this.ungroupSelectedLayer();
      return null;
    }
    if (markup.includes("<svg")) {
      return this.ungroupElementWithMarkup(selected, markup);
    }
    if (markup.startsWith("http://") || markup.startsWith("https://") || markup.startsWith("/")) {
      this.ungroupSelectedElement().catch((err) =>
        console.warn("[distributeSelectedSvgComponents] Async distribute failed:", err)
      );
    }
    return null;
  }

  /**
   * Recolor a specific component inside the selected SVG
   */
  public updateSelectedSvgComponentColor(
    componentIdOrIndex: string | number,
    colors: { fill?: string; stroke?: string }
  ): void {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "svg") return;

    const props = selected.properties as {
      originalSvg?: string;
      svgContent?: string;
    };
    const baseSvg = props.svgContent || props.originalSvg || "";
    const modified = modifySvgComponentColor(baseSvg, componentIdOrIndex, colors);

    this.updateElement(selected.id, {
      properties: {
        ...selected.properties,
        svgContent: modified,
      },
    });
  }

  /**
   * Applies a scientific color preset (e.g. Bio Red, Bio Blue) to selected SVG or its component
   */
  public applyScientificPresetToSelected(
    presetIdOrPreset: string | ScientificColorPreset,
    componentIdOrIndex?: string | number
  ): void {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "svg") return;

    const props = selected.properties as {
      originalSvg?: string;
      svgContent?: string;
    };
    const baseSvg = props.svgContent || props.originalSvg || "";
    const modified = applyScientificPreset(baseSvg, presetIdOrPreset, componentIdOrIndex);

    this.updateElement(selected.id, {
      properties: {
        ...selected.properties,
        svgContent: modified,
      },
    });
  }

  // ==========================================
  // History Controls
  // ==========================================

  public undo(): void {
    this.history.undo();
    this.validateLayerNav();
    this.notify();
  }

  public redo(): void {
    this.history.redo();
    this.validateLayerNav();
    this.notify();
  }

  // ==========================================
  // Persistence Integration
  // ==========================================

  public async save(
    repository: DesignRepository,
    thumbnailDataUrl?: string
  ): Promise<DesignDocument> {
    this.setSaveStatus("saving");

    try {
      const cleanPages = sanitizePages(this.document.pages);
      this.document.pages = cleanPages;

      const safeThumbnail =
        typeof thumbnailDataUrl === "string" && thumbnailDataUrl.length > 0
          ? thumbnailDataUrl
          : typeof this.document.thumbnail === "string"
          ? this.document.thumbnail
          : undefined;

      if (safeThumbnail && cleanPages[this.activePageIndex]) {
        const targetPage = cleanPages[this.activePageIndex]!;
        cleanPages[this.activePageIndex] = {
          ...targetPage,
          thumbnail: safeThumbnail,
        };
      }

      const updates: Partial<DesignDocument> = {
        name: typeof this.document.name === "string" ? this.document.name : "Untitled Design",
        width: Number(this.document.width) || 1200,
        height: Number(this.document.height) || 800,
        backgroundColor:
          typeof this.document.backgroundColor === "string"
            ? this.document.backgroundColor
            : "#ffffff",
        pages: cleanPages,
        updatedAt: new Date().toISOString(),
      };

      if (safeThumbnail) {
        updates.thumbnail = safeThumbnail;
      }

      const saved = await repository.update(this.document.id, updates);
      this.document = saved;
      this.validateLayerNav();
      this.setSaveStatus("saved");
      return saved;
    } catch (err) {
      this.setSaveStatus("unsaved");
      throw err;
    }
  }
}

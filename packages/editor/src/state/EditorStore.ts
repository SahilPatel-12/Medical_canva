import {
  DesignDocument,
  DesignElement,
  DesignRepository,
  Asset,
  Page,
  sanitizePages,
} from "@design-platform/types";
import { HistoryManager, Command } from "../commands/history";
import { modifySvgColors } from "../canvas/svgUtils";

export type SaveStatus = "saved" | "saving" | "unsaved";

export interface EditorState {
  document: DesignDocument;
  selectedId: string | null;
  activePageIndex: number;
  zoom: number;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
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
  private activePageIndex: number = 0;
  private zoom: number = 1;
  private saveStatus: SaveStatus = "saved";
  private history: HistoryManager;
  private listeners: Set<StateListener> = new Set();
  private changeListeners: Set<ChangeBroadcastListener> = new Set();
  private isApplyingRemoteChange: boolean = false;
  private clipboard: DesignElement | null = null;

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
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  public getState(): EditorState {
    return {
      document: this.document,
      selectedId: this.selectedId,
      activePageIndex: this.activePageIndex,
      zoom: this.zoom,
      saveStatus: this.saveStatus,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
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
      this.activePageIndex = clamped;
      this.selectedId = null;
      this.notify();
    }
  }

  public getActivePage(): Page {
    return this.ensurePage();
  }

  public addPage(name?: string): Page {
    const pageCount = this.document.pages ? this.document.pages.length : 0;
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
    const newPages = [...previousPages, newPage];

    const command: Command = {
      name: "Add Canvas Page",
      execute: () => {
        this.document = { ...this.document, pages: newPages };
        this.activePageIndex = newPages.length - 1;
        this.selectedId = null;
        this.markDirty();
        this.emitChange({ type: "page_add", page: newPage });
      },
      undo: () => {
        this.document = { ...this.document, pages: previousPages };
        this.activePageIndex = Math.min(this.activePageIndex, previousPages.length - 1);
        this.selectedId = null;
        this.markDirty();
        this.emitChange({ type: "page_delete", pageIndex: newPages.length - 1 });
      },
      redo: () => {
        this.document = { ...this.document, pages: newPages };
        this.activePageIndex = newPages.length - 1;
        this.selectedId = null;
        this.markDirty();
        this.emitChange({ type: "page_add", page: newPage });
      },
    };

    this.history.execute(command);
    return newPage;
  }

  public duplicatePage(indexToDuplicate?: number): Page {
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
      page.name = safeName;
      this.markDirty();
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
    if (this.selectedId !== id) {
      this.selectedId = id;
      this.notify();
    }
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

  public setCanvasBackgroundColor(color: string): void {
    const previousColor = this.document.backgroundColor;
    const command: Command = {
      name: "Change background color",
      execute: () => {
        this.document = { ...this.document, backgroundColor: color };
        this.markDirty();
        this.emitChange({ type: "background_color", color });
      },
      undo: () => {
        this.document = { ...this.document, backgroundColor: previousColor };
        this.markDirty();
        this.emitChange({ type: "background_color", color: previousColor });
      },
      redo: () => {
        this.document = { ...this.document, backgroundColor: color };
        this.markDirty();
        this.emitChange({ type: "background_color", color });
      },
    };
    this.history.execute(command);
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
    // Only replace if current is a URL and markup is valid SVG XML
    if ((currentSvg.startsWith("http://") || currentSvg.startsWith("https://")) && svgMarkup.includes("<svg")) {
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
   * Modify vector colors for the selected SVG element
   */
  public updateSelectedSvgColor(fill?: string, stroke?: string): void {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "svg") return;

    const props = selected.properties as {
      originalSvg?: string;
      svgContent?: string;
      fill?: string;
      stroke?: string;
      colorMap?: Record<string, string>;
    };
    const baseSvg = props.originalSvg || props.svgContent || "";
    const modified = modifySvgColors(baseSvg, fill, stroke, props.colorMap);

    this.updateElement(selected.id, {
      properties: {
        ...selected.properties,
        svgContent: modified,
        fill,
        stroke,
      },
    });
  }

  /**
   * Replaces specific detected colors in the selected SVG element
   */
  public updateSelectedSvgColorMap(colorMap: Record<string, string>): void {
    const selected = this.getSelectedElement();
    if (!selected || selected.type !== "svg") return;

    const props = selected.properties as {
      originalSvg?: string;
      svgContent?: string;
      fill?: string;
      stroke?: string;
      colorMap?: Record<string, string>;
    };
    const baseSvg = props.originalSvg || props.svgContent || "";
    const mergedMap = { ...(props.colorMap || {}), ...colorMap };
    const modified = modifySvgColors(baseSvg, props.fill, props.stroke, mergedMap);

    this.updateElement(selected.id, {
      properties: {
        ...selected.properties,
        svgContent: modified,
        colorMap: mergedMap,
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
        colorMap: undefined,
      },
    });
  }

  // ==========================================
  // History Controls
  // ==========================================

  public undo(): void {
    this.history.undo();
  }

  public redo(): void {
    this.history.redo();
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
      this.setSaveStatus("saved");
      return saved;
    } catch (err) {
      this.setSaveStatus("unsaved");
      throw err;
    }
  }
}

import {
  DesignDocument,
  DesignElement,
  DesignRepository,
  Asset,
  Page,
} from "@design-platform/types";
import { HistoryManager, Command } from "../commands/history";
import { modifySvgColors } from "../canvas/svgUtils";

export type SaveStatus = "saved" | "saving" | "unsaved";

export interface EditorState {
  document: DesignDocument;
  selectedId: string | null;
  zoom: number;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
}

export type StateListener = (state: EditorState) => void;

export class EditorStore {
  private document: DesignDocument;
  private selectedId: string | null = null;
  private zoom: number = 1;
  private saveStatus: SaveStatus = "saved";
  private history: HistoryManager;
  private listeners: Set<StateListener> = new Set();
  private clipboard: DesignElement | null = null;

  constructor(initialDoc: DesignDocument) {
    this.document = initialDoc;
    this.ensurePage();
    this.history = new HistoryManager(50);
    this.history.subscribe(() => this.notify());
  }

  private ensurePage(): Page {
    if (!this.document.pages || this.document.pages.length === 0) {
      const defaultPage: Page = { id: "page-1", elements: [] };
      this.document = {
        ...this.document,
        pages: [defaultPage],
      };
      return defaultPage;
    }
    return this.document.pages[0] as Page;
  }

  private setPageElements(elements: DesignElement[]): void {
    const page = this.ensurePage();
    const updatedPage: Page = {
      id: page.id,
      name: page.name,
      elements,
    };
    this.document = {
      ...this.document,
      pages: [updatedPage, ...this.document.pages.slice(1)],
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

  public setDocument(doc: DesignDocument): void {
    this.document = doc;
    this.ensurePage();
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

  public addElement(element: DesignElement): void {
    const command: Command = {
      name: `Add ${element.type}`,
      execute: () => {
        const page = this.ensurePage();
        this.setPageElements([...page.elements, element]);
        this.selectedId = element.id;
        this.notify();
      },
      undo: () => {
        const page = this.ensurePage();
        this.setPageElements(page.elements.filter((el) => el.id !== element.id));
        if (this.selectedId === element.id) {
          this.selectedId = null;
        }
        this.notify();
      },
      redo: () => {
        const page = this.ensurePage();
        this.setPageElements([...page.elements, element]);
        this.selectedId = element.id;
        this.notify();
      },
    };

    this.history.execute(command);
  }

  public updateElement(
    id: string,
    updates: Partial<DesignElement>,
    skipHistory: boolean = false
  ): void {
    const activePage = this.ensurePage();
    const targetElement = activePage.elements.find((el) => el.id === id);
    if (!targetElement) return;

    const previousState = { ...targetElement, properties: { ...targetElement.properties } };
    const nextState = {
      ...targetElement,
      ...updates,
      properties: updates.properties
        ? { ...targetElement.properties, ...updates.properties }
        : targetElement.properties,
    };

    const applyState = (state: DesignElement) => {
      const page = this.ensurePage();
      this.setPageElements(page.elements.map((el) => (el.id === id ? state : el)));
      this.notify();
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

    const activePage = this.ensurePage();
    const index = activePage.elements.findIndex((el) => el.id === targetId);
    if (index === -1) return;

    const element = activePage.elements[index];
    if (!element) return;

    const command: Command = {
      name: `Delete ${element.type}`,
      execute: () => {
        const page = this.ensurePage();
        this.setPageElements(page.elements.filter((el) => el.id !== targetId));
        if (this.selectedId === targetId) {
          this.selectedId = null;
        }
        this.notify();
      },
      undo: () => {
        const page = this.ensurePage();
        const newElements = [...page.elements];
        newElements.splice(index, 0, element);
        this.setPageElements(newElements);
        this.selectedId = targetId;
        this.notify();
      },
      redo: () => {
        const page = this.ensurePage();
        this.setPageElements(page.elements.filter((el) => el.id !== targetId));
        if (this.selectedId === targetId) {
          this.selectedId = null;
        }
        this.notify();
      },
    };

    this.history.execute(command);
  }

  public duplicateElement(id?: string): void {
    const targetId = id || this.selectedId;
    if (!targetId) return;

    const activePage = this.ensurePage();
    const original = activePage.elements.find((el) => el.id === targetId);
    if (!original) return;

    const cloned: DesignElement = {
      ...original,
      id: `elem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      x: original.x + 24,
      y: original.y + 24,
      properties: { ...original.properties },
    };

    this.addElement(cloned);
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
      },
      undo: () => {
        this.document = { ...this.document, backgroundColor: previousColor };
        this.markDirty();
      },
      redo: () => {
        this.document = { ...this.document, backgroundColor: color };
        this.markDirty();
      },
    };
    this.history.execute(command);
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
        originalSvg: asset.source || asset.url || "",
        svgContent: asset.source || asset.url || "",
      },
    };
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
    };
    const baseSvg = props.originalSvg || props.svgContent || "";
    const modified = modifySvgColors(baseSvg, fill, stroke);

    this.updateElement(selected.id, {
      properties: {
        ...selected.properties,
        svgContent: modified,
        fill,
        stroke,
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
      const updates: Partial<DesignDocument> = {
        name: this.document.name,
        width: this.document.width,
        height: this.document.height,
        backgroundColor: this.document.backgroundColor,
        pages: this.document.pages,
        updatedAt: new Date().toISOString(),
      };

      if (thumbnailDataUrl) {
        updates.thumbnail = thumbnailDataUrl;
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

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { EditorStore, CanvasEngine, DocumentChangeAction } from "../src/index.js";
import { DesignDocument, DesignElement } from "@design-platform/types";

describe("EditorStore — Real-Time Collaborative Synchronization & Loop Prevention", () => {
  const sampleDoc: DesignDocument = {
    id: "design-collab-1",
    name: "Collaborative Design",
    width: 1200,
    height: 800,
    backgroundColor: "#ffffff",
    pages: [
      {
        id: "page-1",
        elements: [
          {
            id: "elem-1",
            type: "shape",
            x: 100,
            y: 100,
            width: 80,
            height: 80,
            rotation: 0,
            opacity: 1,
            properties: { shapeType: "rectangle", fill: "#3b82f6" },
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  test("local mutations emit document change actions", () => {
    const store = new EditorStore(sampleDoc);
    const emittedActions: DocumentChangeAction[] = [];

    const unsubscribe = store.onDocumentChange((action) => {
      emittedActions.push(action);
    });

    // 1. Local update
    store.updateElement("elem-1", { x: 150 });
    assert.equal(emittedActions.length, 1);
    assert.equal(emittedActions[0]?.type, "element_update");
    assert.equal((emittedActions[0] as { elementId: string }).elementId, "elem-1");

    // 2. Local add
    const newElement: DesignElement = {
      id: "elem-2",
      type: "text",
      x: 200,
      y: 200,
      width: 100,
      height: 40,
      rotation: 0,
      opacity: 1,
      properties: { text: "Hello Collaborator", fontSize: 16, fontFamily: "Inter", fill: "#000000" },
    };
    store.addElement(newElement);
    assert.equal(emittedActions.length, 2);
    assert.equal(emittedActions[1]?.type, "element_add");

    // 3. Local background color change
    store.setCanvasBackgroundColor("#f4f4f5");
    assert.equal(emittedActions.length, 3);
    assert.equal(emittedActions[2]?.type, "background_color");

    // 4. Local delete
    store.deleteElement("elem-1");
    assert.equal(emittedActions.length, 4);
    assert.equal(emittedActions[3]?.type, "element_delete");

    unsubscribe();
  });

  test("remote sync receivers apply changes without triggering echo broadcasts (infinite loop prevention)", () => {
    const store = new EditorStore(sampleDoc);
    const emittedActions: DocumentChangeAction[] = [];

    store.onDocumentChange((action) => {
      emittedActions.push(action);
    });

    // Applying remote update must NOT re-emit to change listeners
    store.applyRemoteElementUpdate("elem-1", { x: 300, y: 400 });
    assert.equal(emittedActions.length, 0, "Remote update must never trigger local broadcast echo");
    assert.equal(store.getSelectedElement()?.x ?? store.getDocument().pages[0]?.elements[0]?.x, 300);

    // Applying remote element add must NOT re-emit
    const remoteElement: DesignElement = {
      id: "elem-remote-99",
      type: "shape",
      x: 50,
      y: 50,
      width: 60,
      height: 60,
      rotation: 0,
      opacity: 1,
      properties: { shapeType: "circle", fill: "#10b981" },
    };
    store.applyRemoteElementAdd(remoteElement);
    assert.equal(emittedActions.length, 0, "Remote add must never trigger local broadcast echo");
    assert.ok(store.getDocument().pages[0]?.elements.some((el) => el.id === "elem-remote-99"));

    // Applying remote background color must NOT re-emit
    store.applyRemoteBackgroundColor("#18181b");
    assert.equal(emittedActions.length, 0, "Remote background change must never trigger local broadcast echo");
    assert.equal(store.getDocument().backgroundColor, "#18181b");

    // Applying remote delete must NOT re-emit
    store.applyRemoteElementDelete("elem-remote-99");
    assert.equal(emittedActions.length, 0, "Remote delete must never trigger local broadcast echo");
    assert.ok(!store.getDocument().pages[0]?.elements.some((el) => el.id === "elem-remote-99"));
  });

  test("two concurrent clients editing distinct elements synchronize without clobbering each other", () => {
    // Client A and Client B both load initial document with 2 elements
    const initialDoc: DesignDocument = {
      ...sampleDoc,
      pages: [
        {
          id: "page-1",
          elements: [
            {
              id: "elem-A",
              type: "shape",
              x: 10,
              y: 10,
              width: 50,
              height: 50,
              rotation: 0,
              opacity: 1,
              properties: {},
            },
            {
              id: "elem-B",
              type: "shape",
              x: 200,
              y: 200,
              width: 50,
              height: 50,
              rotation: 0,
              opacity: 1,
              properties: {},
            },
          ],
        },
      ],
    };

    const storeA = new EditorStore(JSON.parse(JSON.stringify(initialDoc)));
    const storeB = new EditorStore(JSON.parse(JSON.stringify(initialDoc)));

    // Wire up simulated broadcast bus between Store A and Store B
    storeA.onDocumentChange((action) => {
      if (action.type === "element_update") {
        storeB.applyRemoteElementUpdate(action.elementId, action.updates);
      }
    });

    storeB.onDocumentChange((action) => {
      if (action.type === "element_update") {
        storeA.applyRemoteElementUpdate(action.elementId, action.updates);
      }
    });

    // Client A moves elem-A to (88, 88)
    storeA.updateElement("elem-A", { x: 88, y: 88 });

    // Client B simultaneously moves elem-B to (999, 999)
    storeB.updateElement("elem-B", { x: 999, y: 999 });

    // Verify both stores have BOTH updates applied cleanly
    const elementsA = storeA.getDocument().pages[0]?.elements || [];
    const elementsB = storeB.getDocument().pages[0]?.elements || [];

    const elemA_on_A = elementsA.find((el) => el.id === "elem-A");
    const elemB_on_A = elementsA.find((el) => el.id === "elem-B");
    const elemA_on_B = elementsB.find((el) => el.id === "elem-A");
    const elemB_on_B = elementsB.find((el) => el.id === "elem-B");

    assert.equal(elemA_on_A?.x, 88);
    assert.equal(elemB_on_A?.x, 999, "Store A received remote edit for elem-B");
    assert.equal(elemA_on_B?.x, 88, "Store B received remote edit for elem-A");
    assert.equal(elemB_on_B?.x, 999);
  });

  test("CanvasEngine initializes in read-only mode and toggles getReadOnly cleanly", () => {
    const mockContainer = {} as HTMLDivElement;
    const engine = new CanvasEngine(mockContainer, {
      onSelect: () => {},
      onElementChange: () => {},
      onDropAsset: () => {},
      isReadOnly: true,
    });
    assert.equal(engine.getReadOnly(), true, "Should initialize with isReadOnly = true");
    engine.setReadOnly(false);
    assert.equal(engine.getReadOnly(), false, "Should toggle to isReadOnly = false");
    engine.setReadOnly(true);
    assert.equal(engine.getReadOnly(), true, "Should toggle back to isReadOnly = true");
  });

  test("multi-canvas page management: add, switch, duplicate, and delete pages", () => {
    const store = new EditorStore(sampleDoc);
    assert.equal(store.getDocument().pages.length, 1);
    assert.equal(store.getActivePageIndex(), 0);

    // 1. Add new page
    const page2 = store.addPage("Page 2");
    assert.equal(store.getDocument().pages.length, 2);
    assert.equal(store.getActivePageIndex(), 1, "Adding page sets it as active");
    assert.equal(store.getActivePage().id, page2.id);

    // 2. Add element to active page (Page 2)
    const page2Elem: DesignElement = {
      id: "elem-page-2",
      type: "shape",
      x: 300,
      y: 300,
      width: 50,
      height: 50,
      rotation: 0,
      opacity: 1,
      properties: { shapeType: "circle", fill: "#10b981" },
    };
    store.addElement(page2Elem);
    assert.equal(store.getDocument().pages[1]?.elements.length, 1);
    assert.equal(store.getDocument().pages[0]?.elements.length, 1, "Page 1 elements untouched");

    // 3. Switch active page back to Page 1
    store.setActivePageIndex(0);
    assert.equal(store.getActivePageIndex(), 0);
    assert.equal(store.getActivePage().id, "page-1");

    // 4. Duplicate Page 2
    store.setActivePageIndex(1);
    const duplicated = store.duplicatePage(1);
    assert.equal(store.getDocument().pages.length, 3);
    assert.equal(duplicated.elements.length, 1);
    assert.notEqual(duplicated.elements[0]?.id, page2Elem.id, "Duplicated elements have unique IDs");

    // 5. Delete Page 2
    const deleted = store.deletePage(1);
    assert.equal(deleted, true);
    assert.equal(store.getDocument().pages.length, 2);

    // 6. Cannot delete the only remaining page when down to 1
    store.deletePage(0);
    assert.equal(store.getDocument().pages.length, 1);
    const cannotDeleteLast = store.deletePage(0);
    assert.equal(cannotDeleteLast, false, "Cannot delete the sole remaining canvas page");
    assert.equal(store.getDocument().pages.length, 1);
  });

  test("prevents circular structures and React fiber from breaking serialization when event passed to addPage", async () => {
    const store = new EditorStore(sampleDoc);

    // Simulate an event object with circular SVGSVGElement and FiberNode
    const mockSvgNode: Record<string, unknown> = {
      constructor: { name: "SVGSVGElement" },
      nodeType: 1,
    };
    const mockFiberNode: Record<string, unknown> = {
      constructor: { name: "FiberNode" },
      stateNode: mockSvgNode,
    };
    mockSvgNode["__reactFiber$test123"] = mockFiberNode;

    const mockEvent = {
      target: mockSvgNode,
      currentTarget: mockSvgNode,
      bubbles: true,
      preventDefault: () => {},
    };

    // Passing event as parameter to addPage should NOT pollute page.name
    // @ts-expect-error Testing runtime resilience against accidental event parameter
    const newPage = store.addPage(mockEvent);

    assert.equal(typeof newPage.name, "string");
    assert.equal(newPage.name, "Page 2");

    // Mock repository that checks JSON.stringify
    let payloadSerializedSuccessfully = false;
    const mockRepo = {
      create: async () => sampleDoc,
      getById: async () => sampleDoc,
      list: async () => [sampleDoc],
      update: async (_id: string, updates: Partial<DesignDocument>) => {
        // This is what Supabase/PostgREST does internally
        const json = JSON.stringify(updates);
        assert.ok(json.length > 0);
        payloadSerializedSuccessfully = true;
        return { ...sampleDoc, ...updates } as DesignDocument;
      },
      delete: async () => {},
    };

    await store.save(mockRepo as any);
    assert.equal(payloadSerializedSuccessfully, true, "Payload was JSON serializable without circular error");
  });

  test("sanitizes circular properties and DOM references inside element properties during save", async () => {
    const store = new EditorStore(sampleDoc);

    // Circular object simulating DOM/Fiber
    const circularProp: Record<string, unknown> = {
      color: "#ff0000",
    };
    circularProp.self = circularProp;

    // Element with circular property
    const elementWithCircularProp: DesignElement = {
      id: "elem-circular",
      type: "shape",
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      properties: circularProp,
    };

    store.addElement(elementWithCircularProp);

    let savedUpdates: Partial<DesignDocument> | null = null;
    const mockRepo = {
      create: async () => sampleDoc,
      getById: async () => sampleDoc,
      list: async () => [sampleDoc],
      update: async (_id: string, updates: Partial<DesignDocument>) => {
        const json = JSON.stringify(updates);
        assert.ok(json.length > 0);
        savedUpdates = updates;
        return { ...sampleDoc, ...updates } as DesignDocument;
      },
      delete: async () => {},
    };

    await store.save(mockRepo as any);
    assert.ok(savedUpdates);
    const pages = (savedUpdates as Partial<DesignDocument>).pages;
    assert.ok(pages);
    const targetEl = pages[0]?.elements.find((e) => e.id === "elem-circular");
    assert.ok(targetEl);
    assert.equal(targetEl.properties.color, "#ff0000");
    // self reference is stripped
    assert.equal("self" in targetEl.properties, false);
  });

  test("multi-page asset isolation: elements added to page N stay on page N across clients", () => {
    // 2-page document
    const multiPageDoc: DesignDocument = {
      ...sampleDoc,
      pages: [
        { id: "page-1", name: "Page 1", elements: [] },
        { id: "page-2", name: "Page 2", elements: [] },
      ],
    };

    // Client A is on Page 2 (index 1)
    const clientA = new EditorStore(multiPageDoc);
    clientA.setActivePageIndex(1);
    assert.equal(clientA.getActivePageIndex(), 1);

    // Client B is on Page 1 (index 0)
    const clientB = new EditorStore(multiPageDoc);
    clientB.setActivePageIndex(0);
    assert.equal(clientB.getActivePageIndex(), 0);

    const emittedActionsFromA: DocumentChangeAction[] = [];
    clientA.onDocumentChange((action) => {
      emittedActionsFromA.push(action);
    });

    // Client A adds an asset to Page 2
    const page2Asset: DesignElement = {
      id: "elem-microscope-page-2",
      type: "svg",
      x: 150,
      y: 150,
      width: 120,
      height: 120,
      rotation: 0,
      opacity: 1,
      properties: { svgContent: "<svg></svg>" },
    };
    clientA.addElement(page2Asset);

    // Verify emission includes pageIndex 1 and pageId "page-2"
    assert.equal(emittedActionsFromA.length, 1);
    const addAction = emittedActionsFromA[0] as {
      type: "element_add";
      element: DesignElement;
      pageIndex?: number;
      pageId?: string;
    };
    assert.equal(addAction.type, "element_add");
    assert.equal(addAction.pageIndex, 1);
    assert.equal(addAction.pageId, "page-2");

    // Client B receives remote broadcast from Client A
    clientB.applyRemoteElementAdd(addAction.element, addAction.pageIndex, addAction.pageId);

    // CRITICAL: Verify Page 1 on Client B is untouched (has 0 elements)
    assert.equal(
      clientB.getDocument().pages[0]?.elements.length,
      0,
      "Client B's Page 1 must not contain the element added to Page 2"
    );

    // CRITICAL: Verify Page 2 on Client B contains the element
    assert.equal(
      clientB.getDocument().pages[1]?.elements.length,
      1,
      "Client B's Page 2 must receive the element"
    );
    assert.equal(
      clientB.getDocument().pages[1]?.elements[0]?.id,
      "elem-microscope-page-2"
    );

    // CRITICAL: Client B must NOT have been marked dirty by remote sync
    assert.equal(
      clientB.getState().saveStatus,
      "saved",
      "Client B must stay 'saved' so background auto-save does not overwrite"
    );

    // Client B updates the element on Page 2
    clientB.applyRemoteElementUpdate(
      "elem-microscope-page-2",
      { x: 250 },
      addAction.pageIndex,
      addAction.pageId
    );
    assert.equal(clientB.getDocument().pages[1]?.elements[0]?.x, 250);
    assert.equal(clientB.getDocument().pages[0]?.elements.length, 0);

    // Client B deletes the element
    clientB.applyRemoteElementDelete(
      "elem-microscope-page-2",
      addAction.pageIndex,
      addAction.pageId
    );
    assert.equal(clientB.getDocument().pages[1]?.elements.length, 0);
  });
});


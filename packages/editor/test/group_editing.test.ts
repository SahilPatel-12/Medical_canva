import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EditorStore,
  extractSvgSubComponents,
  combineElementsIntoSvgGroup,
  svgHasEditableLayers,
  ensureSvgIntrinsicSize,
} from "../src/index";
import { DesignDocument, DesignElement, SvgProperties } from "@design-platform/types";

const HEART_SVG = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <g id="Layer_1">
    <rect id="background" x="0" y="0" width="200" height="200" fill="#f1f5f9" />
    <g id="left-ventricle" fill="#ef4444">
      <circle id="lv-wall" cx="60" cy="100" r="30" />
      <circle id="lv-cavity" cx="60" cy="100" r="10" fill="#fee2e2" />
    </g>
    <path id="aorta" d="M120 40 L180 40 L180 80 L120 80 Z" fill="#3b82f6" />
  </g>
</svg>`;

function makeDoc(): DesignDocument {
  return {
    id: "doc-group-edit",
    name: "Group Edit",
    width: 1000,
    height: 1000,
    backgroundColor: "#ffffff",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages: [{ id: "page-1", name: "Page 1", elements: [] }],
  };
}

function makeHeart(overrides: Partial<DesignElement> = {}): DesignElement {
  return {
    id: "elem-heart",
    type: "svg",
    name: "Heart",
    x: 100,
    y: 100,
    width: 400,
    height: 400,
    rotation: 0,
    opacity: 1,
    properties: { svgContent: HEART_SVG, originalSvg: HEART_SVG },
    ...overrides,
  };
}

function elements(store: EditorStore): DesignElement[] {
  return store.getActivePage().elements;
}

describe("SVG structure editing (Figma-style groups)", () => {
  it("unwraps wrapper layers and flags nested groups", () => {
    const comps = extractSvgSubComponents(HEART_SVG);
    assert.deepEqual(
      comps.map((c) => c.id),
      ["background", "left-ventricle", "aorta"]
    );
    assert.equal(comps[1]?.isGroup, true);
    assert.equal(comps[2]?.isGroup, false);
    assert.equal(svgHasEditableLayers(HEART_SVG), true);
    assert.equal(svgHasEditableLayers(comps[1]!.svgMarkup), true);
    assert.equal(svgHasEditableLayers(comps[2]!.svgMarkup), false);
  });

  it("keeps styling inherited from the root <svg> and wrapper groups", () => {
    const icon = `<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(2 2)" opacity="0.8"><path d="M0 0 L10 10" /><circle cx="15" cy="15" r="3" /></g>
    </svg>`;
    const comps = extractSvgSubComponents(icon);
    assert.equal(comps.length, 2);
    for (const c of comps) {
      assert.ok(c.svgMarkup.includes('fill="none"'), "root fill inherited");
      assert.ok(c.svgMarkup.includes('stroke="#111"'), "root stroke inherited");
      assert.ok(c.svgMarkup.includes('transform="translate(2 2)"'), "wrapper transform kept");
      assert.ok(c.svgMarkup.includes('opacity="0.8"'), "wrapper opacity kept");
    }
    // Circle: center (17,17) r=3 plus half the 2-unit stroke
    assert.deepEqual(comps[1]?.bbox, { x: 13, y: 13, width: 8, height: 8 });
  });

  it("does not drop text, use or image layers", () => {
    const svg = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="50" height="50" />
      <text x="10" y="80" font-size="10">Label</text>
      <image x="60" y="60" width="20" height="20" href="data:image/png;base64,AA==" />
    </svg>`;
    const tags = extractSvgSubComponents(svg).map((c) => c.tag);
    assert.deepEqual(tags, ["rect", "text", "image"]);
  });

  it("gives viewBox-only SVGs an intrinsic size for rendering", () => {
    const sized = ensureSvgIntrinsicSize(`<svg viewBox="0 0 24 12" xmlns="http://www.w3.org/2000/svg"></svg>`);
    assert.ok(sized.includes('width="512"'));
    assert.ok(sized.includes('height="256"'));
    const untouched = `<svg width="10" height="10"></svg>`;
    assert.equal(ensureSvgIntrinsicSize(untouched), untouched);
  });

  it("navigating into groups never changes the document or the undo history", async () => {
    const store = new EditorStore(makeDoc());
    const heart = makeHeart();
    store.addElement(heart);
    const docBefore = store.getDocument();
    const canUndoBefore = store.getState().canUndo;

    // Aorta is at viewBox (120..180, 40..80) → canvas 2x scale + offset 100
    assert.equal(await store.enterGroupEdit("elem-heart", { x: 100 + 150 * 2, y: 100 + 60 * 2 }), true);
    assert.equal(store.getGroupEditSession()?.selectedLayerName, "Aorta");

    // Drill into the ventricle and select the cavity
    store.setLayerNav("elem-heart", [], [1]);
    assert.equal(store.getGroupEditSession()?.selectedLayerIsGroup, true);
    assert.equal(await store.enterGroupEdit("elem-heart", { x: 100 + 60 * 2, y: 100 + 100 * 2 }), true);
    const session = store.getGroupEditSession()!;
    assert.deepEqual(session.breadcrumb, ["Heart", "Left Ventricle"]);
    assert.equal(session.selectedLayerName, "Lv Cavity");

    store.exitGroupEdit(); // Esc → the ventricle group is selected
    assert.deepEqual(store.getGroupEditSession()?.selectedLayerPath, [1]);
    store.exitGroupEdit(); // Esc → whole illustration
    assert.equal(store.getGroupEditSession(), null);
    assert.equal(store.getSelectedId(), "elem-heart");

    assert.equal(store.getDocument(), docBefore, "document object untouched");
    assert.equal(store.getState().canUndo, canUndoBefore);
    assert.equal(elements(store)[0], heart);
  });

  it("moves a nested layer in place; everything else in the markup stays identical", () => {
    const store = new EditorStore(makeDoc());
    store.addElement(makeHeart());
    store.setLayerNav("elem-heart", [1], [1, 1]); // Lv Cavity

    // Drag 20px right on canvas = 10 viewBox units (2x scale)
    assert.equal(store.transformSelectedLayer([1, 0, 0, 1, 20, 0]), true);
    const svg = (elements(store)[0]!.properties as SvgProperties).svgContent;
    assert.ok(svg.includes('<circle id="lv-cavity" cx="60" cy="100" r="10" fill="#fee2e2" transform="translate(10 0)"/>'));
    // Only the moved tag was rewritten
    assert.equal(svg.replace(' transform="translate(10 0)"/>', " />"), HEART_SVG);
    assert.equal(elements(store).length, 1);
    // Still editing the same layer
    assert.deepEqual(store.getGroupEditSession()?.selectedLayerPath, [1, 1]);

    store.undo();
    assert.equal((elements(store)[0]!.properties as SvgProperties).svgContent, HEART_SVG);
    assert.deepEqual(store.getGroupEditSession()?.selectedLayerPath, [1, 1]);
  });

  it("resizes and rotates a layer around the right origin", () => {
    const store = new EditorStore(makeDoc());
    store.addElement(makeHeart());
    store.setLayerNav("elem-heart", [], [2]); // aorta at page (340,180) size 120x80
    // Scale 2x around the aorta's top-left corner on the page
    const ax = 100 + 120 * 2;
    const ay = 100 + 40 * 2;
    store.transformSelectedLayer([2, 0, 0, 2, -ax, -ay]);
    const aorta = store.getLayerGeom("elem-heart", [2])!;
    assert.ok(Math.abs(aorta.box.x - 240) < 0.05 && Math.abs(aorta.box.y - 80) < 0.05, JSON.stringify(aorta.box));
    assert.ok(Math.abs(aorta.box.width - 240) < 0.05 && Math.abs(aorta.box.height - 160) < 0.05);
  });

  it("grows the illustration instead of clipping a layer moved outside it", () => {
    const store = new EditorStore(makeDoc());
    store.addElement(makeHeart());
    store.setLayerNav("elem-heart", [], [2]);
    store.transformSelectedLayer([1, 0, 0, 1, 200, 0]); // aorta now ends at viewBox x=280
    const el = elements(store)[0]!;
    assert.equal(el.width, 560);
    assert.equal(el.x, 100);
    assert.ok((el.properties as SvgProperties).svgContent.includes('viewBox="0 0 280 200"'));
  });

  it("recolors, duplicates, deletes and ungroups layers", () => {
    const store = new EditorStore(makeDoc());
    store.addElement(makeHeart());
    const svgOf = () => (elements(store)[0]!.properties as SvgProperties).svgContent;

    store.setLayerNav("elem-heart", [], [2]);
    store.updateSelectedSvgColor("#22c55e");
    assert.ok(/<path id="aorta"[^>]*style="fill:#22c55e"/.test(svgOf()));
    assert.ok(svgOf().includes('<rect id="background" x="0" y="0" width="200" height="200" fill="#f1f5f9" />'));

    store.duplicateElement(); // layer selected → duplicates the layer
    assert.equal(store.getLayerGeoms("elem-heart", []).length, 4);
    assert.deepEqual(store.getGroupEditSession()?.selectedLayerPath, [3]);
    assert.equal(elements(store).length, 1);

    store.deleteElement(); // removes only the copy
    assert.equal(store.getLayerGeoms("elem-heart", []).length, 3);
    assert.equal(elements(store).length, 1);
    assert.ok(store.getGroupEditSession());

    store.setLayerNav("elem-heart", [], [1]);
    store.ungroupSelectedLayer(); // ventricle dissolved into the top level
    const names = store.getLayerGeoms("elem-heart", []).map((g) => g.name);
    assert.deepEqual(names, ["Background", "Lv Wall", "Lv Cavity", "Aorta"]);
    assert.ok(svgOf().includes('fill="#ef4444"'), "group fill pushed down to its children");
  });

  it("selecting another element or a page change leaves the open group", () => {
    const store = new EditorStore(makeDoc());
    store.addElement(makeHeart());
    store.addElement(makeHeart({ id: "elem-other", name: "Other", x: 600 }));
    store.setLayerNav("elem-heart", [], [0]);
    store.selectFromCanvas("elem-heart"); // click inside the open illustration: canvas resolves layers
    assert.ok(store.getGroupEditSession());
    store.selectFromCanvas("elem-other");
    assert.equal(store.getGroupEditSession(), null);
    assert.equal(store.getSelectedId(), "elem-other");

    store.setLayerNav("elem-heart", [], [0]);
    store.selectFromCanvas(null);
    assert.equal(store.getGroupEditSession(), null);
    assert.equal(store.getSelectedId(), null);
  });

  it("rotated illustrations: layer boxes follow the element frame", () => {
    const store = new EditorStore(makeDoc());
    store.addElement(makeHeart({ rotation: 90 }));
    store.setLayerNav("elem-heart", [], [2]);
    // Moving 10px right on the page of a 90° rotated element = 5 units up in the SVG (-y)
    store.transformSelectedLayer([1, 0, 0, 1, 10, 0]);
    const svg = (elements(store)[0]!.properties as SvgProperties).svgContent;
    assert.ok(/<path id="aorta"[^>]*transform="translate\(0 -5\)"/.test(svg), svg);
  });

  it("drops navigation when undo removes the layer it pointed at", () => {
    const store = new EditorStore(makeDoc());
    store.addElement(makeHeart());
    store.setLayerNav("elem-heart", [], [2]);
    store.duplicateSelectedLayer();
    assert.deepEqual(store.getGroupEditSession()?.selectedLayerPath, [3]);
    store.undo();
    assert.equal(store.getGroupEditSession()?.selectedLayerPath, null);
  });

  it("regroup keeps member rotation and position in the group frame", () => {
    const part = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="red"/></svg>`;
    const result = combineElementsIntoSvgGroup([
      { name: "A", x: 0, y: 0, width: 10, height: 10, rotation: 0, properties: { svgContent: part } },
      { name: "B", x: 20, y: 0, width: 10, height: 10, rotation: 90, properties: { svgContent: part } },
    ]);
    assert.ok(result);
    // B rotated 90° around its origin spans x 10..20, y 0..10
    assert.equal(result.x, 0);
    assert.equal(result.y, 0);
    assert.equal(result.width, 20);
    assert.equal(result.height, 10);
    assert.ok(result.svgMarkup.includes("rotate(90)"));
  });
});

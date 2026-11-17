import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorStore } from "../src/state/EditorStore";
import { flipSvgMarkup, getSvgFlipState } from "../src/canvas/svgFlip";
import { getSvgLayerChildren } from "../src/canvas/svgUtils";
import { extractColors } from "../src/canvas/svgColors";

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<g id="body"><rect x="10" y="10" width="20" height="30" fill="#ff0000"/></g>' +
  '<g id="tail"><path d="M60 60 L90 60 L90 90 Z" fill="#00ff00"/></g>' +
  "</svg>";

const base = (id: string, type: string, properties: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ id, type, name: id, x: 100, y: 100, width: 200, height: 200, rotation: 0, opacity: 1, properties, ...extra }) as never;

const makeStore = () =>
  new EditorStore({
    id: "d",
    name: "Doc",
    width: 1000,
    height: 800,
    backgroundColor: "#fff",
    createdAt: "",
    updatedAt: "",
    pages: [
      {
        id: "p1",
        name: "Page 1",
        elements: [
          base("art", "svg", { svgContent: SVG, originalSvg: SVG }),
          base("photo", "image", { src: "https://example.com/a.png" }),
          base("tri", "shape", { shapeType: "triangle", fill: "#000" }),
          base("rect", "shape", { shapeType: "rectangle", fill: "#000" }),
          base("arrow", "shape", { shapeType: "line", fill: "#000", startCap: "none", endCap: "arrow" }),
          base("txt", "text", { text: "Hi", fontSize: 20, fontFamily: "Inter", fill: "#000" }),
        ],
      },
    ],
  } as never);

const byId = (s: EditorStore, id: string) => s.getActivePage().elements.find((e) => e.id === id)!;
const props = (s: EditorStore, id: string) => byId(s, id).properties as unknown as Record<string, unknown>;

test("svg flip: mirror wrapper uses the viewBox, toggles back to the exact original", () => {
  const offset = SVG.replace('viewBox="0 0 100 100"', 'viewBox="10 20 100 50"');
  const h = flipSvgMarkup(offset, "horizontal");
  assert.match(h, /<g data-bc-flip="x" transform="matrix\(-1 0 0 1 120 0\)">/);
  assert.deepEqual(getSvgFlipState(h), { x: true, y: false });
  const hv = flipSvgMarkup(h, "vertical");
  assert.match(hv, /data-bc-flip="xy" transform="matrix\(-1 0 0 -1 120 90\)"/);
  assert.equal((hv.match(/data-bc-flip/g) || []).length, 1, "flips never pile up");
  assert.equal(flipSvgMarkup(flipSvgMarkup(hv, "horizontal"), "vertical"), offset);
  assert.equal(flipSvgMarkup(h, "horizontal"), offset);
});

test("svg flip: parts and colors keep working on mirrored artwork", () => {
  const flipped = flipSvgMarkup(SVG, "horizontal");
  const before = getSvgLayerChildren(SVG, []);
  const after = getSvgLayerChildren(flipped, []);
  assert.equal(after.length, before.length, "same top-level parts");
  assert.deepEqual(after.map((l) => l.id), ["body", "tail"]);
  // body spans x 10..30 -> mirrored to 70..90
  assert.ok(Math.abs(after[0]!.bbox!.x - 70) < 0.01, `body x ${after[0]!.bbox!.x}`);
  assert.ok(Math.abs(after[0]!.bbox!.width - 20) < 0.01);
  assert.deepEqual(extractColors(flipped).sort(), extractColors(SVG).sort());
});

test("flipSelection mirrors every flippable element in one undo step", () => {
  const s = makeStore();
  s.setSelection(["art", "photo", "tri", "rect", "arrow", "txt"]);
  s.flipSelection("horizontal");
  assert.equal(getSvgFlipState(props(s, "art").svgContent as string).x, true);
  assert.equal(getSvgFlipState(props(s, "art").originalSvg as string).x, true, "reset colors keeps the flip");
  assert.equal(props(s, "photo").flipX, true);
  assert.equal(props(s, "tri").flipX, true);
  assert.equal(props(s, "rect").flipX, undefined, "symmetric shapes are left alone");
  assert.equal(props(s, "arrow").startCap, "arrow");
  assert.equal(props(s, "arrow").endCap, "none");
  assert.equal(props(s, "txt").flipX, undefined, "text is never mirrored");
  s.undo();
  assert.equal(props(s, "art").svgContent, SVG);
  assert.equal(props(s, "photo").flipX, undefined);
  assert.equal(props(s, "arrow").endCap, "arrow");
});

test("canFlip: text, locked, symmetric and vertical lines cannot flip", () => {
  const s = makeStore();
  assert.equal(s.canFlip(byId(s, "txt")), false);
  assert.equal(s.canFlip(byId(s, "rect")), false);
  assert.equal(s.canFlip(byId(s, "arrow"), "vertical"), false);
  assert.equal(s.canFlip(byId(s, "arrow"), "horizontal"), true);
  assert.equal(s.canFlip(byId(s, "art"), "vertical"), true);
  assert.equal(s.canFlip({ ...byId(s, "art"), locked: true }), false);
});

test("flipSelectedLayer mirrors one part in place (its box stays put)", () => {
  const s = makeStore();
  s.selectElement("art");
  s.setLayerNav("art", [], [1]);
  const before = s.getLayerGeom("art", [1])!;
  assert.ok(s.flipSelectedLayer("horizontal"));
  const after = s.getLayerGeom("art", [1])!;
  for (const k of ["x", "y", "width", "height"] as const) {
    assert.ok(Math.abs(after.box[k] - before.box[k]) < 0.5, `${k}: ${before.box[k]} -> ${after.box[k]}`);
  }
  assert.notEqual(props(s, "art").svgContent, SVG);
  // The other part is untouched
  assert.deepEqual(s.getLayerGeom("art", [0])!.box, s.getLayerGeoms("art", [])[0]!.box);
});

test("cut copies then removes; paste brings it back", () => {
  const s = makeStore();
  s.setSelection(["tri", "rect"]);
  assert.equal(s.hasClipboard(), false);
  s.cutSelection();
  assert.equal(byId(s, "tri"), undefined);
  assert.equal(byId(s, "rect"), undefined);
  assert.equal(s.hasClipboard(), true);
  s.pasteSelection();
  assert.equal(s.getActivePage().elements.length, 6);
  assert.equal(s.getSelectedIds().length, 2);
});

test("toggleLockSelection locks, then unlocks when everything is locked", () => {
  const s = makeStore();
  s.setSelection(["tri", "rect"]);
  s.toggleLockSelection();
  assert.equal(byId(s, "tri").locked, true);
  assert.equal(byId(s, "rect").locked, true);
  s.selectElement("tri");
  s.toggleLockSelection();
  assert.equal(byId(s, "tri").locked, false);
  assert.equal(s.canFlip(byId(s, "rect")), false, "locked elements cannot flip");
});

test("alignSelectionToPage moves the selection as one block", () => {
  const s = makeStore();
  s.setSelection(["tri", "rect"]);
  s.updateElements([
    { id: "tri", updates: { x: 100, y: 100, width: 100, height: 100 } },
    { id: "rect", updates: { x: 300, y: 200, width: 100, height: 100 } },
  ]);
  s.alignSelectionToPage("center"); // page 1000 wide, block 100..400 -> 350..650
  assert.equal(byId(s, "tri").x, 350);
  assert.equal(byId(s, "rect").x, 550);
  s.alignSelectionToPage("bottom"); // page 800 tall, block bottom 300 -> 800
  assert.equal(byId(s, "rect").y, 700);
  assert.equal(byId(s, "tri").y, 600);
});

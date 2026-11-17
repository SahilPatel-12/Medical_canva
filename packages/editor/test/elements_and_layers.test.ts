import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorStore } from "../src/state/EditorStore";
import { POLYGON_SHAPE_TYPES, SHAPE_POLYGONS, polygonPoints, dashPattern } from "../src/elements/shapeGeometry";

const el = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    type: "shape",
    name: id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    properties: { shapeType: "rectangle", fill: "#000" },
    ...extra,
  }) as never;

const makeStore = (ids: string[]) =>
  new EditorStore({
    id: "d",
    name: "Doc",
    width: 800,
    height: 600,
    backgroundColor: "#fff",
    createdAt: "",
    updatedAt: "",
    pages: [{ id: "p1", name: "Page 1", elements: ids.map((id) => el(id)) }],
  } as never);

test("moveElementTo reorders the stack and is undoable", () => {
  const store = makeStore(["a", "b", "c", "d"]);
  store.moveElementTo("a", 3);
  assert.deepEqual(store.getActivePage().elements.map((e) => e.id), ["b", "c", "d", "a"]);
  store.moveElementTo("d", 0);
  assert.deepEqual(store.getActivePage().elements.map((e) => e.id), ["d", "b", "c", "a"]);
  store.undo();
  assert.deepEqual(store.getActivePage().elements.map((e) => e.id), ["b", "c", "d", "a"]);
  store.moveElementTo("missing", 0);
  assert.deepEqual(store.getActivePage().elements.map((e) => e.id), ["b", "c", "d", "a"]);
});

test("adding an element while editing parts of an illustration leaves parts editing", () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="40" height="40"/><circle cx="70" cy="70" r="20"/></svg>`;
  const store = makeStore([]);
  store.addElement(el("art", { type: "svg", properties: { svgContent: svg, originalSvg: svg } }));
  store.setLayerNav("art", [], [1]);
  assert.ok(store.getGroupEditSession());
  store.addElement(el("new"));
  assert.equal(store.getSelectedId(), "new");
  assert.equal(store.getGroupEditSession(), null);
});

test("polygon outlines fill their unit box and scale to any size", () => {
  for (const type of POLYGON_SHAPE_TYPES) {
    const pts = SHAPE_POLYGONS[type];
    assert.ok(pts.length >= 6 && pts.length % 2 === 0, type);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 1 && Math.min(...ys) >= 0 && Math.max(...ys) <= 1, type);
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 1) < 1e-3, `${type} spans full width`);
    assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - 1) < 1e-3, `${type} spans full height`);
  }
  assert.deepEqual(polygonPoints("triangle", 200, 100), [100, 0, 200, 100, 0, 100]);
});

test("dash patterns follow the stroke width", () => {
  assert.deepEqual(dashPattern("solid", 4), []);
  assert.deepEqual(dashPattern("dashed", 4), [12, 8]);
  assert.deepEqual(dashPattern("dotted", 4)[1], 8);
});

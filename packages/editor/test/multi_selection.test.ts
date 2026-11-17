import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorStore } from "../src/state/EditorStore";

const el = (id: string, x: number, y: number, w = 100, h = 50, extra: Record<string, unknown> = {}) =>
  ({
    id,
    type: "shape",
    name: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    properties: { shapeType: "rectangle", fill: "#000" },
    ...extra,
  }) as never;

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
        elements: [el("a", 10, 10), el("b", 300, 100, 200, 80), el("c", 700, 40, 60, 60), el("lockd", 0, 0, 10, 10, { locked: true })],
      },
    ],
  } as never);

const ids = (s: EditorStore) => s.getActivePage().elements.map((e) => e.id);
const byId = (s: EditorStore, id: string) => s.getActivePage().elements.find((e) => e.id === id)!;

test("selection: set, toggle, select all (locked items stay out of multi-selections)", () => {
  const s = makeStore();
  s.setSelection(["a", "b"]);
  assert.deepEqual(s.getSelectedIds(), ["a", "b"]);
  assert.equal(s.getState().selectedIds.length, 2);
  s.toggleInSelection("c");
  assert.deepEqual(s.getSelectedIds(), ["a", "b", "c"]);
  s.toggleInSelection("a");
  assert.deepEqual(s.getSelectedIds(), ["b", "c"]);
  s.selectAll();
  assert.deepEqual(s.getSelectedIds(), ["a", "b", "c"]);
  s.selectElement("a");
  assert.deepEqual(s.getSelectedIds(), ["a"]);
  s.setSelection([]);
  assert.deepEqual(s.getSelectedIds(), []);
});

test("updateElements is one undo step", () => {
  const s = makeStore();
  s.updateElements([
    { id: "a", updates: { x: 50 } },
    { id: "b", updates: { y: 5 } },
  ]);
  assert.equal(byId(s, "a").x, 50);
  assert.equal(byId(s, "b").y, 5);
  s.undo();
  assert.equal(byId(s, "a").x, 10);
  assert.equal(byId(s, "b").y, 100);
});

test("deleteSelection removes all at once; undo restores order and selection", () => {
  const s = makeStore();
  s.setSelection(["a", "c"]);
  s.deleteSelection();
  assert.deepEqual(ids(s), ["b", "lockd"]);
  assert.deepEqual(s.getSelectedIds(), []);
  s.undo();
  assert.deepEqual(ids(s), ["a", "b", "c", "lockd"]);
  assert.deepEqual(s.getSelectedIds(), ["a", "c"]);
});

test("duplicateSelection copies everything and selects the copies", () => {
  const s = makeStore();
  s.setSelection(["a", "b"]);
  s.duplicateSelection();
  const els = s.getActivePage().elements;
  assert.equal(els.length, 6);
  const copies = s.getSelectedElements();
  assert.equal(copies.length, 2);
  assert.ok(copies.every((c) => c.id !== "a" && c.id !== "b"));
  assert.deepEqual(copies.map((c) => [c.x, c.y]), [
    [34, 34],
    [324, 124],
  ]);
  s.undo();
  assert.equal(s.getActivePage().elements.length, 4);
});

test("copy / paste a multi-selection", () => {
  const s = makeStore();
  s.setSelection(["a", "c"]);
  s.copySelection();
  s.pasteSelection();
  assert.equal(s.getActivePage().elements.length, 6);
  assert.equal(s.getSelectedIds().length, 2);
});

test("align and distribute relative to the selection", () => {
  const s = makeStore();
  s.setSelection(["a", "b", "c"]);
  s.alignSelection("top");
  assert.deepEqual(["a", "b", "c"].map((id) => byId(s, id).y), [10, 10, 10]);
  s.alignSelection("right");
  assert.deepEqual(["a", "b", "c"].map((id) => byId(s, id).x + byId(s, id).width), [760, 760, 760]);
  s.undo();
  s.undo();
  // a [10..110], b [300..500], c [700..760] → equal gaps
  s.distributeSelection("horizontal");
  const a = byId(s, "a"), b = byId(s, "b"), c = byId(s, "c");
  assert.equal(a.x, 10);
  assert.equal(c.x, 700);
  assert.equal(Math.round(b.x - (a.x + a.width)), Math.round(c.x - (b.x + b.width)));
});

test("nudgeSelection moves all selected items", () => {
  const s = makeStore();
  s.setSelection(["a", "b"]);
  s.nudgeSelection(5, -2);
  assert.deepEqual([byId(s, "a").x, byId(s, "a").y, byId(s, "b").x, byId(s, "b").y], [15, 8, 305, 98]);
});

test("adding an element replaces a multi-selection", () => {
  const s = makeStore();
  s.setSelection(["a", "b"]);
  s.addElement(el("n", 1, 1));
  assert.deepEqual(s.getSelectedIds(), ["n"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorStore } from "../src/state/EditorStore";
import { getPageBackground, sanitizePages } from "@design-platform/types";

const makeStore = () =>
  new EditorStore({
    id: "d",
    name: "Doc",
    width: 800,
    height: 600,
    backgroundColor: "#ffffff",
    createdAt: "",
    updatedAt: "",
    pages: [
      { id: "p1", name: "Page 1", elements: [] },
      { id: "p2", name: "Page 2", elements: [] },
      { id: "p3", name: "Page 3", elements: [] },
    ],
  } as never);

const bgs = (s: EditorStore) => s.getDocument().pages.map((_, i) => getPageBackground(s.getDocument(), i));

test("a page color changes only that page", () => {
  const s = makeStore();
  s.setActivePageIndex(1);
  s.setPageBackgroundColor("#fde68a");
  assert.deepEqual(bgs(s), ["#ffffff", "#fde68a", "#ffffff"]);
  s.setPageBackgroundColor("#bfdbfe", 2);
  assert.deepEqual(bgs(s), ["#ffffff", "#fde68a", "#bfdbfe"]);
  assert.equal(s.getDocument().backgroundColor, "#ffffff", "design-wide color untouched");
  s.undo();
  assert.deepEqual(bgs(s), ["#ffffff", "#fde68a", "#ffffff"]);
  s.undo();
  assert.deepEqual(bgs(s), ["#ffffff", "#ffffff", "#ffffff"]);
  s.redo();
  assert.deepEqual(bgs(s), ["#ffffff", "#fde68a", "#ffffff"]);
});

test("apply to all pages replaces per-page colors in one undo step", () => {
  const s = makeStore();
  s.setPageBackgroundColor("#fde68a", 0);
  s.setPageBackgroundColor("#bfdbfe", 2);
  s.setCanvasBackgroundColor("#0f172a");
  assert.deepEqual(bgs(s), ["#0f172a", "#0f172a", "#0f172a"]);
  assert.ok(s.getDocument().pages.every((p) => !p.backgroundColor), "overrides cleared");
  s.undo();
  assert.deepEqual(bgs(s), ["#fde68a", "#ffffff", "#bfdbfe"]);
});

test("new pages use the design color; duplicates keep their page's color", () => {
  const s = makeStore();
  s.setPageBackgroundColor("#fde68a", 0);
  s.duplicatePage(0);
  assert.equal(getPageBackground(s.getDocument(), 1), "#fde68a");
  s.addPage();
  const last = s.getDocument().pages.length - 1;
  assert.equal(getPageBackground(s.getDocument(), last), "#ffffff");
});

test("page colors survive saving (sanitizePages)", () => {
  const pages = sanitizePages([{ id: "a", name: "A", elements: [], backgroundColor: "#fde68a" }, { id: "b", elements: [] }]);
  assert.equal(pages[0]!.backgroundColor, "#fde68a");
  assert.equal("backgroundColor" in pages[1]!, false);
});

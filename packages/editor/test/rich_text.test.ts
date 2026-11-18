import { test } from "node:test";
import assert from "node:assert/strict";
import {
  styleRange,
  styleAll,
  rangeStyle,
  getRuns,
  normalizeTextProps,
  replaceTextKeepingStyles,
  layoutRichText,
  resolveStyle,
  type TextMeasurer,
} from "../src/text/richText";
import { sanitizePages, type TextProperties } from "@design-platform/types";

const box = (text: string, extra: Partial<TextProperties> = {}): TextProperties => ({
  text,
  fontSize: 20,
  fontFamily: "Inter",
  fill: "#000000",
  ...extra,
});

/** 10px per character at 20px; scales with the drawn size */
const measure: TextMeasurer = {
  width: (t, s) => t.length * (s.script === "normal" ? s.fontSize : s.fontSize * 0.65) * 0.5,
  metrics: (s) => ({ ascent: s.fontSize * 0.8, descent: s.fontSize * 0.2 }),
};

test("bold one word: runs split around it, text unchanged", () => {
  const p = styleRange(box("Hello brave world"), 6, 11, { fontWeight: "bold" });
  assert.equal(p.text, "Hello brave world");
  assert.deepEqual(p.runs, [{ text: "Hello " }, { text: "brave", style: { fontWeight: "bold" } }, { text: " world" }]);
});

test("styling everything moves the style to the box and drops runs", () => {
  let p = styleRange(box("Hello"), 0, 2, { fill: "#ff0000" });
  p = styleRange(p, 2, 5, { fill: "#ff0000" });
  assert.equal(p.fill, "#ff0000");
  assert.equal(p.runs, undefined);
});

test("clearing a style merges runs back", () => {
  let p = styleRange(box("Hello world"), 0, 5, { fontStyle: "italic" });
  p = styleRange(p, 0, 5, { fontStyle: null });
  assert.equal(p.runs, undefined);
  assert.equal(p.fontStyle, undefined);
});

test("overlapping styles combine", () => {
  let p = styleRange(box("abcdef"), 0, 4, { fontWeight: "bold" });
  p = styleRange(p, 2, 6, { fill: "#ff0000" });
  assert.deepEqual(p.runs, [
    { text: "ab", style: { fontWeight: "bold" } },
    { text: "cd", style: { fontWeight: "bold", fill: "#ff0000" } },
    { text: "ef", style: { fill: "#ff0000" } },
  ]);
});

test("subscript and superscript (H₂O, x²)", () => {
  let p = styleRange(box("H2O and x2"), 1, 2, { script: "sub" });
  p = styleRange(p, 9, 10, { script: "super" });
  assert.equal(resolveStyle(p, getRuns(p)[1]!.style).script, "sub");
  assert.equal(getRuns(p).find((r) => r.text === "2" && r.style?.script === "super") !== undefined, true);
  const st = rangeStyle(p, 1, 2);
  assert.equal(st.script, "sub");
});

test("rangeStyle reports shared values and 'mixed'", () => {
  const p = styleRange(box("Hello world"), 0, 5, { fontWeight: "bold", fontSize: 32 });
  assert.equal(rangeStyle(p, 0, 5).fontWeight, "bold");
  assert.equal(rangeStyle(p, 0, 11).fontWeight, "mixed");
  assert.equal(rangeStyle(p, 0, 11).fontSize, "mixed");
  assert.equal(rangeStyle(p, 0, 11).fill, "#000000");
  assert.equal(rangeStyle(p, 3, 3).fontWeight, "bold", "caret reports the character before it");
  assert.equal(rangeStyle(p, 7, 7).fontWeight, "normal");
});

test("whole-box style wins over the parts' own values", () => {
  let p = styleRange(box("Hello world"), 0, 5, { fill: "#ff0000", fontWeight: "bold" });
  p = styleAll(p, { fill: "#0000ff" });
  assert.equal(p.fill, "#0000ff");
  assert.deepEqual(p.runs, [{ text: "Hello", style: { fontWeight: "bold" } }, { text: " world" }]);
  p = styleAll(p, { fontWeight: "normal" });
  assert.equal(p.runs, undefined, "no mixed style left");
});

test("whole-box superscript applies to every character", () => {
  const p = styleAll(box("abc"), { script: "super" });
  assert.equal(rangeStyle(p).script, "super");
});

test("editing plain text keeps the styles of untouched parts", () => {
  const p = styleRange(box("Hello brave world"), 6, 11, { fontWeight: "bold" });
  const q = replaceTextKeepingStyles(p, "Hello very brave world!");
  assert.equal(q.text, "Hello very brave world!");
  assert.equal(rangeStyle(q, 11, 16).fontWeight, "bold", "'brave' still bold");
  assert.equal(rangeStyle(q, 0, 5).fontWeight, "normal");
  const r = replaceTextKeepingStyles(p, "Hello bravest world");
  assert.equal(rangeStyle(r, 6, 13).fontWeight, "bold", "typed inside the bold word continues bold");
});

test("invalid runs (text out of sync) fall back to plain text", () => {
  const p = { ...box("abc"), runs: [{ text: "xy", style: { fontWeight: "bold" as const } }] };
  assert.deepEqual(getRuns(p), [{ text: "abc" }]);
  assert.equal(normalizeTextProps(p).runs, undefined);
});

test("layout: wraps by word, keeps styled words together, mixed sizes set line height", () => {
  // 10px per char at 20px
  let p = styleRange(box("aaaa H2O bbbb"), 6, 7, { script: "sub" });
  const lay = layoutRichText(p, 70, measure);
  assert.deepEqual(lay.lines.map((l) => l.fragments.map((f) => f.text).join("")), ["aaaa", "H2O", "bbbb"]);
  p = styleRange(box("small BIG"), 6, 9, { fontSize: 40 });
  const one = layoutRichText(p, 1000, measure);
  assert.equal(one.lines.length, 1);
  assert.equal(one.lines[0]!.height, 40 * 1.2, "line height follows the biggest text");
  assert.equal(one.height, 48);
});

test("layout: explicit line breaks, empty lines, alignment, long words", () => {
  const lay = layoutRichText(box("ab\n\ncd", { align: "center" }), 100, measure);
  assert.equal(lay.lines.length, 3);
  assert.equal(lay.lines[1]!.fragments.length, 0);
  assert.equal(lay.lines[0]!.fragments[0]!.x, 40, "centered: (100 - 20) / 2");
  const long = layoutRichText(box("abcdefghij"), 45, measure);
  assert.deepEqual(long.lines.map((l) => l.fragments.map((f) => f.text).join("")), ["abcd", "efgh", "ij"]);
});

test("runs survive saving (sanitizePages)", () => {
  const p = styleRange(box("Hello world"), 0, 5, { fontWeight: "bold", script: "super" });
  const [page] = sanitizePages([{ id: "p", elements: [{ id: "t", type: "text", x: 0, y: 0, width: 100, height: 20, properties: p }] }]);
  assert.deepEqual((page!.elements[0]!.properties as TextProperties).runs, p.runs);
});

test("size +/- keeps the difference between mixed sizes", () => {
  let p = styleRange(box("small BIG"), 6, 9, { fontSize: 40 });
  p = styleAll(p, { fontSizeDelta: 2 });
  assert.equal(p.fontSize, 22);
  assert.equal(rangeStyle(p, 6, 9).fontSize, 42);
  const q = styleRange(p, 0, 9, { fontSizeDelta: -4 });
  assert.equal(rangeStyle(q, 0, 5).fontSize, 18);
  assert.equal(rangeStyle(q, 6, 9).fontSize, 38);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorStore } from "../src/state/EditorStore";
import { extractSvgColors, modifySvgColors } from "../src/canvas/svgUtils";
import { canonicalColor, replaceSvgColors, recolorWholeSvg } from "../src/canvas/svgColors";

// Illustrator-style export: CSS classes, inline styles, attributes, a gradient, short hex, named color
const ART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <style>.cls-1{fill:#EF4444;stroke:#7f1d1d;stroke-width:4px}.cls-2{fill:#3b82f6}</style>
    <linearGradient id="g"><stop offset="0" stop-color="#FDE68A"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
  </defs>
  <circle class="cls-1" cx="50" cy="50" r="30"/>
  <rect class="cls-2" x="100" y="20" width="60" height="40"/>
  <path d="M10 150 L190 150" fill="none" stroke="#333" stroke-width="3"/>
  <ellipse cx="140" cy="140" rx="30" ry="20" style="fill:#22C55E;stroke:none"/>
  <circle cx="60" cy="140" r="15" fill="url(#g)"/>
  <text x="10" y="190" fill="black">Label</text>
</svg>`;

const svgStore = (markup = ART) =>
  new EditorStore({
    id: "d",
    name: "Doc",
    width: 800,
    height: 600,
    backgroundColor: "#fff",
    createdAt: "",
    updatedAt: "",
    pages: [
      {
        id: "p1",
        name: "Page 1",
        elements: [
          { id: "art", type: "svg", name: "Art", x: 0, y: 0, width: 200, height: 200, rotation: 0, opacity: 1, properties: { svgContent: markup, originalSvg: markup } },
          { id: "box", type: "shape", name: "Box", x: 0, y: 0, width: 50, height: 50, rotation: 0, opacity: 1, properties: { shapeType: "rectangle", fill: "#000000" } },
          { id: "txt", type: "text", name: "T", x: 0, y: 0, width: 50, height: 20, rotation: 0, opacity: 1, properties: { text: "Hi", fontSize: 12, fontFamily: "Inter", fill: "#111111" } },
        ],
      },
    ],
  } as never);
const content = (s: EditorStore) => (s.getElementById("art")!.properties as { svgContent: string }).svgContent;

test("canonicalColor understands every notation", () => {
  assert.equal(canonicalColor("#F00"), "#ff0000");
  assert.equal(canonicalColor(" #EF4444 "), "#ef4444");
  assert.equal(canonicalColor("rgb(239, 68, 68)"), "#ef4444");
  assert.equal(canonicalColor("black"), "#000000");
  assert.equal(canonicalColor("none"), null);
  assert.equal(canonicalColor("url(#g)"), null);
  assert.equal(canonicalColor("currentColor"), null);
});

test("extractSvgColors finds CSS-class, inline-style, attribute and gradient colors", () => {
  const colors = extractSvgColors(ART);
  for (const c of ["#ef4444", "#7f1d1d", "#3b82f6", "#333333", "#22c55e", "#fde68a", "#f59e0b", "#000000"]) {
    assert.ok(colors.includes(c), `missing ${c} in ${colors.join(", ")}`);
  }
  assert.ok(!colors.some((c) => c === "none" || c.startsWith("url")));
});

test("replacing a color changes it everywhere, whatever its notation", () => {
  const out = replaceSvgColors(ART, { "#ef4444": "#8b5cf6", "#333": "#0ea5e9", "#fde68a": "#ffffff" });
  assert.ok(out.includes(".cls-1{fill:#8b5cf6;"), "CSS class fill");
  assert.ok(out.includes('stroke="#0ea5e9"'), "short-hex attribute");
  assert.ok(out.includes('stop-color="#ffffff"'), "gradient stop");
  assert.ok(!/#ef4444/i.test(out) && !/"#333"/.test(out));
  // Everything else is untouched
  assert.ok(out.includes("stroke-width:4px") && out.includes('fill="none"') && out.includes("#3b82f6"));
  // Chained replacement works on the new color
  assert.ok(replaceSvgColors(out, { "#8b5cf6": "#111111" }).includes(".cls-1{fill:#111111;"));
});

test("recolor everything: fills change, unfilled outlines stay unfilled, no new outlines appear", () => {
  const out = recolorWholeSvg(ART, { fill: "#14b8a6" });
  assert.ok(out.includes(".cls-1{fill:#14b8a6;") && out.includes(".cls-2{fill:#14b8a6}"), "CSS fills");
  assert.ok(out.includes("fill:#14b8a6;stroke:none"), "inline style fill");
  assert.ok(out.includes('<path d="M10 150 L190 150" fill="none"'), "outline path keeps fill=none");
  assert.ok(!out.includes("url(#g)"), "gradient fill becomes the flat color");
  assert.ok(out.includes('stroke="#333"') && out.includes("stroke:#7f1d1d"), "strokes unchanged");
  assert.ok(/<svg[^>]*\sfill="#14b8a6"/.test(out), "inherited (unset) fills are covered via the root");
});

test("recolor everything: outline color and width change only existing outlines", () => {
  const out = recolorWholeSvg(ART, { stroke: "#be185d", strokeWidth: 6 });
  assert.ok(out.includes("stroke:#be185d") && out.includes('stroke="#be185d"'));
  assert.ok(out.includes("stroke:none"), "explicit no-outline is kept");
  assert.ok(out.includes("stroke-width:6") && out.includes('stroke-width="6"'));
  assert.ok(!/<rect[^>]*stroke=/.test(out), "shapes without an outline don't gain one");
  // Artwork without any outline: the outline is added to everything
  const plain = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="5" fill="#000"/></svg>`;
  const outlined = recolorWholeSvg(plain, { stroke: "#ff0000", strokeWidth: 2 });
  assert.ok(/<svg[^>]*stroke="#ff0000"[^>]*stroke-width="2"|<svg[^>]*stroke-width="2"[^>]*stroke="#ff0000"/.test(outlined), outlined);
});

test("modifySvgColors (legacy API) uses the same rules", () => {
  const out = modifySvgColors(ART, { colorMap: { "#3B82F6": "#000000" } });
  assert.ok(out.includes(".cls-2{fill:#000000}"));
});

test("store: swatch replacement works after 'recolor everything' and keeps working when chained", () => {
  const s = svgStore();
  s.selectElement("art");
  s.updateSelectedSvgColor("#14b8a6", undefined);
  assert.ok(extractSvgColors(content(s)).includes("#14b8a6"));
  s.updateSelectedSvgColorMap({ "#14b8a6": "#f43f5e" });
  assert.ok(content(s).includes(".cls-1{fill:#f43f5e;"), "replacing the recolored fill is visible");
  s.updateSelectedSvgColorMap({ "#7F1D1D": "#000000" });
  assert.ok(content(s).includes("stroke:#000000"), "uppercase key matches");
  // Outline width is kept when colors change
  s.updateSelectedSvgColor(undefined, undefined, 8);
  s.updateSelectedSvgColorMap({ "#f43f5e": "#22c55e" });
  assert.ok(content(s).includes("stroke-width:8"), "outline width survives later color edits");
});

test("store: reset restores the original colors, including recolored parts", () => {
  const s = svgStore();
  s.selectElement("art");
  s.setLayerNav("art", [], [0]);
  s.recolorSelectedLayer({ fill: "#000000" });
  assert.notEqual(content(s), ART);
  s.exitAllGroupEdits();
  s.updateSelectedSvgColorMap({ "#3b82f6": "#ffffff" });
  s.resetSelectedSvgColors();
  assert.equal(content(s), ART);
});

test("store: undo reverts a color change in one step", () => {
  const s = svgStore();
  s.selectElement("art");
  s.updateSelectedSvgColorMap({ "#22c55e": "#000000" });
  s.undo();
  assert.equal(content(s), ART);
});

test("shapes and text: fill changes and multi-selection recolor", () => {
  const s = svgStore();
  s.updateElements([
    { id: "box", updates: { properties: { shapeType: "rectangle", fill: "#10b981" } as never } },
    { id: "txt", updates: { properties: { text: "Hi", fontSize: 12, fontFamily: "Inter", fill: "#10b981" } as never } },
  ]);
  assert.equal((s.getElementById("box")!.properties as { fill: string }).fill, "#10b981");
  assert.equal((s.getElementById("txt")!.properties as { fill: string }).fill, "#10b981");
});

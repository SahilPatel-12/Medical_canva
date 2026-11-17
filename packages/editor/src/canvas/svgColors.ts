// ==========================================
// SVG color engine (pure string operations: identical in the browser and in Node)
// ------------------------------------------
// Colors in real-world SVGs live in four places, all handled here:
//   1. presentation attributes      fill="#f00"  stroke="#333"  stop-color="…"
//   2. inline styles                style="fill:#22c55e;stroke:none"
//   3. <style> CSS (Illustrator)    .cls-1{fill:#EF4444}
//   4. gradients                    <stop stop-color="…">
// Every value is compared by its canonical form (#rrggbb), so "#F00", "#ff0000",
// "rgb(255,0,0)" and "red" are the same color. Only color values are rewritten:
// the rest of the markup stays byte-for-byte identical.
// ==========================================

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  lime: "#00ff00",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  cyan: "#00ffff",
  aqua: "#00ffff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  navy: "#000080",
  teal: "#008080",
  olive: "#808000",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  gold: "#ffd700",
  indigo: "#4b0082",
  violet: "#ee82ee",
  crimson: "#dc143c",
  coral: "#ff7f50",
  salmon: "#fa8072",
  tomato: "#ff6347",
  khaki: "#f0e68c",
  beige: "#f5f5dc",
  ivory: "#fffff0",
  darkgray: "#a9a9a9",
  darkgrey: "#a9a9a9",
  lightgray: "#d3d3d3",
  lightgrey: "#d3d3d3",
  darkred: "#8b0000",
  darkblue: "#00008b",
  darkgreen: "#006400",
  lightblue: "#add8e6",
  lightgreen: "#90ee90",
  skyblue: "#87ceeb",
  steelblue: "#4682b4",
  royalblue: "#4169e1",
  slategray: "#708090",
  slategrey: "#708090",
};

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/** Canonical "#rrggbb" for any CSS color value, or null for none / url() / keywords */
export function canonicalColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase().replace(/\s*!important$/, "");
  if (!v || v === "none" || v === "transparent" || v === "currentcolor" || v === "inherit" || v.startsWith("url(")) {
    return null;
  }
  let m = v.match(/^#([0-9a-f]{3,4})$/);
  if (m) return `#${m[1]!.slice(0, 3).split("").map((c) => c + c).join("")}`;
  m = v.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/);
  if (m) return `#${m[1]}`;
  m = v.match(/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/);
  if (m) {
    const ch = (c: string) => (c.endsWith("%") ? (parseFloat(c) / 100) * 255 : parseFloat(c));
    return `#${hex2(ch(m[1]!))}${hex2(ch(m[2]!))}${hex2(ch(m[3]!))}`;
  }
  return NAMED_COLORS[v] || null;
}

const PAINT_PROPS = "fill|stroke|stop-color|flood-color|lighting-color|color";
/** name="value" / name='value' */
const ATTR_RE = new RegExp(`(\\s(?:${PAINT_PROPS})\\s*=\\s*)(["'])([^"']*)\\2`, "gi");
/** name: value (inside style="" and <style> blocks) */
const CSS_RE = new RegExp(`((?:^|[\\s;{"'])(?:${PAINT_PROPS})\\s*:\\s*)(#[0-9a-fA-F]{3,8}|rgba?\\([^)]*\\)|url\\([^)]*\\)|[a-zA-Z]+)`, "g");

type PaintVisitor = (prop: string, value: string) => string | null;

/** Calls `visit` for every paint value; a returned string replaces the value */
function rewritePaints(svg: string, visit: PaintVisitor): string {
  let out = svg.replace(ATTR_RE, (whole, head: string, quote: string, value: string) => {
    const prop = head.trim().replace(/\s*=\s*$/, "").toLowerCase();
    const next = visit(prop, value);
    return next === null ? whole : `${head}${quote}${next}${quote}`;
  });
  out = out.replace(CSS_RE, (whole, head: string, value: string) => {
    const prop = head.replace(/^[\s;{"']/, "").replace(/\s*:\s*$/, "").trim().toLowerCase();
    const next = visit(prop, value);
    return next === null ? whole : `${head}${next}`;
  });
  return out;
}

/** Distinct colors used in the artwork (canonical "#rrggbb"), most used first */
export function extractColors(svg: string): string[] {
  if (!svg || !svg.includes("<svg")) return [];
  const counts = new Map<string, number>();
  rewritePaints(svg, (_prop, value) => {
    const c = canonicalColor(value);
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
    return null;
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/** Replaces colors everywhere they are used. Keys may use any notation. */
export function replaceSvgColors(svg: string, map: Record<string, string>): string {
  if (!svg || !map) return svg;
  const canonicalMap = new Map<string, string>();
  for (const [from, to] of Object.entries(map)) {
    const key = canonicalColor(from);
    if (key && to) canonicalMap.set(key, to);
  }
  if (canonicalMap.size === 0) return svg;
  return rewritePaints(svg, (_prop, value) => {
    const c = canonicalColor(value);
    return c && canonicalMap.has(c) ? canonicalMap.get(c)! : null;
  });
}

/** Sets (or replaces) presentation attributes on the root <svg> tag */
function setRootAttrs(svg: string, attrs: Record<string, string>): string {
  const start = svg.search(/<svg[\s>]/i);
  if (start < 0) return svg;
  const end = svg.indexOf(">", start);
  if (end < 0) return svg;
  let tag = svg.slice(start, end);
  const selfClose = tag.endsWith("/");
  if (selfClose) tag = tag.slice(0, -1);
  for (const [name, value] of Object.entries(attrs)) {
    const re = new RegExp(`(\\s${name}\\s*=\\s*)(["'])[^"']*\\2`, "i");
    tag = re.test(tag) ? tag.replace(re, `$1"${value}"`) : `${tag} ${name}="${value}"`;
  }
  return svg.slice(0, start) + tag + (selfClose ? "/" : "") + svg.slice(end);
}

export interface WholeSvgColors {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * "Recolor everything":
 * - fill: every visible fill (colors and gradients) becomes `fill`; unfilled outlines
 *   (fill="none") stay unfilled; unset fills are covered through the root.
 * - stroke: existing outlines change color. Artwork without any outline gets one.
 * - strokeWidth: existing outline widths change (and become the inherited default).
 */
export function recolorWholeSvg(svg: string, colors: WholeSvgColors): string {
  if (!svg || !svg.includes("<svg")) return svg;
  const { fill, stroke, strokeWidth } = colors;
  let out = svg;
  let hasStroke = false;
  rewritePaints(svg, (prop, value) => {
    if (prop === "stroke" && canonicalColor(value)) hasStroke = true;
    return null;
  });

  out = rewritePaints(out, (prop, value) => {
    const isPaint = canonicalColor(value) !== null || value.trim().toLowerCase().startsWith("url(");
    if (!isPaint) return null;
    if (fill && prop === "fill") return fill;
    if (stroke && prop === "stroke") return stroke;
    return null;
  });

  if (strokeWidth !== undefined) {
    const w = String(strokeWidth);
    out = out
      .replace(/(\sstroke-width\s*=\s*)(["'])[^"']*\2/gi, `$1$2${w}$2`)
      .replace(/((?:^|[\s;{"'])stroke-width\s*:\s*)[^;}"']+/gi, `$1${w}`);
  }

  const rootAttrs: Record<string, string> = {};
  if (fill) rootAttrs.fill = fill;
  if (stroke && !hasStroke) {
    rootAttrs.stroke = stroke;
    if (strokeWidth === undefined) rootAttrs["stroke-width"] = "1.5";
  }
  if (strokeWidth !== undefined && (hasStroke || stroke)) rootAttrs["stroke-width"] = String(strokeWidth);
  return Object.keys(rootAttrs).length ? setRootAttrs(out, rootAttrs) : out;
}

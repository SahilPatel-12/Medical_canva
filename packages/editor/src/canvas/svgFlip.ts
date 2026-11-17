// ==========================================
// Mirroring illustrations (pure string operations)
// ------------------------------------------
// A flip wraps the artwork in one group carrying the mirror transform:
//   <svg …><g data-bc-flip="x" transform="matrix(-1 0 0 1 W 0)"> … </g></svg>
// Flipping the same axis again removes it, so flips never pile up. The layer model
// unwraps single <g> wrappers, so parts editing keeps working on flipped artwork.
// ==========================================

export type FlipAxis = "horizontal" | "vertical";

export interface FlipState {
  x: boolean;
  y: boolean;
}

const WRAPPER_OPEN_RE = /<g\s+data-bc-flip="([xy]*)"[^>]*>/i;

function rootTagRange(svg: string): { start: number; end: number } | null {
  const start = svg.search(/<svg[\s>]/i);
  if (start < 0) return null;
  const end = svg.indexOf(">", start);
  if (end < 0 || svg[end - 1] === "/") return null;
  return { start, end: end + 1 };
}

function viewBoxNumbers(rootTag: string): [number, number, number, number] {
  const vb = rootTag.match(/\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (vb) {
    const n = vb.trim().split(/[\s,]+/).map(Number);
    if (n.length === 4 && n.every((v) => Number.isFinite(v)) && n[2]! > 0 && n[3]! > 0) {
      return n as [number, number, number, number];
    }
  }
  const w = parseFloat(rootTag.match(/\swidth\s*=\s*["']([0-9.]+)/i)?.[1] || "");
  const h = parseFloat(rootTag.match(/\sheight\s*=\s*["']([0-9.]+)/i)?.[1] || "");
  return [0, 0, w > 0 ? w : 100, h > 0 ? h : 100];
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);

/** Current mirror state of an illustration */
export function getSvgFlipState(svg: string): FlipState {
  const flags = svg?.match(WRAPPER_OPEN_RE)?.[1] || "";
  return { x: flags.includes("x"), y: flags.includes("y") };
}

/** Removes the flip wrapper (if any); returns the inner artwork markup */
function unwrapFlip(svg: string): string {
  const open = svg.match(WRAPPER_OPEN_RE);
  if (!open || open.index === undefined) return svg;
  const close = svg.lastIndexOf("</g>", svg.search(/<\/svg>\s*$/i));
  if (close < open.index) return svg;
  return svg.slice(0, open.index) + svg.slice(open.index + open[0].length, close) + svg.slice(close + 4);
}

/** Sets the mirror state of an illustration (no wrapper when it is not flipped) */
export function setSvgFlipState(svg: string, state: FlipState): string {
  if (!svg || !svg.includes("<svg")) return svg;
  const base = unwrapFlip(svg);
  if (!state.x && !state.y) return base;
  const root = rootTagRange(base);
  const closeIdx = base.search(/<\/svg>\s*$/i);
  if (!root || closeIdx < root.end) return svg;
  const [vbX, vbY, vbW, vbH] = viewBoxNumbers(base.slice(root.start, root.end));
  const sx = state.x ? -1 : 1;
  const sy = state.y ? -1 : 1;
  const tx = state.x ? 2 * vbX + vbW : 0;
  const ty = state.y ? 2 * vbY + vbH : 0;
  const flags = `${state.x ? "x" : ""}${state.y ? "y" : ""}`;
  const open = `<g data-bc-flip="${flags}" transform="matrix(${sx} 0 0 ${sy} ${num(tx)} ${num(ty)})">`;
  return base.slice(0, root.end) + open + base.slice(root.end, closeIdx) + "</g>" + base.slice(closeIdx);
}

/** Mirrors an illustration across its vertical (horizontal flip) or horizontal axis */
export function flipSvgMarkup(svg: string, axis: FlipAxis): string {
  const state = getSvgFlipState(svg);
  return setSvgFlipState(svg, axis === "horizontal" ? { ...state, x: !state.x } : { ...state, y: !state.y });
}

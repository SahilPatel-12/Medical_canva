// ==========================================
// Rich text (several styles in one text box, like Figma / Canva)
// ------------------------------------------
// A text box keeps its plain `text` plus optional `runs`: consecutive pieces of that
// text, each with a partial style. Keys a run leaves unset use the box's own style.
// Everything here is pure (no DOM), so it runs the same in the browser and in tests.
// ==========================================

import type { TextProperties, TextRun, TextRunStyle } from "@design-platform/types";

export type TextStyleKey = keyof TextRunStyle;

/**
 * A style change: style keys (null clears), plus `fontSizeDelta` to grow / shrink every
 * part by the same step (mixed sizes keep their differences, like Canva's +/- buttons).
 */
export type TextStylePatch = Partial<Record<TextStyleKey, unknown>> & { fontSizeDelta?: number };

const MIN_FONT = 4;
const MAX_FONT = 800;
const bump = (size: number, delta: number) => Math.max(MIN_FONT, Math.min(MAX_FONT, Math.round((size + delta) * 10) / 10));
export const TEXT_STYLE_KEYS: TextStyleKey[] = [
  "fontWeight",
  "fontStyle",
  "fill",
  "fontSize",
  "fontFamily",
  "underline",
  "strike",
  "script",
];

/** Keys that also exist on the text box itself (a whole-box change sets these) */
const BOX_KEYS: TextStyleKey[] = ["fontWeight", "fontStyle", "fill", "fontSize", "fontFamily", "underline", "strike"];

export interface ResolvedTextStyle {
  fontWeight: "normal" | "bold" | "600" | "500";
  fontStyle: "normal" | "italic";
  fill: string;
  fontSize: number;
  fontFamily: string;
  underline: boolean;
  strike: boolean;
  script: "normal" | "super" | "sub";
}

export const DEFAULT_FONT_FAMILY = "Inter, -apple-system, sans-serif";

/** Superscript / subscript glyphs are drawn at this fraction of the font size */
export const SCRIPT_SCALE = 0.65;

export function boxStyle(props: Partial<TextProperties>): ResolvedTextStyle {
  return {
    fontWeight: props.fontWeight || "normal",
    fontStyle: props.fontStyle === "italic" ? "italic" : "normal",
    fill: props.fill || "#18181b",
    fontSize: props.fontSize || 24,
    fontFamily: props.fontFamily || DEFAULT_FONT_FAMILY,
    underline: Boolean(props.underline),
    strike: Boolean(props.strike),
    script: "normal",
  };
}

export function resolveStyle(props: Partial<TextProperties>, style?: TextRunStyle): ResolvedTextStyle {
  const base = boxStyle(props);
  if (!style) return base;
  const out = { ...base };
  for (const k of TEXT_STYLE_KEYS) {
    const v = style[k];
    if (v !== undefined && v !== null) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** The runs of a text box; a single plain run when it has one style (or invalid runs) */
export function getRuns(props: Partial<TextProperties>): TextRun[] {
  const text = props.text || "";
  const runs = props.runs;
  if (Array.isArray(runs) && runs.length > 0 && runs.map((r) => r.text || "").join("") === text) {
    return runs.map((r) => ({ text: r.text || "", ...(r.style ? { style: { ...r.style } } : {}) }));
  }
  return [{ text }];
}

export function hasRichStyles(props: Partial<TextProperties>): boolean {
  return getRuns(props).some((r) => r.style && Object.keys(r.style).length > 0);
}

const sameStyle = (a?: TextRunStyle, b?: TextRunStyle) => {
  for (const k of TEXT_STYLE_KEYS) if ((a?.[k] ?? undefined) !== (b?.[k] ?? undefined)) return false;
  return true;
};

/** Removes run keys equal to the box style, drops empty runs and merges equal neighbours */
function cleanRuns(runs: TextRun[], props: Partial<TextProperties>): TextRun[] {
  const base = boxStyle(props);
  const out: TextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    let style: TextRunStyle | undefined;
    if (run.style) {
      for (const k of TEXT_STYLE_KEYS) {
        const v = run.style[k];
        if (v === undefined || v === null) continue;
        if (k === "script" ? v === "normal" : (base as unknown as Record<string, unknown>)[k] === v) continue;
        if ((k === "underline" || k === "strike") && v === false && !base[k]) continue;
        (style ||= {})[k] = v as never;
      }
    }
    const last = out[out.length - 1];
    if (last && sameStyle(last.style, style)) last.text += run.text;
    else out.push(style ? { text: run.text, style } : { text: run.text });
  }
  return out;
}

/**
 * Canonical form: a style every character shares moves up to the box itself, and the
 * box drops `runs` entirely when nothing is mixed. `text` always equals the runs' text.
 */
export function normalizeTextProps<T extends Partial<TextProperties>>(props: T, runs: TextRun[] = getRuns(props)): T {
  const text = runs.map((r) => r.text).join("");
  let next: T = { ...props, text };
  let cleaned = cleanRuns(runs, next);
  if (text.length > 0) {
    // Lift styles shared by every character up to the box
    const lift: Partial<TextProperties> = {};
    for (const k of BOX_KEYS) {
      const first = cleaned[0]?.style?.[k];
      if (first === undefined) continue;
      if (cleaned.every((r) => r.style?.[k] === first)) (lift as Record<string, unknown>)[k] = first;
    }
    if (Object.keys(lift).length) {
      next = { ...next, ...lift };
      cleaned = cleanRuns(cleaned, next);
    }
  }
  const mixed = cleaned.length > 1 || Boolean(cleaned[0]?.style);
  if (mixed) {
    next = { ...next, runs: cleaned };
  } else {
    const { runs: _drop, ...rest } = next as T & { runs?: TextRun[] };
    void _drop;
    next = rest as T;
  }
  if (!next.underline) delete (next as Partial<TextProperties>).underline;
  if (!next.strike) delete (next as Partial<TextProperties>).strike;
  return next;
}

/** Splits runs so that `at` falls on a run boundary; returns the index of the run starting there */
function splitAt(runs: TextRun[], at: number): number {
  let pos = 0;
  for (let i = 0; i < runs.length; i++) {
    const len = runs[i]!.text.length;
    if (at === pos) return i;
    if (at < pos + len) {
      const run = runs[i]!;
      const left: TextRun = { ...run, text: run.text.slice(0, at - pos) };
      const right: TextRun = { ...run, text: run.text.slice(at - pos), ...(run.style ? { style: { ...run.style } } : {}) };
      runs.splice(i, 1, left, right);
      return i + 1;
    }
    pos += len;
  }
  return runs.length;
}

/** Applies a style patch to characters [start, end). `null` / `undefined` values clear a key. */
export function styleRange<T extends Partial<TextProperties>>(
  props: T,
  start: number,
  end: number,
  patch: TextStylePatch
): T {
  const text = props.text || "";
  const a = Math.max(0, Math.min(start, end, text.length));
  const b = Math.min(text.length, Math.max(start, end));
  if (a === b) return props;
  const runs = getRuns(props);
  const i = splitAt(runs, a);
  const j = splitAt(runs, b);
  const { fontSizeDelta, ...keys } = patch;
  for (let k = i; k < j; k++) {
    const style: TextRunStyle = { ...(runs[k]!.style || {}) };
    if (fontSizeDelta) style.fontSize = bump(resolveStyle(props, style).fontSize, fontSizeDelta);
    for (const [key, value] of Object.entries(keys)) {
      if (value === undefined || value === null) delete style[key as TextStyleKey];
      else (style as Record<string, unknown>)[key] = value;
    }
    runs[k] = { text: runs[k]!.text, style };
  }
  return normalizeTextProps(props, runs);
}

/** Applies a style to the whole text box: the box takes the value, runs stop overriding it */
export function styleAll<T extends Partial<TextProperties>>(props: T, patch: TextStylePatch): T {
  const { fontSizeDelta, ...keys } = patch;
  if (fontSizeDelta) {
    // Every part grows by the same step; the box's own size too
    const runs = getRuns(props).map((r) =>
      r.style?.fontSize ? { text: r.text, style: { ...r.style, fontSize: bump(r.style.fontSize, fontSizeDelta) } } : r
    );
    const grown = normalizeTextProps({ ...props, fontSize: bump(props.fontSize || 24, fontSizeDelta) } as T, runs);
    return Object.keys(keys).length ? styleAll(grown, keys) : grown;
  }
  const boxPatch: Record<string, unknown> = {};
  const runPatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(keys)) {
    if (BOX_KEYS.includes(k as TextStyleKey)) boxPatch[k] = v;
    else runPatch[k] = v;
  }
  const runs = getRuns(props).map((r) => {
    if (!r.style) return r;
    const style = { ...r.style };
    for (const k of Object.keys(boxPatch)) delete style[k as TextStyleKey];
    return { text: r.text, style };
  });
  let next = normalizeTextProps({ ...props, ...boxPatch } as T, runs);
  if (Object.keys(runPatch).length) next = styleRange(next, 0, (next.text || "").length, runPatch);
  return next;
}

export type MixedValue<V> = V | "mixed";
export type RangeStyle = { [K in TextStyleKey]: MixedValue<ResolvedTextStyle[K]> };

/**
 * The style of characters [start, end): a value when they all share it, "mixed" otherwise.
 * A collapsed range reports the character before the caret (what typing continues with).
 */
export function rangeStyle(props: Partial<TextProperties>, start = 0, end = (props.text || "").length): RangeStyle {
  const runs = getRuns(props);
  const text = props.text || "";
  let a = Math.max(0, Math.min(start, end));
  let b = Math.min(text.length, Math.max(start, end));
  if (a === b) {
    if (text.length === 0) return { ...boxStyle(props) };
    a = Math.max(0, a - 1);
    b = a + 1;
  }
  const out: Partial<Record<TextStyleKey, unknown>> = {};
  let pos = 0;
  for (const run of runs) {
    const rs = pos;
    const re = pos + run.text.length;
    pos = re;
    if (re <= a || rs >= b) continue;
    const resolved = resolveStyle(props, run.style);
    for (const k of TEXT_STYLE_KEYS) {
      if (!(k in out)) out[k] = resolved[k];
      else if (out[k] !== resolved[k]) out[k] = "mixed";
    }
  }
  if (Object.keys(out).length === 0) return { ...boxStyle(props) };
  return out as RangeStyle;
}

/**
 * New plain text for a styled box (e.g. typed in the inspector): unchanged start and end
 * keep their styles, new characters take the style of the text they replace or follow.
 */
export function replaceTextKeepingStyles<T extends Partial<TextProperties>>(props: T, nextText: string): T {
  const prev = props.text || "";
  if (prev === nextText) return props;
  if (!props.runs) return { ...props, text: nextText };
  let p = 0;
  while (p < prev.length && p < nextText.length && prev[p] === nextText[p]) p++;
  let s = 0;
  while (s < prev.length - p && s < nextText.length - p && prev[prev.length - 1 - s] === nextText[nextText.length - 1 - s]) s++;
  const runs = getRuns(props);
  const removeEnd = prev.length - s;
  const inserted = nextText.slice(p, nextText.length - s);
  // Style for inserted text: the first replaced character, else the one before
  const styleSource = rangeStyleRun(runs, p < removeEnd ? p : Math.max(0, p - 1));
  const i = splitAt(runs, p);
  const j = splitAt(runs, removeEnd);
  runs.splice(i, j - i, ...(inserted ? [{ text: inserted, ...(styleSource ? { style: { ...styleSource } } : {}) }] : []));
  return normalizeTextProps({ ...props, text: nextText }, runs);
}

function rangeStyleRun(runs: TextRun[], at: number): TextRunStyle | undefined {
  let pos = 0;
  for (const run of runs) {
    if (at < pos + run.text.length) return run.style;
    pos += run.text.length;
  }
  return runs[runs.length - 1]?.style;
}

// ------------------------------------------
// Layout (line wrapping with mixed sizes)
// ------------------------------------------

export interface TextFragment {
  text: string;
  style: ResolvedTextStyle;
  x: number;
  width: number;
}

export interface TextLine {
  /** Top of the line box */
  y: number;
  height: number;
  /** Alphabetic baseline */
  baseline: number;
  width: number;
  fragments: TextFragment[];
}

export interface TextLayout {
  lines: TextLine[];
  height: number;
}

export interface TextMeasurer {
  /** Advance width of `text` drawn in `style` (scripts already scaled by the caller's font) */
  width(text: string, style: ResolvedTextStyle): number;
  /** Font ascent / descent for `size` px of the style's font */
  metrics(style: ResolvedTextStyle): { ascent: number; descent: number };
}

/** Size a fragment is drawn at (super/subscripts are smaller) */
export const drawnSize = (s: ResolvedTextStyle) => (s.script === "normal" ? s.fontSize : s.fontSize * SCRIPT_SCALE);

/** Vertical shift of a super/subscript from the baseline */
export const scriptShift = (s: ResolvedTextStyle) =>
  s.script === "super" ? -s.fontSize * 0.38 : s.script === "sub" ? s.fontSize * 0.14 : 0;

/** CSS / canvas font shorthand for a style */
export function cssFont(s: ResolvedTextStyle, size = drawnSize(s)): string {
  const weight = s.fontWeight === "bold" ? "bold" : s.fontWeight === "normal" ? "normal" : s.fontWeight;
  return `${s.fontStyle === "italic" ? "italic " : ""}${weight} ${size}px ${s.fontFamily}`;
}

interface Atom {
  kind: "word" | "space" | "newline";
  parts: Array<{ text: string; style: ResolvedTextStyle }>;
  width: number;
  /** Style of a newline (sets the height of an empty line) */
  style?: ResolvedTextStyle;
}

/** Wraps styled text into lines `width` wide (word wrap; long words break by character) */
export function layoutRichText(props: Partial<TextProperties>, width: number, measure: TextMeasurer): TextLayout {
  const lineHeight = props.lineHeight || 1.2;
  const align = props.align || "left";
  const runs = getRuns(props);
  const base = boxStyle(props);

  // 1. Atoms: words may span several styles ("H" + "₂" + "O" stays one unbreakable word)
  const atoms: Atom[] = [];
  const push = (kind: Atom["kind"], text: string, style: ResolvedTextStyle) => {
    const last = atoms[atoms.length - 1];
    if (kind === "newline") {
      atoms.push({ kind, parts: [], width: 0, style });
      return;
    }
    const w = measure.width(text, style);
    if (last && last.kind === kind) {
      const lp = last.parts[last.parts.length - 1]!;
      if (lp.style === style) lp.text += text;
      else last.parts.push({ text, style });
      last.width += w;
    } else {
      atoms.push({ kind, parts: [{ text, style }], width: w });
    }
  };
  for (const run of runs) {
    const style = resolveStyle(props, run.style);
    for (const piece of run.text.split(/(\n|[^\S\n]+)/)) {
      if (!piece) continue;
      if (piece === "\n") push("newline", piece, style);
      else if (/^[^\S\n]+$/.test(piece)) push("space", piece, style);
      else push("word", piece, style);
    }
  }

  // 2. Lines
  type Draft = { atoms: Atom[]; newlineStyle?: ResolvedTextStyle };
  const drafts: Draft[] = [{ atoms: [] }];
  const cur = () => drafts[drafts.length - 1]!;
  const lineWidth = (d: Draft) => d.atoms.reduce((sum, a) => sum + a.width, 0);
  const hasWord = (d: Draft) => d.atoms.some((a) => a.kind === "word");
  for (const atom of atoms) {
    if (atom.kind === "newline") {
      cur().newlineStyle = atom.style;
      drafts.push({ atoms: [] });
      continue;
    }
    if (atom.kind === "space") {
      cur().atoms.push(atom);
      continue;
    }
    if (hasWord(cur()) && lineWidth(cur()) + atom.width > width) {
      drafts.push({ atoms: [] });
    }
    if (atom.width > width && width > 0) {
      // Break an over-long word by characters
      let piece: Atom = { kind: "word", parts: [], width: 0 };
      for (const part of atom.parts) {
        for (const ch of Array.from(part.text)) {
          const w = measure.width(ch, part.style);
          if (piece.width + w > width - lineWidth(cur()) && (piece.width > 0 || hasWord(cur()))) {
            if (piece.parts.length) cur().atoms.push(piece);
            drafts.push({ atoms: [] });
            piece = { kind: "word", parts: [], width: 0 };
          }
          const lp = piece.parts[piece.parts.length - 1];
          if (lp && lp.style === part.style) lp.text += ch;
          else piece.parts.push({ text: ch, style: part.style });
          piece.width += w;
        }
      }
      if (piece.parts.length) cur().atoms.push(piece);
      continue;
    }
    cur().atoms.push(atom);
  }

  // 3. Positions
  const lines: TextLine[] = [];
  let y = 0;
  let prevStyle = base;
  for (const d of drafts) {
    // Trailing spaces do not count for alignment
    const atomsTrim = [...d.atoms];
    while (atomsTrim.length && atomsTrim[atomsTrim.length - 1]!.kind === "space") atomsTrim.pop();
    const parts = atomsTrim.flatMap((a) => a.parts);
    const sizing = parts.length ? parts.map((p) => p.style) : [d.newlineStyle || prevStyle];
    if (parts.length) prevStyle = parts[parts.length - 1]!.style;
    // The largest full-size font sets the line (scripts never grow a line)
    let big = sizing[0]!;
    for (const s of sizing) if (s.fontSize > big.fontSize) big = s;
    const height = big.fontSize * lineHeight;
    const { ascent, descent } = measure.metrics({ ...big, script: "normal" });
    const baseline = y + height / 2 + (ascent - descent) / 2;
    const w = atomsTrim.reduce((sum, a) => sum + a.width, 0);
    let x = align === "center" ? (width - w) / 2 : align === "right" ? width - w : 0;
    const fragments: TextFragment[] = [];
    for (const p of parts) {
      const fw = measure.width(p.text, p.style);
      fragments.push({ text: p.text, style: p.style, x, width: fw });
      x += fw;
    }
    lines.push({ y, height, baseline, width: w, fragments });
    y += height;
  }
  return { lines, height: y };
}

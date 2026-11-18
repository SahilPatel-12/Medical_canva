// ==========================================
// Rich text <-> DOM for the in-place text editor (contentEditable).
// Each run becomes a <span data-style='{…}'> holding its own style; line breaks are
// "\n" characters (the editor uses white-space: pre-wrap), so the editor's text is
// exactly the runs' text and selections map 1:1 to character offsets.
// ==========================================

import type { TextProperties, TextRun, TextRunStyle } from "@design-platform/types";
import { getRuns, resolveStyle, drawnSize, scriptShift, type ResolvedTextStyle } from "./richText";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escapeHtml(s).replace(/'/g, "&#39;").replace(/"/g, "&quot;");

/** Inline CSS for a resolved style (in page pixels: the editor is scaled as a whole) */
export function cssForStyle(s: ResolvedTextStyle): string {
  const deco = [s.underline ? "underline" : "", s.strike ? "line-through" : ""].filter(Boolean).join(" ") || "none";
  const parts = [
    `font-family:${s.fontFamily.replace(/"/g, "'")}`,
    `font-size:${drawnSize(s)}px`,
    `font-weight:${s.fontWeight}`,
    `font-style:${s.fontStyle}`,
    `color:${s.fill}`,
    `text-decoration:${deco}`,
  ];
  if (s.script !== "normal") parts.push("position:relative", `top:${scriptShift(s)}px`, "line-height:0");
  return parts.join(";");
}

/** HTML for the editor: one span per run, plus a filler <br> so a trailing newline shows */
export function runsToHtml(props: Partial<TextProperties>): string {
  const runs = getRuns(props);
  let html = "";
  for (const run of runs) {
    if (!run.text) continue;
    const resolved = resolveStyle(props, run.style);
    const data = run.style && Object.keys(run.style).length ? ` data-style='${escapeAttr(JSON.stringify(run.style))}'` : "";
    html += `<span${data} style="${escapeAttr(cssForStyle(resolved))}">${escapeHtml(run.text)}</span>`;
  }
  const text = props.text || "";
  if (!text || text.endsWith("\n")) html += `<br data-filler="1">`;
  return html;
}

function styleOfNode(node: Node, root: HTMLElement, cache: Map<Element, TextRunStyle | undefined>): TextRunStyle | undefined {
  let el: Element | null = node.nodeType === 1 ? (node as Element) : node.parentElement;
  while (el && el !== root) {
    if (el.hasAttribute("data-style")) {
      if (!cache.has(el)) {
        try {
          cache.set(el, JSON.parse(el.getAttribute("data-style") || "{}"));
        } catch {
          cache.set(el, undefined);
        }
      }
      return cache.get(el);
    }
    el = el.parentElement;
  }
  return undefined;
}

/** Reads the editor back into runs (text nodes in document order; stray <br>/<div> become "\n") */
export function domToRuns(root: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  const cache = new Map<Element, TextRunStyle | undefined>();
  const add = (text: string, style: TextRunStyle | undefined) => {
    if (!text) return;
    const last = runs[runs.length - 1];
    if (last && JSON.stringify(last.style || null) === JSON.stringify(style || null)) last.text += text;
    else runs.push(style ? { text, style: { ...style } } : { text });
  };
  const walk = (node: Node, first: boolean) => {
    if (node.nodeType === 3) {
      add((node as Text).data, styleOfNode(node, root, cache));
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      if (!el.hasAttribute("data-filler")) add("\n", styleOfNode(el, root, cache));
      return;
    }
    const block = el !== root && (el.tagName === "DIV" || el.tagName === "P");
    if (block && !first) add("\n", styleOfNode(el, root, cache));
    let i = 0;
    for (const child of Array.from(el.childNodes)) walk(child, first && i++ === 0);
  };
  walk(root, true);
  return runs;
}

/** True when the browser added structure the editor does not use (<br>, <div>, <font>…) */
export function needsNormalizing(root: HTMLElement): boolean {
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (el.tagName === "SPAN") continue;
    if (el.tagName === "BR" && el.hasAttribute("data-filler") && el === root.lastChild) continue;
    return true;
  }
  return false;
}

/** Character offset of a DOM boundary inside the editor */
function boundaryOffset(root: HTMLElement, container: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(container, offset);
  } catch {
    return 0;
  }
  return range.toString().length;
}

export function getSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  const a = boundaryOffset(root, r.startContainer, r.startOffset);
  const b = boundaryOffset(root, r.endContainer, r.endOffset);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** DOM position (text node + offset) of a character offset */
function locate(root: HTMLElement, offset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let last: Text | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (remaining <= n.data.length) {
      // Prefer the end of a node over the start of the next one, unless that is a new line
      if (remaining === n.data.length && n.data.endsWith("\n")) {
        const next = walker.nextNode() as Text | null;
        if (next) return { node: next, offset: 0 };
      }
      return { node: n, offset: remaining };
    }
    remaining -= n.data.length;
    last = n;
  }
  if (last) return { node: last, offset: last.data.length };
  return { node: root, offset: root.childNodes.length };
}

export function setSelectionOffsets(root: HTMLElement, start: number, end: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const a = locate(root, start);
  const b = start === end ? a : locate(root, end);
  const range = document.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Inserts plain text at the caret (used for Enter and paste so the DOM stays simple) */
export function insertPlainText(root: HTMLElement, text: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const offsets = getSelectionOffsets(root);
  const range = sel.getRangeAt(0);
  range.deleteContents();
  let node = range.startContainer;
  let at = range.startOffset;
  if (node.nodeType !== 3) {
    // Caret between elements: write into the text node before it, or start a new one
    const before = node.childNodes[at - 1];
    const lastText = before && (before.nodeType === 3 ? before : before.lastChild && before.lastChild.nodeType === 3 ? before.lastChild : null);
    if (lastText) {
      node = lastText;
      at = (lastText as Text).data.length;
    } else {
      const t = document.createTextNode("");
      const ref = node.childNodes[at] || null;
      if (ref && (ref as Element).tagName === "BR") node.insertBefore(t, ref);
      else node.insertBefore(t, ref);
      node = t;
      at = 0;
    }
  }
  (node as Text).insertData(at, text);
  // A trailing newline needs a filler <br> to show as an empty line
  const filler = root.querySelector("br[data-filler]");
  const full = root.textContent || "";
  if (full.endsWith("\n") && !filler) root.appendChild(Object.assign(document.createElement("br"), {})).setAttribute("data-filler", "1");
  const caret = (offsets ? offsets.start : 0) + text.length;
  setSelectionOffsets(root, caret, caret);
}

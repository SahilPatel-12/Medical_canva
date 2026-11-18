// ==========================================
// Konva text node that can draw mixed styles.
// Plain text keeps Konva's own rendering; a box with styled parts is laid out by
// layoutRichText and drawn fragment by fragment. Being a Konva.Text, it keeps working
// with everything that handles text nodes (resizing, editing, auto height).
// ==========================================

import Konva from "konva";
import type { SceneContext } from "konva/lib/Context";
import type { TextProperties } from "@design-platform/types";
import {
  cssFont,
  drawnSize,
  hasRichStyles,
  layoutRichText,
  scriptShift,
  type ResolvedTextStyle,
  type TextLayout,
  type TextMeasurer,
} from "./richText";

let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();
const metricsCache = new Map<string, { ascent: number; descent: number }>();

function ctx(): CanvasRenderingContext2D | null {
  if (measureCtx || typeof document === "undefined") return measureCtx;
  measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

/** Canvas text measurement (cached per font + text) */
export const canvasMeasurer: TextMeasurer = {
  width(text: string, style: ResolvedTextStyle) {
    const font = cssFont(style);
    const key = `${font}\u0000${text}`;
    const hit = widthCache.get(key);
    if (hit !== undefined) return hit;
    const c = ctx();
    let w = text.length * drawnSize(style) * 0.5;
    if (c) {
      c.font = font;
      w = c.measureText(text).width;
    }
    if (widthCache.size > 20000) widthCache.clear();
    widthCache.set(key, w);
    return w;
  },
  metrics(style: ResolvedTextStyle) {
    const font = cssFont(style);
    const hit = metricsCache.get(font);
    if (hit) return hit;
    const c = ctx();
    let m = { ascent: style.fontSize * 0.8, descent: style.fontSize * 0.2 };
    if (c) {
      c.font = font;
      const tm = c.measureText("Hgy");
      const a = tm.fontBoundingBoxAscent ?? tm.actualBoundingBoxAscent;
      const d = tm.fontBoundingBoxDescent ?? tm.actualBoundingBoxDescent;
      if (Number.isFinite(a) && Number.isFinite(d)) m = { ascent: a, descent: d };
    }
    metricsCache.set(font, m);
    return m;
  },
};

export class RichTextNode extends Konva.Text {
  private layoutCache: { key: string; layout: TextLayout } | null = null;

  /** Text box properties when it has mixed styles, else null (plain Konva text) */
  richProps(): TextProperties | null {
    const p = this.getAttr("richProps") as TextProperties | undefined;
    return p && hasRichStyles(p) ? p : null;
  }

  richLayout(): TextLayout | null {
    const p = this.richProps();
    if (!p) return null;
    const width = this.width();
    const key = `${width}\u0000${JSON.stringify(p)}`;
    if (this.layoutCache?.key !== key) this.layoutCache = { key, layout: layoutRichText(p, width, canvasMeasurer) };
    return this.layoutCache.layout;
  }

  getHeight(): number {
    const layout = this.richLayout();
    if (!layout) return super.getHeight();
    const h = this.attrs.height;
    return h === undefined || h === "auto" ? layout.height : h;
  }

  getSelfRect() {
    if (!this.richProps()) return super.getSelfRect();
    return { x: 0, y: 0, width: this.width(), height: this.getHeight() };
  }

  _getSelfRectForDrawing() {
    const layout = this.richLayout();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!layout) return (Konva.Text.prototype as any)._getSelfRectForDrawing.call(this);
    let pad = 0;
    for (const line of layout.lines) for (const f of line.fragments) pad = Math.max(pad, f.style.fontSize);
    return { x: -pad, y: -pad, width: this.width() + pad * 2, height: this.getHeight() + pad * 2 };
  }

  _sceneFunc(context: SceneContext) {
    const layout = this.richLayout();
    if (!layout) {
      super._sceneFunc(context);
      return;
    }
    const native = context._context as CanvasRenderingContext2D;
    native.save();
    native.textBaseline = "alphabetic";
    native.textAlign = "left";
    for (const line of layout.lines) {
      for (const f of line.fragments) {
        const s = f.style;
        const y = line.baseline + scriptShift(s);
        native.font = cssFont(s);
        native.fillStyle = s.fill;
        native.fillText(f.text, f.x, y);
        if (s.underline || s.strike) {
          const size = drawnSize(s);
          const thick = Math.max(1, size / 14);
          if (s.underline) native.fillRect(f.x, y + size * 0.12, f.width, thick);
          if (s.strike) native.fillRect(f.x, y - size * 0.3, f.width, thick);
        }
      }
    }
    native.restore();
  }
}

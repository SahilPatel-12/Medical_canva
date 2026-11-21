import type { DesignDocument } from "@design-platform/types";
import { CanvasEngine } from "../canvas/CanvasEngine";
import { buildImagePdf, deflate, PdfImagePage, PX_TO_PT, rgbaToRgb } from "./pdfWriter";

/** Largest canvas the strictest browsers allow (Safari: 16.7M pixels; all: 16384px per side) */
const MAX_CANVAS_PIXELS = 16_777_216;
const MAX_CANVAS_SIDE = 16_384;

export interface ExportPdfOptions {
  /** Output pixels per design pixel (default 2 — sharp for print and zooming). Lowered automatically for huge pages. */
  pixelRatio?: number;
  /** Page indexes to include (default: every page, in order) */
  pageIndexes?: number[];
  /** Called after each page is drawn */
  onProgress?: (done: number, total: number) => void;
}

/** Highest ratio ≤ `wanted` whose canvas fits the browser limits for a page of this size */
export function safePixelRatio(width: number, height: number, wanted: number): number {
  const byArea = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height));
  const bySide = MAX_CANVAS_SIDE / Math.max(1, width, height);
  return Math.max(0.1, Math.min(wanted, byArea, bySide));
}

/** "My design" → "My design.pdf", without characters file systems reject */
export function pdfFileName(name: string | undefined): string {
  const base = (name || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  return `${base || "design"}.pdf`;
}

/**
 * Renders the design's pages off screen (the user's canvas and view are untouched) and returns
 * them as a PDF, one design page per PDF page at the design's size.
 * Browser only.
 */
export async function exportDesignToPdf(doc: DesignDocument, options: ExportPdfOptions = {}): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("PDF export is only available in the browser");

  const allIndexes = (doc.pages || []).map((_, i) => i);
  const indexes = (options.pageIndexes ?? allIndexes).filter((i) => i >= 0 && i < allIndexes.length);
  if (indexes.length === 0) throw new Error("This design has no pages to export");

  const ratio = safePixelRatio(doc.width, doc.height, options.pixelRatio ?? 2);

  // Hidden host for a throwaway read-only engine. It needs to be in the DOM for Konva, but
  // exports draw onto their own canvases, so it can stay tiny and out of sight.
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "16px",
    height: "16px",
    overflow: "hidden",
    pointerEvents: "none",
    visibility: "hidden",
  });
  document.body.appendChild(host);

  const noop = () => {};
  const engine = new CanvasEngine(host, {
    onSelect: noop,
    onElementChange: noop,
    onDropAsset: noop,
    isReadOnly: true,
  });

  try {
    const pdfPages: PdfImagePage[] = [];
    for (let n = 0; n < indexes.length; n++) {
      const pageIndex = indexes[n]!;
      await engine.renderDocument(doc, pageIndex);
      await engine.waitForRender();

      const canvas = engine.exportPageCanvas(ratio);
      if (!canvas) throw new Error(`Page ${pageIndex + 1} could not be drawn`);

      let pixels: ImageData;
      try {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2D context");
        pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (err) {
        // A cross-origin image without CORS headers "taints" the canvas and blocks reading it
        throw new Error(
          `Page ${pageIndex + 1} contains an image that the browser does not allow to be exported. ` +
            `(${(err as Error)?.message || err})`
        );
      } finally {
        // Free the large backing store right away (matters for long documents)
        canvas.width = 0;
        canvas.height = 0;
      }

      pdfPages.push({
        widthPt: doc.width * PX_TO_PT,
        heightPt: doc.height * PX_TO_PT,
        imageWidth: pixels.width,
        imageHeight: pixels.height,
        flateRgb: await deflate(rgbaToRgb(pixels.data)),
      });
      options.onProgress?.(n + 1, indexes.length);
    }

    const bytes = buildImagePdf(pdfPages, { title: doc.name });
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  } finally {
    engine.destroy();
    host.remove();
  }
}

/** Saves a Blob as a file through the browser's download flow */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke later: some browsers start reading the blob after click() returns
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

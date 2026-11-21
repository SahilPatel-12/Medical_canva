/**
 * Minimal PDF 1.4 writer: one full-bleed RGB image per page.
 *
 * Images are stored losslessly (zlib/Flate-compressed 8-bit RGB), which keeps text and line
 * art crisp and compresses flat illustration artwork very well. No external dependencies, so
 * it runs in the browser and in Node (tests).
 */

/** CSS pixels → PDF points (1pt = 1/72in, 1px = 1/96in) */
export const PX_TO_PT = 72 / 96;

export interface PdfImagePage {
  /** Page size in PDF points */
  widthPt: number;
  heightPt: number;
  /** Image size in pixels */
  imageWidth: number;
  imageHeight: number;
  /** zlib-compressed RGB bytes (imageWidth * imageHeight * 3 before compression) */
  flateRgb: Uint8Array;
}

export interface PdfMetadata {
  title?: string;
  /** Defaults to now */
  creationDate?: Date;
}

const encoder = new TextEncoder();

/** Number without exponent notation, at most 3 decimals */
function num(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Invalid PDF number: ${n}`);
  return String(Math.round(n * 1000) / 1000);
}

/** Text string as UTF-16BE hex with BOM (safe for any characters, no escaping needed) */
function pdfTextString(text: string): string {
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) {
    hex += text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `(D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z)`
  );
}

/** Builds a PDF file with one image per page, each image stretched to fill its page */
export function buildImagePdf(pages: PdfImagePage[], meta: PdfMetadata = {}): Uint8Array {
  if (pages.length === 0) throw new Error("A PDF needs at least one page");

  const chunks: Uint8Array[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };

  // Object numbers: 1 catalog, 2 page tree, 3 info, then 3 per page (page, content, image)
  const pageObj = (i: number) => 4 + i * 3;
  const objectCount = 3 + pages.length * 3;
  const offsets: number[] = new Array(objectCount + 1).fill(0);
  const beginObj = (n: number) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
  };

  // Header; the binary comment marks the file as binary for transfer tools
  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  beginObj(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  beginObj(2);
  const kids = pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ");
  push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  beginObj(3);
  const info = [`/Producer ${pdfTextString("Design Platform")}`, `/CreationDate ${pdfDate(meta.creationDate ?? new Date())}`];
  if (meta.title) info.unshift(`/Title ${pdfTextString(meta.title)}`);
  push(`<< ${info.join(" ")} >>\nendobj\n`);

  pages.forEach((page, i) => {
    const w = num(page.widthPt);
    const h = num(page.heightPt);
    const pageN = pageObj(i);
    const contentN = pageN + 1;
    const imageN = pageN + 2;

    beginObj(pageN);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
        `/Resources << /XObject << /Im0 ${imageN} 0 R >> >> /Contents ${contentN} 0 R >>\nendobj\n`
    );

    const content = encoder.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`);
    beginObj(contentN);
    push(`<< /Length ${content.length} >>\nstream\n`);
    push(content);
    push("endstream\nendobj\n");

    beginObj(imageN);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.imageWidth} /Height ${page.imageHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${page.flateRgb.length} >>\nstream\n`
    );
    push(page.flateRgb);
    push("\nendstream\nendobj\n");
  });

  // Cross-reference table: every entry is exactly 20 bytes
  const xrefOffset = length;
  let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= objectCount; n++) {
    xref += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/**
 * RGBA pixels → RGB, compositing any transparency over white (PDF pages are white paper).
 */
export function rgbaToRgb(rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
  const pixels = rgba.length / 4;
  const rgb = new Uint8Array(pixels * 3);
  for (let p = 0, s = 0, d = 0; p < pixels; p++, s += 4, d += 3) {
    const a = rgba[s + 3]!;
    if (a === 255) {
      rgb[d] = rgba[s]!;
      rgb[d + 1] = rgba[s + 1]!;
      rgb[d + 2] = rgba[s + 2]!;
    } else {
      // Canvas pixel data is not premultiplied: out = c * a + 255 * (1 - a)
      const inv = 255 - a;
      rgb[d] = Math.round((rgba[s]! * a + 255 * inv) / 255);
      rgb[d + 1] = Math.round((rgba[s + 1]! * a + 255 * inv) / 255);
      rgb[d + 2] = Math.round((rgba[s + 2]! * a + 255 * inv) / 255);
    }
  }
  return rgb;
}

/** zlib-compresses bytes (the format PDF's FlateDecode expects) using the platform's CompressionStream */
export async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    throw new Error("This browser cannot create PDFs (CompressionStream is not supported).");
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

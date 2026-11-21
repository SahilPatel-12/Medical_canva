import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { buildImagePdf, deflate, rgbaToRgb, PX_TO_PT } from "../src/export/pdfWriter";
import { pdfFileName, safePixelRatio } from "../src/export/exportPdf";

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

async function makePage(w: number, h: number, rgb: [number, number, number]) {
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([...rgb, 255], i * 4);
  return {
    widthPt: 800 * PX_TO_PT,
    heightPt: 600 * PX_TO_PT,
    imageWidth: w,
    imageHeight: h,
    flateRgb: await deflate(rgbaToRgb(rgba)),
  };
}

test("rgbaToRgb drops alpha and composites transparency over white", () => {
  const rgb = rgbaToRgb(new Uint8Array([10, 20, 30, 255, 0, 0, 0, 0, 0, 0, 0, 128]));
  assert.deepEqual([...rgb], [10, 20, 30, 255, 255, 255, 127, 127, 127]);
});

test("deflate produces zlib data (what FlateDecode expects)", async () => {
  const data = new Uint8Array(1000).map((_, i) => i % 7);
  assert.deepEqual(new Uint8Array(inflateSync(await deflate(data))), data);
});

test("buildImagePdf writes one page per image with a valid cross-reference table", async () => {
  const pdf = buildImagePdf([await makePage(4, 3, [255, 0, 0]), await makePage(4, 3, [0, 0, 255])], {
    title: "Cell biology — überblick",
    creationDate: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)),
  });
  const text = latin1(pdf);

  assert.ok(text.startsWith("%PDF-1.4\n"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  assert.match(text, /\/Type \/Pages \/Kids \[4 0 R 7 0 R\] \/Count 2/);
  assert.equal(text.match(/\/Type \/Page /g)?.length, 2);
  // 800x600 px design → 600x450 pt pages
  assert.equal(text.match(/\/MediaBox \[0 0 600 450\]/g)?.length, 2);
  assert.match(text, /\/CreationDate \(D:20260102030405Z\)/);

  // startxref points at the xref table, and every entry points at its "n 0 obj"
  const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);
  assert.ok(text.startsWith("xref\n", startxref));
  const [, first, count] = /^xref\n(\d+) (\d+)\n/.exec(text.slice(startxref))!;
  assert.equal(Number(first), 0);
  const entriesStart = startxref + `xref\n0 ${count}\n`.length;
  for (let n = 1; n < Number(count); n++) {
    const entry = text.slice(entriesStart + n * 20, entriesStart + (n + 1) * 20);
    assert.match(entry, /^\d{10} 00000 n \n$/);
    assert.ok(text.startsWith(`${n} 0 obj\n`, Number(entry.slice(0, 10))), `object ${n} offset`);
  }

  // Stream /Length values match the bytes between "stream\n" and "endstream"
  const streamRe = /\/Length (\d+) >>\nstream\n/g;
  let m: RegExpExecArray | null;
  let streams = 0;
  while ((m = streamRe.exec(text))) {
    const start = m.index + m[0].length;
    const end = start + Number(m[1]);
    assert.ok(/^\n?endstream/.test(text.slice(end, end + 10)), "stream length");
    streams++;
  }
  assert.equal(streams, 4);

  // Image data round-trips to the page colors
  const firstImage = /\/Width 4 \/Height 3 [^>]*\/Length (\d+) >>\nstream\n/.exec(text)!;
  const imgStart = firstImage.index + firstImage[0].length;
  const pixels = inflateSync(pdf.subarray(imgStart, imgStart + Number(firstImage[1])));
  assert.equal(pixels.length, 4 * 3 * 3);
  assert.deepEqual([...pixels.subarray(0, 3)], [255, 0, 0]);
});

test("buildImagePdf rejects an empty page list", () => {
  assert.throws(() => buildImagePdf([]));
});

test("safePixelRatio keeps canvases within browser limits", () => {
  assert.equal(safePixelRatio(1920, 1080, 2), 2);
  const r = safePixelRatio(6000, 6000, 2);
  assert.ok(6000 * r * 6000 * r <= 16_777_216);
  assert.ok(20000 * safePixelRatio(20000, 100, 2) <= 16_384);
});

test("pdfFileName strips characters file systems reject", () => {
  assert.equal(pdfFileName("Cell: mitosis / stages"), "Cell mitosis stages.pdf");
  assert.equal(pdfFileName(""), "design.pdf");
  assert.equal(pdfFileName(undefined), "design.pdf");
  assert.equal(pdfFileName("..."), "design.pdf");
});

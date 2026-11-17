import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  validateFileSignatureAndFormat,
  validateCanonicalTaxonomy,
  buildAssetStoragePath,
  subcategoryFolder,
  MAX_FILE_SIZE,
} from "../app/api/assets/validation.js";

describe("Admin Asset Pipeline & Validation (Phase 2 & Phase 5)", () => {
  describe("File Format Signature & Magic Byte Validation", () => {
    test("accepts valid PNG with PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)", () => {
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      const res = validateFileSignatureAndFormat(pngHeader, "diagram.png", "image/png");
      assert.equal(res.valid, true);
      assert.equal(res.format, "png");
      assert.equal(res.mimeType, "image/png");
      assert.ok(res.contentHash);
    });

    test("accepts valid JPEG with JPEG magic bytes (FF D8 FF)", () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const res = validateFileSignatureAndFormat(jpegHeader, "sample.jpg", "image/jpeg");
      assert.equal(res.valid, true);
      assert.equal(res.format, "jpeg");
      assert.equal(res.mimeType, "image/jpeg");
      assert.ok(res.contentHash);
    });

    test("accepts valid WebP with RIFF....WEBP magic bytes", () => {
      const webpHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x20, 0x00, 0x00, 0x00, // length
        0x57, 0x45, 0x42, 0x50, // WEBP
        0x56, 0x50, 0x38, 0x20, // VP8
      ]);
      const res = validateFileSignatureAndFormat(webpHeader, "photo.webp", "image/webp");
      assert.equal(res.valid, true);
      assert.equal(res.format, "webp");
      assert.equal(res.mimeType, "image/webp");
      assert.ok(res.contentHash);
    });

    test("accepts valid SVG markup", () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>',
        "utf-8"
      );
      const res = validateFileSignatureAndFormat(svg, "cell.svg", "image/svg+xml");
      assert.equal(res.valid, true);
      assert.equal(res.format, "svg");
      assert.equal(res.mimeType, "image/svg+xml");
      assert.ok(res.svgContent?.includes("<circle"));
      assert.ok(res.contentHash);
    });

    test("rejects unapproved file formats (e.g. PDF or executable)", () => {
      const pdf = Buffer.from("%PDF-1.4 ... binary data", "utf-8");
      const res = validateFileSignatureAndFormat(pdf, "document.pdf", "application/pdf");
      assert.equal(res.valid, false);
      assert.ok(res.error?.includes("Unsupported file format"));
    });

    test("rejects spoofed extension (e.g. text file renamed to .png)", () => {
      const fakePng = Buffer.from("this is just plain text masquerading as png", "utf-8");
      const res = validateFileSignatureAndFormat(fakePng, "spoofed.png", "image/png");
      assert.equal(res.valid, false);
    });

    test("rejects files exceeding 25 MB size limit", () => {
      // Create small buffer simulation beyond MAX_FILE_SIZE
      const oversizedBuffer = {
        length: MAX_FILE_SIZE + 1024,
      } as unknown as Buffer;

      const res = validateFileSignatureAndFormat(oversizedBuffer, "huge_file.png", "image/png");
      assert.equal(res.valid, false);
      assert.ok(res.error?.includes("exceeds the 25 MB limit"));
    });
  });

  describe("Server-Side SVG Security Sanitization", () => {
    test("strips script tags, inline event handlers, and javascript protocols", () => {
      const maliciousSvg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg">
          <script>alert('pwned')</script>
          <circle cx="10" cy="10" r="5" onload="fetch('https://evil.com')" onclick="eval('bad')"/>
          <a href="javascript:void(0)"><text>Click</text></a>
          <foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>evil()</script></body></foreignObject>
        </svg>`,
        "utf-8"
      );

      const res = validateFileSignatureAndFormat(maliciousSvg, "icon.svg", "image/svg+xml");
      assert.equal(res.valid, true);
      assert.ok(res.svgContent);
      assert.equal(res.svgContent.includes("<script"), false);
      assert.equal(res.svgContent.includes("onload="), false);
      assert.equal(res.svgContent.includes("onclick="), false);
      assert.equal(res.svgContent.includes("javascript:"), false);
      assert.equal(res.svgContent.includes("<foreignObject"), false);
    });

    test("rejects SVG payload that consists solely of malicious script markup", () => {
      const onlyScript = Buffer.from("<script>evilCode()</script>", "utf-8");
      const res = validateFileSignatureAndFormat(onlyScript, "evil.svg", "image/svg+xml");
      assert.equal(res.valid, false);
    });
  });

  describe("Canonical Taxonomy Assignment & Validation", () => {
    test("validates canonical category and subcategory successfully", () => {
      const res = validateCanonicalTaxonomy("cell-types", "generic-cells");
      assert.equal(res.valid, true);
      assert.equal(res.category, "Cell Types");
      assert.equal(res.categorySlug, "cell-types");
      assert.equal(res.subcategoryId, "sub-generic-cells");
      assert.equal(res.subcategorySlug, "generic-cells");
    });

    test("rejects invalid non-canonical category", () => {
      const res = validateCanonicalTaxonomy("fake-category-xyz");
      assert.equal(res.valid, false);
      assert.ok(res.error?.includes("Invalid category"));
    });

    test("rejects subcategory that does not belong to the selected category", () => {
      // 'antibodies' belongs to 'proteins', not 'cell-types'
      const res = validateCanonicalTaxonomy("cell-types", "antibodies");
      assert.equal(res.valid, false);
      assert.ok(res.error?.includes("does not belong to category"));
    });
  });

  describe("Stable Asset Storage Path Generation", () => {
    test("generates expected platform-assets storage path convention", () => {
      const { r2Key, sanitizedFileName } = buildAssetStoragePath(
        "cell-types",
        "sub-generic-cells",
        "asset-12345",
        "Neuron Cell (High-Res)!.svg",
        1
      );

      assert.equal(sanitizedFileName, "Neuron_Cell_High-Res_.svg");
      assert.equal(
        r2Key,
        "platform-assets/cell-types/generic-cells/asset-12345/Neuron_Cell_High-Res_.svg"
      );
    });

    test("prepends version prefix on replacement uploads (v2+)", () => {
      const { r2Key } = buildAssetStoragePath(
        "proteins",
        "sub-antibodies",
        "asset-12345",
        "antibody.svg",
        2
      );

      assert.equal(
        r2Key,
        "platform-assets/proteins/antibodies/asset-12345/v2-antibody.svg"
      );
    });

    test("subcategory folders use readable slugs, even when given an id that differs from the slug", () => {
      const { r2Key } = buildAssetStoragePath("cell-types", "sub-immune-blood-cells", "a1", "t-cell.svg");
      assert.equal(r2Key, "platform-assets/cell-types/immune-and-blood-cells/a1/t-cell.svg");
      assert.equal(subcategoryFolder("cell-types", "immune-and-blood-cells"), "immune-and-blood-cells");
    });
  });
});

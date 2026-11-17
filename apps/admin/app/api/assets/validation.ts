import crypto from "crypto";
import {
  CANONICAL_TAXONOMY,
  sanitizeSvg,
} from "@design-platform/editor";

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export type SupportedFormat = "svg" | "png" | "jpeg" | "webp";

export interface FileValidationResult {
  valid: boolean;
  format?: SupportedFormat;
  mimeType?: string;
  error?: string;
  sanitizedBuffer?: Buffer;
  svgContent?: string | null;
  contentHash?: string;
}

/**
 * Validates file signature (magic bytes) to ensure file content actually
 * matches one of the approved formats (SVG, PNG, JPEG, WebP).
 */
export function validateFileSignatureAndFormat(
  buffer: Buffer,
  declaredFileName: string,
  declaredMimeType?: string
): FileValidationResult {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "File buffer is empty" };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the 25 MB limit (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`,
    };
  }

  // 1. Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    return {
      valid: true,
      format: "png",
      mimeType: "image/png",
      sanitizedBuffer: buffer,
      svgContent: null,
      contentHash: hash,
    };
  }

  // 2. Check JPEG signature: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    return {
      valid: true,
      format: "jpeg",
      mimeType: "image/jpeg",
      sanitizedBuffer: buffer,
      svgContent: null,
      contentHash: hash,
    };
  }

  // 3. Check WebP signature: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    return {
      valid: true,
      format: "webp",
      mimeType: "image/webp",
      sanitizedBuffer: buffer,
      svgContent: null,
      contentHash: hash,
    };
  }

  // 4. Check SVG: Must be UTF-8 text containing an SVG document
  const rawText = buffer.toString("utf-8");
  // Check for presence of null bytes (which indicate binary data masquerading as text)
  if (buffer.subarray(0, 1024).includes(0x00)) {
    return {
      valid: false,
      error: "File contains invalid binary data and does not match any approved format (SVG, PNG, JPEG, WebP)",
    };
  }

  const trimmed = rawText.trim();
  const isSvg =
    trimmed.includes("<svg") &&
    (trimmed.includes("</svg>") || trimmed.includes("/>")) &&
    !trimmed.startsWith("<!DOCTYPE html");

  if (isSvg) {
    // Sanitize SVG server-side
    const sanitized = sanitizeSvg(rawText)
      // Extra server-side safety checks against embedded objects
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, "")
      .replace(/<meta\b[^>]*>/gi, "")
      .replace(/<link\b[^>]*>/gi, "");

    if (!sanitized.includes("<svg")) {
      return {
        valid: false,
        error: "SVG file rejected: malicious markup stripped leaving no valid SVG element",
      };
    }

    const sanitizedBuf = Buffer.from(sanitized, "utf-8");
    const hash = crypto.createHash("sha256").update(sanitizedBuf).digest("hex");

    return {
      valid: true,
      format: "svg",
      mimeType: "image/svg+xml",
      sanitizedBuffer: sanitizedBuf,
      svgContent: sanitized,
      contentHash: hash,
    };
  }

  return {
    valid: false,
    error: `Unsupported file format. Only SVG, PNG, JPEG, and WebP are allowed. Provided file '${declaredFileName}' (${declaredMimeType || "unknown"}) failed format signature checks.`,
  };
}

export interface TaxonomyValidationResult {
  valid: boolean;
  category: string;
  categorySlug: string;
  subcategoryId: string;
  subcategorySlug: string;
  subcategoryName: string;
  error?: string;
}

/**
 * Validates selected category and subcategory against canonical 15x87 taxonomy.
 */
export function validateCanonicalTaxonomy(
  categorySlugInput?: string | null,
  subcategoryInput?: string | null
): TaxonomyValidationResult {
  if (!categorySlugInput || !categorySlugInput.trim()) {
    return {
      valid: false,
      category: "",
      categorySlug: "",
      subcategoryId: "",
      subcategorySlug: "",
      subcategoryName: "",
      error: "Main category is required. Please select one of the 15 canonical scientific categories.",
    };
  }

  const cleanCat = categorySlugInput.trim().toLowerCase();
  const matchedCat = CANONICAL_TAXONOMY.find(
    (c) =>
      c.slug === cleanCat ||
      c.id === cleanCat ||
      c.name.toLowerCase() === cleanCat ||
      c.slug === cleanCat.replace(/\s+/g, "-")
  );

  if (!matchedCat) {
    return {
      valid: false,
      category: "",
      categorySlug: "",
      subcategoryId: "",
      subcategorySlug: "",
      subcategoryName: "",
      error: `Invalid category '${categorySlugInput}'. Must match one of the canonical categories: ${CANONICAL_TAXONOMY.map((c) => c.slug).join(", ")}.`,
    };
  }

  // If subcategory provided, validate it
  if (subcategoryInput && subcategoryInput.trim()) {
    const cleanSub = subcategoryInput.trim().toLowerCase();
    const matchedSub = matchedCat.subcategories.find(
      (s) =>
        s.slug === cleanSub ||
        s.id === cleanSub ||
        s.name.toLowerCase() === cleanSub ||
        s.slug === cleanSub.replace(/\s+/g, "-")
    );

    if (matchedSub) {
      return {
        valid: true,
        category: matchedCat.name,
        categorySlug: matchedCat.slug,
        subcategoryId: matchedSub.id,
        subcategorySlug: matchedSub.slug,
        subcategoryName: matchedSub.name,
      };
    }

    return {
      valid: false,
      category: matchedCat.name,
      categorySlug: matchedCat.slug,
      subcategoryId: "",
      subcategorySlug: "",
      subcategoryName: "",
      error: `Subcategory '${subcategoryInput}' does not belong to category '${matchedCat.name}'. Allowed subcategories: ${matchedCat.subcategories.map((s) => s.slug).join(", ")}.`,
    };
  }

  // Default to first subcategory of the category if unspecified
  const defaultSub = matchedCat.subcategories[0];
  return {
    valid: true,
    category: matchedCat.name,
    categorySlug: matchedCat.slug,
    subcategoryId: defaultSub.id,
    subcategorySlug: defaultSub.slug,
    subcategoryName: defaultSub.name,
  };
}

/**
 * Folder name of a subcategory in storage: its readable slug (e.g. "epithelial-cells").
 * Accepts a slug or a subcategory id ("sub-…") and resolves ids through the taxonomy.
 */
export function subcategoryFolder(categorySlug: string, subcategoryIdOrSlug: string): string {
  const category = CANONICAL_TAXONOMY.find((c) => c.slug === categorySlug);
  const sub = category?.subcategories.find((s) => s.slug === subcategoryIdOrSlug || s.id === subcategoryIdOrSlug);
  if (sub) return sub.slug;
  return subcategoryIdOrSlug.replace(/^sub-/, "");
}

/**
 * Builds the object key for an asset:
 * platform-assets/{categorySlug}/{subcategorySlug}/{assetId}/{fileName}
 */
export function buildAssetStoragePath(
  categorySlug: string,
  subcategorySlugOrId: string,
  assetId: string,
  fileName: string,
  version: number = 1
): { r2Key: string; sanitizedFileName: string } {
  const sanitizedFileName = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_");

  const versionPrefix = version > 1 ? `v${version}-` : "";
  const folder = subcategoryFolder(categorySlug, subcategorySlugOrId);
  const r2Key = `platform-assets/${categorySlug}/${folder}/${assetId}/${versionPrefix}${sanitizedFileName}`;

  return { r2Key, sanitizedFileName };
}

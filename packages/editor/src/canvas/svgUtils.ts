/**
 * SVG Utilities for parsing, sanitizing, remote fetching, and vector color tuning
 */

import { extractColors, recolorWholeSvg, replaceSvgColors } from "./svgColors";

/**
 * Sanitizes SVG markup, stripping script tags, event handlers, and dangerous protocols
 */
export function sanitizeSvg(svgString: string): string {
  if (!svgString || typeof svgString !== "string") return "";

  const clean = svgString
    // Remove <script>...</script>
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove foreignObject which can contain arbitrary HTML
    .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, "")
    // Remove inline JS event handlers (onload, onclick, onerror, etc.)
    .replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*[^>\s]+/gi, "")
    // Remove javascript: and data: URIs inside href/xlink:href
    .replace(/(xlink:href|href)\s*=\s*['"]javascript:[^'"]*['"]/gi, "")
    .replace(/(xlink:href|href)\s*=\s*['"]data:text\/html[^'"]*['"]/gi, "");

  return clean;
}

/**
 * Extracts distinct hex and rgb colors found in an SVG string (fill and stroke)
 */
export function extractSvgColors(svgString: string): string[] {
  // Attributes, inline styles, <style> CSS and gradient stops; canonical #rrggbb, most used first
  return extractColors(svgString);
}

/**
 * Modifies fill and stroke colors in an SVG string without rasterizing.
 * Supports global fill/stroke override OR targeted color replacement via colorMap.
 */
export interface SvgColorOptions {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  colorMap?: Record<string, string>;
}

/**
 * Modifies fill, stroke (line), and stroke-width colors in an SVG string without rasterizing.
 * Supports global fill/stroke override OR targeted color replacement via colorMap.
 */
export function modifySvgColors(
  svgString: string,
  fillOrOptions?: string | SvgColorOptions,
  strokeArg?: string,
  colorMapArg?: Record<string, string>,
  strokeWidthArg?: number
): string {
  if (!svgString || typeof svgString !== "string") return "";
  const opts: SvgColorOptions =
    typeof fillOrOptions === "object" && fillOrOptions !== null
      ? fillOrOptions
      : { fill: fillOrOptions, stroke: strokeArg, colorMap: colorMapArg, strokeWidth: strokeWidthArg };

  // Remote SVGs (URLs) cannot be edited as text
  if (svgString.startsWith("http://") || svgString.startsWith("https://")) return svgString;

  let out = opts.colorMap && Object.keys(opts.colorMap).length > 0 ? replaceSvgColors(svgString, opts.colorMap) : svgString;
  if (opts.fill || opts.stroke || opts.strokeWidth !== undefined) {
    out = recolorWholeSvg(out, { fill: opts.fill || undefined, stroke: opts.stroke || undefined, strokeWidth: opts.strokeWidth });
  }
  return out;
}

/**
 * Converts an SVG string to a Data URL
 */
export function svgToDataUrl(svgString: string): string {
  const sanitized = sanitizeSvg(svgString);
  const encoded = encodeURIComponent(sanitized).replace(/'/g, "%27").replace(/"/g, "%22");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

const svgMarkupCache = new Map<string, string>();
const pendingSvgMarkupLoads = new Map<string, Promise<string>>();

/**
 * Fetches and caches raw SVG markup from an HTTP URL (e.g. Cloudflare R2 bucket)
 * with automatic proxy fallback to avoid CORS issues.
 */
export async function fetchSvgMarkup(url: string): Promise<string> {
  if (!url || typeof url !== "string") return "";

  // If already raw SVG XML
  if (url.trim().startsWith("<svg")) {
    return sanitizeSvg(url);
  }

  const cached = svgMarkupCache.get(url);
  if (cached) return cached;

  const pending = pendingSvgMarkupLoads.get(url);
  if (pending) return pending;

  const promise = (async () => {
    try {
      // Attempt 1: direct fetch
      let res = await fetch(url).catch(() => null);

      // Attempt 2: via proxy if direct failed or blocked
      if (!res || !res.ok) {
        const proxyUrl = `/api/assets/proxy?url=${encodeURIComponent(url)}`;
        res = await fetch(proxyUrl);
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch SVG markup: ${res.status}`);
      }

      const text = await res.text();
      const sanitized = sanitizeSvg(text);
      svgMarkupCache.set(url, sanitized);
      return sanitized;
    } catch (err) {
      console.warn(`[fetchSvgMarkup] Could not fetch SVG XML for: ${url}`, err);
      return "";
    } finally {
      pendingSvgMarkupLoads.delete(url);
    }
  })();

  pendingSvgMarkupLoads.set(url, promise);
  return promise;
}

/**
 * Guarantees the root <svg> declares an absolute width/height. SVGs that only have a
 * viewBox (or percentage sizes) have no intrinsic size, which some browsers refuse
 * to draw onto a canvas.
 */
export function ensureSvgIntrinsicSize(svgString: string): string {
  const rootMatch = svgString.match(/<svg\b[^>]*>/i);
  if (!rootMatch) return svgString;
  const rootTag = rootMatch[0];
  const isAbsolute = (attr: string) => {
    const m = rootTag.match(new RegExp(`\\s${attr}=["']\\s*([0-9.]+)\\s*(px)?\\s*["']`, "i"));
    return Boolean(m && parseFloat(m[1] || "0") > 0);
  };
  if (isAbsolute("width") && isAbsolute("height")) return svgString;

  const vb = rootTag.match(/viewBox=["']([^"']+)["']/i)?.[1];
  // Without a viewBox, coordinates are absolute pixels: forcing a size could crop content
  if (!vb) return svgString;
  const parts = (vb || "").split(/[\s,]+/).map(Number);
  const w = parts[2] && parts[2] > 0 ? parts[2] : 300;
  const h = parts[3] && parts[3] > 0 ? parts[3] : 150;
  // Rasterize at a comfortable resolution while keeping the aspect ratio
  const k = Math.max(1, 512 / Math.max(w, h));

  const cleaned = rootTag
    .replace(/\s(width|height)=(["'])[^"']*\2/gi, "")
    .replace(/^<svg\b/i, `<svg width="${Math.round(w * k * 100) / 100}" height="${Math.round(h * k * 100) / 100}"`);
  return svgString.replace(rootTag, cleaned);
}

const svgImageCache = new Map<string, HTMLImageElement>();
const pendingSvgLoads = new Map<string, Promise<HTMLImageElement>>();

/**
 * Loads an SVG string into an HTMLImageElement with in-memory caching
 */
export function loadSvgImage(svgString: string): Promise<HTMLImageElement> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cannot load image in SSR environment"));
  }

  const cached = svgImageCache.get(svgString);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = pendingSvgLoads.get(svgString);
  if (pending) {
    return pending;
  }

  const sizedSvg = ensureSvgIntrinsicSize(svgString);
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    let blobUrl: string | null = null;
    let triedBlob = false;

    img.onload = () => {
      if (blobUrl) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore
        }
      }
      svgImageCache.set(svgString, img);
      pendingSvgLoads.delete(svgString);
      resolve(img);
    };

    img.onerror = (err) => {
      // Fallback: try Blob object URL if data URL failed
      if (!triedBlob && typeof Blob !== "undefined" && typeof URL !== "undefined") {
        triedBlob = true;
        try {
          const blob = new Blob([sizedSvg], { type: "image/svg+xml;charset=utf-8" });
          blobUrl = URL.createObjectURL(blob);
          img.src = blobUrl;
          return;
        } catch {
          // fall through
        }
      }
      if (blobUrl) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore
        }
      }
      pendingSvgLoads.delete(svgString);
      reject(err);
    };

    img.src = svgToDataUrl(sizedSvg);
  });

  pendingSvgLoads.set(svgString, promise);
  return promise;
}

const urlImageCache = new Map<string, HTMLImageElement>();
const pendingUrlLoads = new Map<string, Promise<HTMLImageElement>>();

/**
 * Loads an external image URL into an HTMLImageElement with resilient CORS fallback
 */
export function loadUrlImage(url: string): Promise<HTMLImageElement> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cannot load image in SSR environment"));
  }

  const cached = urlImageCache.get(url);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = pendingUrlLoads.get(url);
  if (pending) {
    return pending;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    let resolved = false;

    const finish = (resultImg: HTMLImageElement) => {
      if (resolved) return;
      resolved = true;
      urlImageCache.set(url, resultImg);
      pendingUrlLoads.delete(url);
      resolve(resultImg);
    };

    const imgWithCors = new window.Image();
    imgWithCors.crossOrigin = "anonymous";
    imgWithCors.onload = () => finish(imgWithCors);

    imgWithCors.onerror = () => {
      if (resolved) return;

      const proxyUrl = `/api/assets/proxy?url=${encodeURIComponent(url)}`;
      const proxyImg = new window.Image();
      proxyImg.crossOrigin = "anonymous";
      proxyImg.onload = () => finish(proxyImg);

      proxyImg.onerror = () => {
        if (resolved) return;

        const plainImg = new window.Image();
        plainImg.onload = () => finish(plainImg);
        plainImg.onerror = (err) => {
          if (resolved) return;
          resolved = true;
          pendingUrlLoads.delete(url);
          console.error(`[loadUrlImage] All attempts failed for: ${url}`, err);
          reject(new Error(`Failed to load image from: ${url}`));
        };
        plainImg.src = url;
      };

      proxyImg.src = proxyUrl;
    };

    imgWithCors.src = url;
  });

  pendingUrlLoads.set(url, promise);
  return promise;
}

// ==========================================
// Scientific Color Palettes & Presets (BioRender Style)
// ==========================================

export interface ScientificColorPreset {
  id: string;
  name: string;
  category: "scientific" | "cellular" | "molecular" | "anatomy";
  primary: string;
  secondary: string;
  tint: string;
  description: string;
}

export const SCIENTIFIC_COLOR_PRESETS: ScientificColorPreset[] = [
  {
    id: "bio-red",
    name: "Bio Red",
    category: "scientific",
    primary: "#ef4444",
    secondary: "#b91c1c",
    tint: "#fee2e2",
    description: "Erythrocytes, Heme, Arterial vessels, Viral Spike glycoproteins",
  },
  {
    id: "bio-blue",
    name: "Bio Blue",
    category: "scientific",
    primary: "#3b82f6",
    secondary: "#1d4ed8",
    tint: "#dbeafe",
    description: "DAPI counterstain, Cell Nuclei, Cytosol, Surface Receptors",
  },
  {
    id: "bio-purple",
    name: "Bio Purple",
    category: "cellular",
    primary: "#8b5cf6",
    secondary: "#6d28d9",
    tint: "#ede9fe",
    description: "Membrane proteins, Gram-positive envelopes, Endosomes",
  },
  {
    id: "bio-magenta",
    name: "Bio Magenta",
    category: "molecular",
    primary: "#ec4899",
    secondary: "#be185d",
    tint: "#fce7f3",
    description: "RNA strands, Glycoproteins, Fluorescent probes (Cy3/TAMRA)",
  },
  {
    id: "bio-coral",
    name: "Bio Coral",
    category: "cellular",
    primary: "#f97316",
    secondary: "#c2410c",
    tint: "#ffedd5",
    description: "Mitochondria, Cytochrome complexes, Active transport enzymes",
  },
  {
    id: "bio-orange",
    name: "Bio Orange",
    category: "molecular",
    primary: "#f59e0b",
    secondary: "#b45309",
    tint: "#fef3c7",
    description: "Lipid droplets, Phospholipid bilayer, Micelles",
  },
  {
    id: "bio-green",
    name: "Bio Green",
    category: "scientific",
    primary: "#22c55e",
    secondary: "#15803d",
    tint: "#dcfce7",
    description: "GFP fluorophore, Chloroplasts, Viable cells, Bacteria",
  },
  {
    id: "bio-teal",
    name: "Bio Teal",
    category: "cellular",
    primary: "#14b8a6",
    secondary: "#0f766e",
    tint: "#ccfbf1",
    description: "Endoplasmic Reticulum, Golgi apparatus, Ion channels",
  },
  {
    id: "bio-cyan",
    name: "Bio Cyan",
    category: "molecular",
    primary: "#06b6d4",
    secondary: "#0e7490",
    tint: "#cffafe",
    description: "Extracellular matrix, Microtubules, Aqueous vesicles",
  },
  {
    id: "bio-amber",
    name: "Bio Amber",
    category: "molecular",
    primary: "#eab308",
    secondary: "#a16207",
    tint: "#fef9c3",
    description: "Carbohydrates, Polysaccharides, Glycogen granules",
  },
  {
    id: "bio-emerald",
    name: "Bio Emerald",
    category: "cellular",
    primary: "#10b981",
    secondary: "#047857",
    tint: "#d1fae5",
    description: "Plant tissues, Thylakoid membranes, Biofilms",
  },
  {
    id: "bio-slate",
    name: "Bio Slate",
    category: "scientific",
    primary: "#475569",
    secondary: "#1e293b",
    tint: "#f1f5f9",
    description: "Electron microscopy, Carbon matrices, Structural scaffolds",
  },
];

// Quick color overlay swatches for fast Bio-style recoloring
export const BIO_COLOR_SWATCHES = [
  { name: "Bio Blue", hex: "#3b82f6" },
  { name: "Bio Purple", hex: "#8b5cf6" },
  { name: "Bio Magenta", hex: "#ec4899" },
  { name: "Bio Red", hex: "#ef4444" },
  { name: "Bio Coral", hex: "#f97316" },
  { name: "Bio Orange", hex: "#f59e0b" },
  { name: "Bio Green", hex: "#22c55e" },
  { name: "Bio Teal", hex: "#14b8a6" },
  { name: "Bio Cyan", hex: "#06b6d4" },
  { name: "Bio Slate", hex: "#475569" },
];

// ==========================================
// SVG Subcomponent Extraction & Distribution
// ==========================================

export interface SvgSubComponent {
  id: string;
  name: string;
  tag: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  svgMarkup: string;
  viewBox: string;
  bbox?: { x: number; y: number; width: number; height: number };
  /** True when the component itself contains several editable layers (double-click drills in) */
  isGroup?: boolean;
}

export interface DecomposedSvgElement {
  id: string;
  name: string;
  svgContent: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  bbox?: { x: number; y: number; width: number; height: number };
  isGroup?: boolean;
}

/**
 * Extracts the viewBox attribute from an SVG string (read from the root <svg> tag)
 */
export function extractSvgViewBox(svgString: string): string {
  if (!svgString) return "0 0 100 100";
  const rootTag = svgString.match(/<svg\b[^>]*>/i)?.[0] || svgString;
  const match = rootTag.match(/viewBox=["']([^"']+)["']/i);
  if (match && match[1]) return match[1].trim();
  const wMatch = rootTag.match(/\swidth=["']([0-9.]+)(?:px)?["']/i);
  const hMatch = rootTag.match(/\sheight=["']([0-9.]+)(?:px)?["']/i);
  if (wMatch && hMatch && wMatch[1] && hMatch[1]) {
    return `0 0 ${wMatch[1]} ${hMatch[1]}`;
  }
  return "0 0 100 100";
}

/**
 * Formats raw SVG component ID or tag into a readable scientific name
 */
export function formatComponentLabel(
  rawIdOrTag: string,
  index: number,
  fill?: string,
  tag?: string
): string {
  const genericTags = ["g", "path", "circle", "rect", "ellipse", "polygon", "polyline", "line", "svg"];
  if (rawIdOrTag && !rawIdOrTag.startsWith("comp-") && !genericTags.includes(rawIdOrTag.toLowerCase())) {
    return rawIdOrTag
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const tagLabels: Record<string, string> = { g: "Group", a: "Group", use: "Symbol", text: "Text" };
  const displayTag = tag
    ? tagLabels[tag.toLowerCase()] || tag.charAt(0).toUpperCase() + tag.slice(1)
    : "Component";
  if (fill && fill !== "none" && fill !== "transparent" && !fill.startsWith("url(") && fill !== "currentColor") {
    return `${displayTag} ${index + 1} (${fill})`;
  }
  return `${displayTag} ${index + 1}`;
}

// ==========================================
// SVG structure model
// ------------------------------------------
// Both the browser path (DOMParser + live measurement) and the string fallback
// (Node.js / tests) produce the same lightweight tree, so decomposition,
// ungrouping and regrouping behave identically everywhere.
// ==========================================

type BBox = { x: number; y: number; width: number; height: number };

/** 2D affine matrix [a, b, c, d, e, f] (same layout as SVGMatrix / DOMMatrix). */
export type SvgMatrix = [number, number, number, number, number, number];

const IDENTITY_MATRIX: SvgMatrix = [1, 0, 0, 1, 0, 0];
const NUMBER_RE = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

interface SvgTreeNode {
  /** Lowercase local tag name (e.g. "g", "lineargradient") */
  tag: string;
  attrs: Array<[string, string]>;
  children: SvgTreeNode[];
  /** Serialized, standalone-valid markup of this node */
  outer: () => string;
  /** Live DOM element (browser path only) used for precise measurement */
  dom?: Element;
  /** Source offsets (string parser only) used for precise in-place markup edits */
  src?: SvgNodeSource;
}

interface SvgNodeSource {
  rawName: string;
  start: number;
  /** Index right after the opening tag's ">" */
  openEnd: number;
  end: number;
  selfClosing: boolean;
}

/** Elements that paint something and can become an independently editable layer */
const VISUAL_TAGS = new Set([
  "g",
  "path",
  "circle",
  "rect",
  "ellipse",
  "polygon",
  "polyline",
  "line",
  "text",
  "use",
  "image",
  "switch",
  "a",
  "svg",
]);

/** Resource elements shared by every decomposed part (gradients, clips, CSS, markers...) */
const DEF_TAGS = new Set([
  "defs",
  "style",
  "clippath",
  "lineargradient",
  "radialgradient",
  "filter",
  "mask",
  "pattern",
  "marker",
  "symbol",
]);

/** Root <svg> attributes that describe the viewport rather than inheritable styling */
const ROOT_ONLY_ATTRS = new Set([
  "viewbox",
  "width",
  "height",
  "x",
  "y",
  "id",
  "class",
  "version",
  "preserveaspectratio",
  "enable-background",
  "baseprofile",
  "data-name",
  "overflow",
  "transform",
  "style",
]);

const fmt = (n: number): string => String(Math.round(n * 100) / 100);
const fmtScale = (n: number): string => String(Math.round(n * 100000) / 100000);

export function multiplySvgMatrix(m1: SvgMatrix, m2: SvgMatrix): SvgMatrix {
  return multiplyMatrix(m1, m2);
}

export function invertSvgMatrix(m: SvgMatrix): SvgMatrix {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c || 1e-12;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

function multiplyMatrix(m1: SvgMatrix, m2: SvgMatrix): SvgMatrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function applyMatrix(m: SvgMatrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Parses an SVG `transform` attribute (matrix/translate/scale/rotate/skewX/skewY)
 * into a single affine matrix.
 */
export function parseSvgTransform(transform: string | null | undefined): SvgMatrix {
  if (!transform) return IDENTITY_MATRIX;
  let result: SvgMatrix = IDENTITY_MATRIX;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(transform)) !== null) {
    const fn = (match[1] || "").toLowerCase();
    const v = (match[2]?.match(NUMBER_RE) || []).map(Number);
    let t: SvgMatrix = IDENTITY_MATRIX;
    if (fn === "matrix" && v.length >= 6) {
      t = [v[0]!, v[1]!, v[2]!, v[3]!, v[4]!, v[5]!];
    } else if (fn === "translate") {
      t = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    } else if (fn === "scale") {
      const sx = v[0] ?? 1;
      const sy = v[1] ?? sx;
      t = [sx, 0, 0, sy, 0, 0];
    } else if (fn === "rotate") {
      const rad = ((v[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const r: SvgMatrix = [cos, sin, -sin, cos, 0, 0];
      if (v.length >= 3) {
        const cx = v[1]!;
        const cy = v[2]!;
        t = multiplyMatrix(multiplyMatrix([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy]);
      } else {
        t = r;
      }
    } else if (fn === "skewx") {
      t = [1, 0, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    } else if (fn === "skewy") {
      t = [1, Math.tan(((v[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    }
    result = multiplyMatrix(result, t);
  }
  return result;
}

function transformBBox(b: BBox, m: SvgMatrix): BBox {
  const corners = [
    applyMatrix(m, b.x, b.y),
    applyMatrix(m, b.x + b.width, b.y),
    applyMatrix(m, b.x, b.y + b.height),
    applyMatrix(m, b.x + b.width, b.y + b.height),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

function expandBBox(b: BBox, pad: number): BBox {
  if (!pad || pad <= 0) return b;
  return { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2 };
}

function unionBBox(a: BBox | undefined, b: BBox | undefined): BBox | undefined {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

function bboxFromPoints(points: Array<[number, number]>): BBox | undefined {
  if (points.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of points) {
    if (!isFinite(px) || !isFinite(py)) continue;
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }
  if (minX === Infinity) return undefined;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Rounds a bbox outward to 2 decimals and guarantees a drawable, non-zero size */
function normalizeBBox(b: BBox, minSize: number): BBox {
  let x0 = Math.floor(b.x * 100) / 100;
  let y0 = Math.floor(b.y * 100) / 100;
  let x1 = Math.ceil((b.x + b.width) * 100) / 100;
  let y1 = Math.ceil((b.y + b.height) * 100) / 100;
  if (x1 - x0 < minSize) {
    const grow = (minSize - (x1 - x0)) / 2;
    x0 -= grow;
    x1 += grow;
  }
  if (y1 - y0 < minSize) {
    const grow = (minSize - (y1 - y0)) / 2;
    y0 -= grow;
    y1 += grow;
  }
  return {
    x: Math.round(x0 * 100) / 100,
    y: Math.round(y0 * 100) / 100,
    width: Math.round((x1 - x0) * 100) / 100,
    height: Math.round((y1 - y0) * 100) / 100,
  };
}

function parseViewBoxNumbers(viewBox: string, fallbackW = 100, fallbackH = 100): [number, number, number, number] {
  const parts = viewBox.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
  return [
    parts[0] ?? 0,
    parts[1] ?? 0,
    parts[2] && parts[2] > 0 ? parts[2] : fallbackW,
    parts[3] && parts[3] > 0 ? parts[3] : fallbackH,
  ];
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
    const e = entity.toLowerCase();
    if (e === "amp") return "&";
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "quot") return '"';
    if (e === "apos") return "'";
    const code = e.startsWith("#x") ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return isNaN(code) ? whole : String.fromCodePoint(code);
  });
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function attrsToString(attrs: Array<[string, string]>): string {
  return attrs.map(([n, v]) => ` ${n}="${escapeAttr(v)}"`).join("");
}

function getAttr(node: SvgTreeNode, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [n, v] of node.attrs) {
    if (n === name || n.toLowerCase() === lower) return v;
  }
  return undefined;
}

/** Reads a presentation property from either the attribute or the inline style */
function getPresentation(node: SvgTreeNode, prop: string): string | undefined {
  const style = getAttr(node, "style");
  if (style) {
    const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
    if (m && m[1]) return m[1].trim();
  }
  return getAttr(node, prop);
}

/**
 * Attributes from an ancestor that must be replayed around a detached child so it
 * keeps inherited fill/stroke/opacity/transform/clip/class styling.
 */
function inheritableAttrs(node: SvgTreeNode, isRoot: boolean): Array<[string, string]> {
  return node.attrs.filter(([name]) => {
    const lower = name.toLowerCase();
    if (lower === "xmlns" || lower.startsWith("xmlns:")) return false;
    if (lower.startsWith("on")) return false;
    // Namespaced editor metadata (inkscape:, sodipodi:, ...) is never needed for rendering
    if (lower.includes(":") && !lower.startsWith("xlink:") && !lower.startsWith("xml:")) return false;
    if (isRoot) {
      if (ROOT_ONLY_ATTRS.has(lower) || lower === "xml:space") return false;
    } else if (lower === "data-name") {
      return false;
    }
    return true;
  });
}

/** Root-level `<svg style="...">` may carry inheritable properties (fill, stroke...); keep only those */
function rootStyleAttr(root: SvgTreeNode): Array<[string, string]> {
  const style = getAttr(root, "style");
  if (!style) return [];
  const kept = style
    .split(";")
    .map((s) => s.trim())
    .filter((decl) => {
      const prop = decl.split(":")[0]?.trim().toLowerCase() || "";
      return (
        prop.startsWith("fill") ||
        prop.startsWith("stroke") ||
        prop.startsWith("font") ||
        prop === "color" ||
        prop === "opacity" ||
        prop.startsWith("text-") ||
        prop === "paint-order" ||
        prop === "shape-rendering"
      );
    });
  return kept.length > 0 ? [["style", kept.join(";")]] : [];
}

function visualChildren(node: SvgTreeNode): SvgTreeNode[] {
  return node.children.filter((c) => VISUAL_TAGS.has(c.tag));
}

function localName(raw: string): string {
  const idx = raw.indexOf(":");
  return (idx >= 0 ? raw.slice(idx + 1) : raw).toLowerCase();
}

/**
 * Minimal, dependency-free XML parser producing an SvgTreeNode tree.
 * Used when no DOM is available and for parsing per-element markup during regrouping.
 */
function parseSvgMarkupTree(src: string): SvgTreeNode | null {
  if (!src || typeof src !== "string") return null;
  const tokenRe =
    /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE(?:[^>[]|\[[\s\S]*?\])*>|<\/([^\s>]+)\s*>|<([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/gi;
  const attrRe = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

  interface Building {
    node: SvgTreeNode;
    rawName: string;
    src: SvgNodeSource;
  }

  const topLevel: SvgTreeNode[] = [];
  const stack: Building[] = [];

  const makeNode = (rawName: string, attrSrc: string, start: number, openEnd: number, selfClosing: boolean): Building => {
    const attrs: Array<[string, string]> = [];
    attrRe.lastIndex = 0;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrSrc)) !== null) {
      if (!am[1]) continue;
      attrs.push([am[1], decodeXmlEntities(am[2] ?? am[3] ?? am[4] ?? "")]);
    }
    const source: SvgNodeSource = { rawName, start, openEnd, end: selfClosing ? openEnd : src.length, selfClosing };
    const node: SvgTreeNode = {
      tag: localName(rawName),
      attrs,
      children: [],
      outer: () => src.slice(source.start, source.end),
      src: source,
    };
    return { node, rawName, src: source };
  };

  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(src)) !== null) {
    if (m[1] !== undefined) {
      // Closing tag: pop to the matching open element (tolerates malformed nesting)
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.rawName === m[1]) {
          while (stack.length > i + 1) {
            stack.pop()!.src.end = m.index;
          }
          stack.pop()!.src.end = tokenRe.lastIndex;
          break;
        }
      }
      continue;
    }
    if (m[2] === undefined) continue; // comment, CDATA, PI, doctype

    const selfClosing = m[4] === "/";
    const building = makeNode(m[2], m[3] || "", m.index, tokenRe.lastIndex, selfClosing);
    const parent = stack[stack.length - 1];
    (parent ? parent.node.children : topLevel).push(building.node);
    if (!selfClosing) stack.push(building);
  }

  const findSvg = (nodes: SvgTreeNode[]): SvgTreeNode | null => {
    for (const n of nodes) {
      if (n.tag === "svg") return n;
      const nested = findSvg(n.children);
      if (nested) return nested;
    }
    return null;
  };
  return findSvg(topLevel);
}

function domToTree(el: Element): SvgTreeNode {
  return {
    tag: (el.localName || el.tagName).toLowerCase(),
    attrs: Array.from(el.attributes).map((a) => [a.name, a.value] as [string, string]),
    children: Array.from(el.children).map(domToTree),
    outer: () => {
      try {
        return new XMLSerializer().serializeToString(el);
      } catch {
        return el.outerHTML;
      }
    },
    dom: el,
  };
}

/** Collects every reusable resource definition so detached parts keep gradients, clips, CSS, markers */
function collectSharedDefs(root: SvgTreeNode): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (markup: string) => {
    if (!seen.has(markup)) {
      seen.add(markup);
      out.push(markup);
    }
  };
  const walk = (node: SvgTreeNode) => {
    for (const child of node.children) {
      if (DEF_TAGS.has(child.tag)) {
        if (child.tag === "defs") child.children.forEach((c) => push(c.outer()));
        else push(child.outer());
      } else {
        walk(child);
      }
    }
  };
  walk(root);
  return out;
}

function namespaceDeclarations(root: SvgTreeNode): Array<[string, string]> {
  return root.attrs.filter(([n]) => {
    const lower = n.toLowerCase();
    return lower.startsWith("xmlns:") && lower !== "xmlns:xlink";
  });
}

function pathPoints(d: string): Array<[number, number]> {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const points: Array<[number, number]> = [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const num = (k: number) => parseFloat(tokens[i + k] || "NaN");

  while (i < tokens.length) {
    const tok = tokens[i]!;
    if (/^[a-zA-Z]$/.test(tok)) {
      cmd = tok;
      i++;
      if (cmd === "z" || cmd === "Z") {
        x = startX;
        y = startY;
      }
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    const C = cmd.toUpperCase();
    let consumed = 0;

    if (C === "M") {
      x = num(0) + ox;
      y = num(1) + oy;
      startX = x;
      startY = y;
      points.push([x, y]);
      consumed = 2;
      cmd = rel ? "l" : "L";
    } else if (C === "L" || C === "T") {
      x = num(0) + ox;
      y = num(1) + oy;
      points.push([x, y]);
      consumed = 2;
    } else if (C === "H") {
      x = num(0) + ox;
      points.push([x, y]);
      consumed = 1;
    } else if (C === "V") {
      y = num(0) + oy;
      points.push([x, y]);
      consumed = 1;
    } else if (C === "C") {
      points.push([num(0) + ox, num(1) + oy], [num(2) + ox, num(3) + oy]);
      x = num(4) + ox;
      y = num(5) + oy;
      points.push([x, y]);
      consumed = 6;
    } else if (C === "S" || C === "Q") {
      points.push([num(0) + ox, num(1) + oy]);
      x = num(2) + ox;
      y = num(3) + oy;
      points.push([x, y]);
      consumed = 4;
    } else if (C === "A") {
      const r = Math.max(Math.abs(num(0)), Math.abs(num(1)));
      const nx = num(5) + ox;
      const ny = num(6) + oy;
      const mx = (x + nx) / 2;
      const my = (y + ny) / 2;
      // Conservative envelope for the arc bulge
      points.push([mx - r, my - r], [mx + r, my + r], [nx, ny]);
      x = nx;
      y = ny;
      consumed = 7;
    } else {
      break;
    }

    if (consumed === 0 || isNaN(x) || isNaN(y)) break;
    i += consumed;
  }
  return points;
}

function numAttr(node: SvgTreeNode, name: string, fallback = 0): number {
  const v = getAttr(node, name);
  if (v === undefined) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

/** Geometry bbox of a single shape in its own coordinate system (no transform, no stroke) */
function shapeLocalBBox(node: SvgTreeNode): BBox | undefined {
  switch (node.tag) {
    case "circle": {
      const r = numAttr(node, "r");
      if (r <= 0) return undefined;
      return { x: numAttr(node, "cx") - r, y: numAttr(node, "cy") - r, width: 2 * r, height: 2 * r };
    }
    case "ellipse": {
      const rx = numAttr(node, "rx");
      const ry = numAttr(node, "ry");
      if (rx <= 0 || ry <= 0) return undefined;
      return { x: numAttr(node, "cx") - rx, y: numAttr(node, "cy") - ry, width: 2 * rx, height: 2 * ry };
    }
    case "rect":
    case "image":
    case "use": {
      const w = numAttr(node, "width");
      const h = numAttr(node, "height");
      if (w <= 0 || h <= 0) return undefined;
      return { x: numAttr(node, "x"), y: numAttr(node, "y"), width: w, height: h };
    }
    case "line":
      return bboxFromPoints([
        [numAttr(node, "x1"), numAttr(node, "y1")],
        [numAttr(node, "x2"), numAttr(node, "y2")],
      ]);
    case "polygon":
    case "polyline": {
      const nums = (getAttr(node, "points")?.match(NUMBER_RE) || []).map(Number);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i]!, nums[i + 1]!]);
      return bboxFromPoints(pts);
    }
    case "path":
      return bboxFromPoints(pathPoints(getAttr(node, "d") || ""));
    case "text": {
      const fontSize = parseFloat(getPresentation(node, "font-size") || "16") || 16;
      const text = decodeXmlEntities(node.outer().replace(/<[^>]*>/g, "")).trim();
      const width = Math.max(fontSize, text.length * fontSize * 0.6);
      return { x: numAttr(node, "x"), y: numAttr(node, "y") - fontSize, width, height: fontSize * 1.25 };
    }
    default:
      return undefined;
  }
}

interface StrokeContext {
  stroke?: string;
  strokeWidth: number;
  lineJoin?: string;
}

function inheritStroke(node: SvgTreeNode, parent: StrokeContext): StrokeContext {
  const sw = getPresentation(node, "stroke-width");
  const parsed = sw !== undefined ? parseFloat(sw) : NaN;
  return {
    stroke: getPresentation(node, "stroke") ?? parent.stroke,
    strokeWidth: isNaN(parsed) ? parent.strokeWidth : parsed,
    lineJoin: getPresentation(node, "stroke-linejoin") ?? parent.lineJoin,
  };
}

/** Shapes without corners never produce miter spikes */
const SMOOTH_SHAPES = new Set(["circle", "ellipse"]);

function strokePadding(ctx: StrokeContext, hasMarkers: boolean, tag = ""): number {
  const stroked = ctx.stroke && ctx.stroke !== "none" && ctx.strokeWidth > 0;
  let pad = 0;
  if (stroked) {
    // Miter joins (the SVG default) can poke out further than half the stroke width
    const roundJoins = SMOOTH_SHAPES.has(tag) || (ctx.lineJoin && ctx.lineJoin !== "miter");
    pad = roundJoins ? ctx.strokeWidth / 2 : ctx.strokeWidth;
  }
  if (hasMarkers) pad = Math.max(pad, 3 * Math.max(ctx.strokeWidth, 1));
  return pad;
}

/** Pure-geometry measurement in the root coordinate space (string fallback path) */
function measureTreeNode(node: SvgTreeNode, parentMatrix: SvgMatrix, inherited: StrokeContext): BBox | undefined {
  const matrix = multiplyMatrix(parentMatrix, parseSvgTransform(getAttr(node, "transform")));
  const ctx = inheritStroke(node, inherited);
  if (node.tag === "g" || node.tag === "a" || node.tag === "switch" || node.tag === "svg") {
    let acc: BBox | undefined;
    for (const child of visualChildren(node)) {
      acc = unionBBox(acc, measureTreeNode(child, matrix, ctx));
    }
    return acc;
  }
  const local = shapeLocalBBox(node);
  if (!local) return undefined;
  const hasMarkers = Boolean(
    getPresentation(node, "marker-end") || getPresentation(node, "marker-start") || getPresentation(node, "marker-mid")
  );
  return transformBBox(expandBBox(local, strokePadding(ctx, hasMarkers, node.tag)), matrix);
}

/** Matrix from an element's local coordinates up to the root <svg> user space (includes its own transform) */
function domMatrixToRoot(el: Element, root: Element): SvgMatrix {
  let m: SvgMatrix = IDENTITY_MATRIX;
  let cur: Element | null = el;
  while (cur && cur !== root) {
    m = multiplyMatrix(parseSvgTransform(cur.getAttribute("transform")), m);
    cur = cur.parentElement;
  }
  return m;
}

/** Visual overflow (stroke, miter joins, markers) that getBBox() does not report */
function domStrokePadding(el: Element): number {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return 0;
  let pad = 0;
  const nodes = [el, ...Array.from(el.querySelectorAll("*")).slice(0, 400)];
  for (const n of nodes) {
    const tag = (n.localName || "").toLowerCase();
    if (DEF_TAGS.has(tag) || tag === "stop") continue;
    let cs: CSSStyleDeclaration;
    try {
      cs = window.getComputedStyle(n);
    } catch {
      continue;
    }
    const sw = parseFloat(cs.strokeWidth || "0") || 0;
    const hasMarkers = [cs.getPropertyValue("marker-start"), cs.getPropertyValue("marker-mid"), cs.getPropertyValue("marker-end")]
      .some((v) => v && v !== "none");
    pad = Math.max(
      pad,
      strokePadding(
        { stroke: cs.stroke, strokeWidth: sw, lineJoin: cs.getPropertyValue("stroke-linejoin") },
        hasMarkers,
        tag
      )
    );
  }
  return pad;
}

/**
 * Calculates the exact axis-aligned bounding box of an SVG element
 * transformed into the SVG root coordinate space (viewBox space).
 * Includes stroke / marker overflow so detached parts are never clipped.
 */
export function getElementRootBBox(
  element: SVGGraphicsElement | null,
  svgRoot: SVGSVGElement | Element | null
): { x: number; y: number; width: number; height: number } | null {
  if (!element || !svgRoot || typeof element.getBBox !== "function") return null;
  try {
    const b = element.getBBox();
    if (!b || (b.width <= 0 && b.height <= 0)) return null;
    const local: BBox = { x: b.x, y: b.y, width: b.width, height: b.height };
    const matrix = domMatrixToRoot(element, svgRoot);
    const pad = domStrokePadding(element);
    return transformBBox(expandBBox(local, pad), matrix);
  } catch {
    return null;
  }
}

/**
 * Computes a bounding box for an SVG shape or group, using browser DOM getBBox()
 * or geometry extraction from markup.
 */
export function computeShapeBBox(
  element: Element | null,
  snippet: string,
  fallbackViewBox?: string
): { x: number; y: number; width: number; height: number } | undefined {
  if (element && typeof (element as SVGGraphicsElement).getBBox === "function") {
    try {
      const b = (element as SVGGraphicsElement).getBBox();
      if (b && b.width > 0 && b.height > 0) {
        return normalizeBBox({ x: b.x, y: b.y, width: b.width, height: b.height }, 0.01);
      }
    } catch {
      // Fall through to geometry extraction
    }
  }

  const tree = parseSvgMarkupTree(`<svg>${snippet}</svg>`);
  if (tree) {
    let acc: BBox | undefined;
    for (const child of visualChildren(tree)) {
      acc = unionBBox(acc, measureTreeNode(child, IDENTITY_MATRIX, { strokeWidth: 1 }));
    }
    if (acc && (acc.width > 0 || acc.height > 0)) return normalizeBBox(acc, 0.01);
  }

  if (fallbackViewBox) {
    const [x, y, w, h] = parseViewBoxNumbers(fallbackViewBox);
    return { x, y, width: w, height: h };
  }
  return undefined;
}

/**
 * Resolves the list of top-level editable layers of an SVG: single wrapper groups
 * (e.g. Illustrator "Layer_1") are unwrapped and returned as `wrappers`.
 */
function resolveLayerChildren(root: SvgTreeNode): { wrappers: SvgTreeNode[]; children: SvgTreeNode[] } {
  const wrappers: SvgTreeNode[] = [];
  let children = visualChildren(root);
  while (children.length === 1 && children[0]!.tag === "g") {
    const inner = visualChildren(children[0]!);
    if (inner.length === 0) break;
    wrappers.push(children[0]!);
    children = inner;
  }
  return { wrappers, children };
}

/** One editable layer of an SVG, addressed by its index path in the layer tree */
export interface SvgLayerInfo {
  /** Index path from the root, e.g. [1, 0] = first layer inside the second top-level layer */
  path: number[];
  id: string;
  name: string;
  tag: string;
  /** True when the layer contains several editable layers (double-click drills in) */
  isGroup: boolean;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Stroke-inclusive bounds in the root viewBox coordinate space */
  bbox?: BBox;
  viewBox: string;
  /** Standalone SVG of only this layer (styling, defs and ancestors' transforms included) */
  markup: string;
}

/** Layer geometry in an element's local pixel space, as consumed by the canvas */
export interface SvgLayerGeometry {
  path: number[];
  name: string;
  isGroup: boolean;
  markup: string;
  box: { x: number; y: number; width: number; height: number };
}

/** Everything needed to render the children of one container (root or a nested group) */
interface LayerContainer {
  node: SvgTreeNode;
  /** Inheritable attributes of the root and every ancestor, outermost first */
  contextLayers: Array<Array<[string, string]>>;
  /** Root-space matrix of the container's content */
  matrix: SvgMatrix;
  stroke: StrokeContext;
  /** Nodes to read inherited fill/stroke from, innermost first */
  styleChain: SvgTreeNode[];
}

function rootLayerContainer(root: SvgTreeNode): LayerContainer {
  return {
    node: root,
    contextLayers: [[...inheritableAttrs(root, true), ...rootStyleAttr(root)]],
    matrix: IDENTITY_MATRIX,
    stroke: inheritStroke(root, { strokeWidth: 1 }),
    styleChain: [root],
  };
}

function descendLayerContainer(container: LayerContainer, index: number): LayerContainer | null {
  const { wrappers, children } = resolveLayerChildren(container.node);
  const child = children[index];
  if (!child) return null;
  const contextLayers = [...container.contextLayers];
  const styleChain = [...container.styleChain];
  let matrix = container.matrix;
  let stroke = container.stroke;
  for (const node of [...wrappers, child]) {
    contextLayers.push(inheritableAttrs(node, false));
    matrix = multiplyMatrix(matrix, parseSvgTransform(getAttr(node, "transform")));
    stroke = inheritStroke(node, stroke);
    styleChain.unshift(node);
  }
  return { node: child, contextLayers, matrix, stroke, styleChain };
}

function buildLayerChildren(
  container: LayerContainer,
  basePath: number[],
  header: string,
  nsDecls: string,
  viewBox: string,
  svgRootEl: Element | null
): SvgLayerInfo[] {
  const [, , vbW, vbH] = parseViewBoxNumbers(viewBox, 500, 500);
  const minSize = Math.max(0.01, Math.max(vbW, vbH) * 0.002);
  const { wrappers, children } = resolveLayerChildren(container.node);

  const contextLayers = [...container.contextLayers, ...wrappers.map((w) => inheritableAttrs(w, false))].filter(
    (attrs) => attrs.length > 0
  );
  const openContext = contextLayers.map((attrs) => `<g${attrsToString(attrs)}>`).join("");
  const closeContext = "</g>".repeat(contextLayers.length);

  let baseMatrix = container.matrix;
  let strokeCtx = container.stroke;
  for (const w of wrappers) {
    baseMatrix = multiplyMatrix(baseMatrix, parseSvgTransform(getAttr(w, "transform")));
    strokeCtx = inheritStroke(w, strokeCtx);
  }

  const styleSources = [...wrappers].reverse().concat(container.styleChain);
  const resolveStyle = (child: SvgTreeNode, prop: string): string | undefined => {
    const own = getPresentation(child, prop);
    if (own) return own;
    for (const src of styleSources) {
      const v = getPresentation(src, prop);
      if (v) return v;
    }
    return undefined;
  };

  const parentId =
    (wrappers.length > 0 ? getAttr(wrappers[wrappers.length - 1]!, "id") : undefined) ||
    (container.node.tag !== "svg" ? getAttr(container.node, "id") : undefined);
  const usedIds = new Set<string>();

  return children.map((child, idx) => {
    const ownId = getAttr(child, "id");
    const baseId = ownId || (parentId ? `${parentId}-${idx + 1}` : `comp-${idx + 1}`);
    let uniqueId = baseId;
    let counter = 1;
    while (usedIds.has(uniqueId)) uniqueId = `${baseId}-${counter++}`;
    usedIds.add(uniqueId);

    const label = getAttr(child, "data-name") || getAttr(child, "inkscape:label") || getAttr(child, "aria-label");
    const fill = resolveStyle(child, "fill");
    const stroke = resolveStyle(child, "stroke");
    const swRaw = resolveStyle(child, "stroke-width");
    const strokeWidth = swRaw !== undefined && !isNaN(parseFloat(swRaw)) ? parseFloat(swRaw) : undefined;

    let measured: BBox | undefined;
    if (svgRootEl && child.dom) {
      measured = getElementRootBBox(child.dom as SVGGraphicsElement, svgRootEl) || undefined;
    }
    if (!measured) measured = measureTreeNode(child, baseMatrix, strokeCtx);
    const bbox = measured && (measured.width > 0 || measured.height > 0) ? normalizeBBox(measured, minSize) : undefined;

    const layerViewBox = bbox ? `${fmt(bbox.x)} ${fmt(bbox.y)} ${fmt(bbox.width)} ${fmt(bbox.height)}` : viewBox;
    const cw = bbox ? bbox.width : vbW;
    const ch = bbox ? bbox.height : vbH;
    // Explicit intrinsic size keeps rasterization crisp in every browser
    const k = Math.max(1, 256 / Math.max(cw, ch));
    const markup = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${nsDecls}` +
        ` viewBox="${layerViewBox}" width="${fmt(cw * k)}" height="${fmt(ch * k)}" preserveAspectRatio="none">` +
        `${header}${openContext}${child.outer()}${closeContext}</svg>`
    );

    const isContainer = child.tag === "g" || child.tag === "a" || child.tag === "switch";
    return {
      path: [...basePath, idx],
      id: uniqueId,
      name: label ? label.trim() : formatComponentLabel(ownId || `comp-${idx + 1}`, idx, fill, child.tag),
      tag: child.tag,
      isGroup: isContainer && resolveLayerChildren(child).children.length > 1,
      fill,
      stroke,
      strokeWidth,
      bbox,
      viewBox: layerViewBox,
      markup,
    };
  });
}

/** Small LRU cache: markup → (path → layers). Navigation never re-measures the same SVG twice. */
const layerCache = new Map<string, Map<string, SvgLayerInfo[] | null>>();
const LAYER_CACHE_LIMIT = 30;

/**
 * Returns the editable layers directly inside `containerPath` ([] = top level).
 * Single wrapper groups are unwrapped, exactly like Figma shows "Layer 1" contents.
 * Returns null when the path does not exist.
 */
export function getSvgLayerChildren(svgString: string, containerPath: number[] = []): SvgLayerInfo[] | null {
  if (!svgString || typeof svgString !== "string" || !svgString.includes("<svg")) return null;
  const pathKey = containerPath.join("/");
  let perMarkup = layerCache.get(svgString);
  if (perMarkup?.has(pathKey)) {
    // refresh LRU position
    layerCache.delete(svgString);
    layerCache.set(svgString, perMarkup);
    return perMarkup.get(pathKey) ?? null;
  }

  const result = computeSvgLayerChildren(svgString, containerPath);
  if (!perMarkup) {
    perMarkup = new Map();
    layerCache.set(svgString, perMarkup);
    if (layerCache.size > LAYER_CACHE_LIMIT) {
      const oldest = layerCache.keys().next().value;
      if (oldest !== undefined) layerCache.delete(oldest);
    }
  }
  perMarkup.set(pathKey, result);
  return result;
}

function computeSvgLayerChildren(svgString: string, containerPath: number[]): SvgLayerInfo[] | null {
  const viewBox = extractSvgViewBox(svgString);
  const [, , vbW, vbH] = parseViewBoxNumbers(viewBox, 500, 500);

  const analyze = (root: SvgTreeNode, svgRootEl: Element | null): SvgLayerInfo[] | null => {
    let container: LayerContainer | null = rootLayerContainer(root);
    for (const idx of containerPath) {
      container = descendLayerContainer(container, idx);
      if (!container) return null;
    }
    const defs = collectSharedDefs(root);
    const header = defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
    const nsDecls = attrsToString(namespaceDeclarations(root));
    return buildLayerChildren(container, containerPath, header, nsDecls, viewBox, svgRootEl);
  };

  // 1. Browser path: parse with DOMParser and measure on a live, invisible SVG
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined" && typeof document !== "undefined") {
    let holder: HTMLDivElement | null = null;
    try {
      const doc = new DOMParser().parseFromString(svgString, "image/svg+xml");
      const parsedSvg = doc.querySelector("svg");
      if (parsedSvg && !doc.querySelector("parsererror")) {
        let svgEl: Element = parsedSvg;
        if (document.body) {
          holder = document.createElement("div");
          holder.setAttribute("aria-hidden", "true");
          holder.style.cssText =
            "position:fixed;top:-10000px;left:-10000px;width:4000px;height:4000px;opacity:0;pointer-events:none;overflow:hidden;";
          const imported = document.importNode(parsedSvg, true) as SVGSVGElement;
          imported.setAttribute("width", String(vbW));
          imported.setAttribute("height", String(vbH));
          holder.appendChild(imported);
          document.body.appendChild(holder);
          svgEl = imported;
        }
        const layers = analyze(domToTree(svgEl), holder ? svgEl : null);
        if (layers) return layers;
      }
    } catch {
      // Fall through to the string parser
    } finally {
      if (holder && holder.parentNode) holder.parentNode.removeChild(holder);
    }
  }

  // 2. String parser path (Node.js / non-DOM environments)
  const tree = parseSvgMarkupTree(svgString);
  if (!tree) return null;
  return analyze(tree, null);
}

/** Returns a single layer by path (null if it does not exist) */
export function getSvgLayer(svgString: string, path: number[]): SvgLayerInfo | null {
  if (path.length === 0) return null;
  const siblings = getSvgLayerChildren(svgString, path.slice(0, -1));
  return siblings?.[path[path.length - 1]!] ?? null;
}

/**
 * Extracts distinct visual subcomponents/layers from an SVG illustration.
 * Each component is a standalone SVG that keeps inherited styling, shared
 * resources and a tight (stroke-inclusive) viewBox.
 */
export function extractSvgSubComponents(svgString: string): SvgSubComponent[] {
  const layers = getSvgLayerChildren(svgString, []) || [];
  return layers.map((layer) => ({
    id: layer.id,
    name: layer.name,
    tag: layer.tag,
    fill: layer.fill,
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    svgMarkup: layer.markup,
    viewBox: layer.viewBox,
    bbox: layer.bbox,
    isGroup: layer.isGroup,
  }));
}

/** Minimal element shape accepted by combineElementsIntoSvgGroup */
export interface CombinableSvgElement {
  id?: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  properties: {
    svgContent?: string;
    originalSvg?: string;
    fill?: string;
    stroke?: string;
  } & Record<string, unknown>;
}

export interface CombineSvgOptions {
  /** Rotation (deg) of the resulting group; members are laid out in this rotated frame. */
  frameRotation?: number;
  /** Opacity the resulting group element will carry; member opacity is stored relative to it. */
  baseOpacity?: number;
}

/**
 * Combines multiple independent canvas elements into a single composite SVG group
 * (Figma/BioRender regroup). Preserves each member's position, size, rotation,
 * opacity, styling and shared resources.
 */
export function combineElementsIntoSvgGroup(
  elements: CombinableSvgElement[],
  options: CombineSvgOptions = {}
): { svgMarkup: string; x: number; y: number; width: number; height: number; rotation: number } | null {
  if (!elements || elements.length === 0) return null;

  const theta = options.frameRotation || 0;
  const baseOpacity = options.baseOpacity ?? 1;
  const rad = (theta * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Express every member in the group's (possibly rotated) frame
  const frames = elements.map((el) => {
    const lx = cos * el.x + sin * el.y;
    const ly = -sin * el.x + cos * el.y;
    const r = (el.rotation || 0) - theta;
    const rr = (r * Math.PI) / 180;
    const rc = Math.cos(rr);
    const rs = Math.sin(rr);
    const w = Math.max(0.01, el.width);
    const h = Math.max(0.01, el.height);
    const corners: Array<[number, number]> = [
      [lx, ly],
      [lx + rc * w, ly + rs * w],
      [lx - rs * h, ly + rc * h],
      [lx + rc * w - rs * h, ly + rs * w + rc * h],
    ];
    return { el, lx, ly, r, w, h, corners };
  });

  const union = bboxFromPoints(frames.flatMap((f) => f.corners));
  if (!union) return null;
  const minX = union.x;
  const minY = union.y;
  const unionW = Math.max(1, Math.round(union.width * 100) / 100);
  const unionH = Math.max(1, Math.round(union.height * 100) / 100);

  const defs: string[] = [];
  const defsSeen = new Set<string>();
  const namespaces = new Map<string, string>();
  const usedIds = new Set<string>();
  let body = "";

  frames.forEach((frame, idx) => {
    const { el } = frame;
    const rawSvg = el.properties.svgContent || el.properties.originalSvg || "";
    const tree = parseSvgMarkupTree(rawSvg);
    if (!tree) return;

    for (const [n, v] of namespaceDeclarations(tree)) namespaces.set(n, v);

    let inner = "";
    for (const child of tree.children) {
      if (DEF_TAGS.has(child.tag)) {
        const items = child.tag === "defs" ? child.children.map((c) => c.outer()) : [child.outer()];
        for (const item of items) {
          if (!defsSeen.has(item)) {
            defsSeen.add(item);
            defs.push(item);
          }
        }
      } else if (child.tag !== "title" && child.tag !== "desc" && child.tag !== "metadata") {
        inner += child.outer();
      }
    }
    const rootAttrs = [...inheritableAttrs(tree, true), ...rootStyleAttr(tree)];
    if (rootAttrs.length > 0) inner = `<g${attrsToString(rootAttrs)}>${inner}</g>`;

    const vbAttr = getAttr(tree, "viewBox");
    const [vbX, vbY, vbW, vbH] = vbAttr
      ? parseViewBoxNumbers(vbAttr, frame.w, frame.h)
      : [0, 0, numAttr(tree, "width", frame.w) || frame.w, numAttr(tree, "height", frame.h) || frame.h];
    const sx = frame.w / vbW;
    const sy = frame.h / vbH;

    const parts = [`translate(${fmt(frame.lx - minX)} ${fmt(frame.ly - minY)})`];
    if (Math.abs(frame.r) > 0.001) parts.push(`rotate(${fmt(frame.r)})`);
    if (Math.abs(sx - 1) > 0.00001 || Math.abs(sy - 1) > 0.00001) parts.push(`scale(${fmtScale(sx)} ${fmtScale(sy)})`);
    if (vbX !== 0 || vbY !== 0) parts.push(`translate(${fmt(-vbX)} ${fmt(-vbY)})`);

    const baseName = el.name || `part-${idx + 1}`;
    const cleanBase =
      baseName
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || `part-${idx + 1}`;
    let cleanId = /^[a-z_]/.test(cleanBase) ? cleanBase : `part-${cleanBase}`;
    let counter = 2;
    while (usedIds.has(cleanId)) cleanId = `${cleanBase}-${counter++}`;
    usedIds.add(cleanId);

    const memberOpacity = el.opacity ?? 1;
    const relativeOpacity = baseOpacity > 0 ? Math.min(1, memberOpacity / baseOpacity) : memberOpacity;
    const opacityAttr = relativeOpacity < 0.999 ? ` opacity="${fmt(relativeOpacity)}"` : "";

    body += `<g id="${escapeAttr(cleanId)}" data-name="${escapeAttr(baseName)}" transform="${parts.join(" ")}"${opacityAttr}>${inner}</g>`;
  });

  const nsAttrs = attrsToString(Array.from(namespaces.entries()));
  const defsSection = defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
  const svgMarkup = sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${nsAttrs} viewBox="0 0 ${fmt(unionW)} ${fmt(unionH)}" width="${fmt(unionW)}" height="${fmt(unionH)}">${defsSection}${body}</svg>`
  );

  // Back from the rotated frame to canvas coordinates
  const originX = cos * minX - sin * minY;
  const originY = sin * minX + cos * minY;

  return {
    svgMarkup,
    x: Math.round(originX * 100) / 100,
    y: Math.round(originY * 100) / 100,
    width: unionW,
    height: unionH,
    rotation: theta,
  };
}

/**
 * Decomposes an SVG string into individual standalone SVG component elements
 */
export function decomposeSvgComponents(
  svgString: string,
  parentName?: string
): DecomposedSvgElement[] {
  const subComponents = extractSvgSubComponents(svgString);
  if (subComponents.length === 0) return [];

  const prefix = parentName ? `${parentName} — ` : "";

  return subComponents.map((comp, idx) => ({
    id: `decomp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
    name: prefix && !comp.name.startsWith(prefix) ? `${prefix}${comp.name}` : comp.name,
    svgContent: comp.svgMarkup,
    fill: comp.fill,
    stroke: comp.stroke,
    strokeWidth: comp.strokeWidth,
    bbox: comp.bbox,
    isGroup: comp.isGroup,
  }));
}

/**
 * Returns true when an SVG has more than one independently editable layer,
 * i.e. double-clicking / ungrouping it would reveal sub-parts.
 */
export function svgHasEditableLayers(svgString: string): boolean {
  if (!svgString || !svgString.includes("<svg")) return false;
  const tree = parseSvgMarkupTree(svgString);
  if (!tree) return false;
  return resolveLayerChildren(tree).children.length > 1;
}

// ==========================================
// In-place layer editing
// ------------------------------------------
// Edits rewrite only the targeted tags of the original markup (by source offset),
// so everything else in the illustration stays byte-for-byte identical.
// ==========================================

interface LocatedLayer {
  root: SvgTreeNode;
  node: SvgTreeNode;
  /** Every element between the root and the layer (wrappers included), outermost first */
  ancestors: SvgTreeNode[];
}

interface Splice {
  start: number;
  end: number;
  text: string;
}

const SHAPE_TAGS = new Set(["path", "circle", "rect", "ellipse", "polygon", "polyline", "line", "text", "tspan", "use"]);

function locateSvgLayer(markup: string, path: number[]): LocatedLayer | null {
  if (!path.length) return null;
  const root = parseSvgMarkupTree(markup);
  if (!root) return null;
  let container = root;
  const ancestors: SvgTreeNode[] = [];
  for (let i = 0; i < path.length; i++) {
    const { wrappers, children } = resolveLayerChildren(container);
    const child = children[path[i]!];
    if (!child || !child.src) return null;
    ancestors.push(...wrappers);
    if (i < path.length - 1) ancestors.push(child);
    container = child;
  }
  return { root, node: container, ancestors };
}

function applySplices(markup: string, splices: Splice[]): string {
  let out = markup;
  for (const sp of [...splices].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, sp.start) + sp.text + out.slice(sp.end);
  }
  return out;
}

function openTagWithEdits(node: SvgTreeNode, edits: Record<string, string | null>): string {
  const attrs: Array<[string, string]> = node.attrs.map(([n, v]) => [n, v]);
  for (const [name, value] of Object.entries(edits)) {
    const idx = attrs.findIndex(([n]) => n.toLowerCase() === name.toLowerCase());
    if (value === null) {
      if (idx >= 0) attrs.splice(idx, 1);
    } else if (idx >= 0) {
      attrs[idx] = [attrs[idx]![0], value];
    } else {
      attrs.push([name, value]);
    }
  }
  return `<${node.src!.rawName}${attrsToString(attrs)}${node.src!.selfClosing ? "/>" : ">"}`;
}

function attrSplice(node: SvgTreeNode, edits: Record<string, string | null>): Splice {
  return { start: node.src!.start, end: node.src!.openEnd, text: openTagWithEdits(node, edits) };
}

function matrixToTransform(m: SvgMatrix): string {
  const r = (n: number) => String(Math.round(n * 1e6) / 1e6);
  const isTranslate = Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[1]) < 1e-9 && Math.abs(m[2]) < 1e-9 && Math.abs(m[3] - 1) < 1e-9;
  return isTranslate ? `translate(${r(m[4])} ${r(m[5])})` : `matrix(${m.map(r).join(" ")})`;
}

/** Computes the layer's new own transform so that it moves by `deltaRoot` (root viewBox space) */
function movedOwnTransform(loc: LocatedLayer, deltaRoot: SvgMatrix): SvgMatrix {
  const parent = loc.ancestors.reduce<SvgMatrix>(
    (m, a) => multiplyMatrix(m, parseSvgTransform(getAttr(a, "transform"))),
    IDENTITY_MATRIX
  );
  const own = parseSvgTransform(getAttr(loc.node, "transform"));
  return multiplyMatrix(multiplyMatrix(multiplyMatrix(invertSvgMatrix(parent), deltaRoot), parent), own);
}

/** Moves / scales / rotates a layer by an affine delta expressed in root viewBox space */
export function transformSvgLayer(markup: string, path: number[], deltaRoot: SvgMatrix): string | null {
  const loc = locateSvgLayer(markup, path);
  if (!loc) return null;
  return applySplices(markup, [attrSplice(loc.node, { transform: matrixToTransform(movedOwnTransform(loc, deltaRoot)) })]);
}

/** Removes a layer */
export function removeSvgLayer(markup: string, path: number[]): string | null {
  const loc = locateSvgLayer(markup, path);
  if (!loc) return null;
  return applySplices(markup, [{ start: loc.node.src!.start, end: loc.node.src!.end, text: "" }]);
}

/** Inserts a copy of a layer right above it, offset by `deltaRoot`. The copy is at path[last] + 1. */
export function duplicateSvgLayer(markup: string, path: number[], deltaRoot: SvgMatrix): string | null {
  const loc = locateSvgLayer(markup, path);
  if (!loc) return null;
  const src = loc.node.src!;
  const openTag = openTagWithEdits(loc.node, {
    id: null,
    transform: matrixToTransform(movedOwnTransform(loc, deltaRoot)),
  });
  const copy = openTag + markup.slice(src.openEnd, src.end);
  return applySplices(markup, [{ start: src.end, end: src.end, text: copy }]);
}

/** Temporarily hides a layer (used for live drag previews) */
export function hideSvgLayer(markup: string, path: number[]): string | null {
  const loc = locateSvgLayer(markup, path);
  if (!loc) return null;
  return applySplices(markup, [attrSplice(loc.node, { display: "none" })]);
}

/**
 * Dissolves a nested group: its children take its place, with the group's transform and
 * inherited styling pushed down onto each child (Figma "Ungroup" on a nested group).
 */
export function ungroupSvgLayer(markup: string, path: number[]): { markup: string; childCount: number } | null {
  const loc = locateSvgLayer(markup, path);
  if (!loc || loc.node.src!.selfClosing) return null;
  const group = loc.node;
  const elementChildren = group.children.filter((c) => c.src);
  const visualCount = elementChildren.filter((c) => VISUAL_TAGS.has(c.tag)).length;
  if (visualCount === 0) return null;

  const groupTransform = getAttr(group, "transform")?.trim() || "";
  const groupOpacity = parseFloat(getAttr(group, "opacity") || "1");
  const groupClass = getAttr(group, "class")?.trim() || "";
  const inherited = inheritableAttrs(group, false).filter(([n]) => {
    const lower = n.toLowerCase();
    return !["id", "transform", "opacity", "class"].includes(lower);
  });

  const pieces = elementChildren.map((child) => {
    const childSrc = child.src!;
    if (!VISUAL_TAGS.has(child.tag)) return markup.slice(childSrc.start, childSrc.end);
    const edits: Record<string, string | null> = {};
    const childTransform = getAttr(child, "transform")?.trim() || "";
    if (groupTransform) edits.transform = `${groupTransform} ${childTransform}`.trim();
    if (!isNaN(groupOpacity) && groupOpacity < 1) {
      const own = parseFloat(getAttr(child, "opacity") || "1");
      edits.opacity = String(Math.round((isNaN(own) ? 1 : own) * groupOpacity * 1000) / 1000);
    }
    if (groupClass) {
      const own = getAttr(child, "class")?.trim();
      edits.class = own ? `${own} ${groupClass}` : groupClass;
    }
    for (const [name, value] of inherited) {
      if (getAttr(child, name) === undefined) edits[name] = value;
    }
    return openTagWithEdits(child, edits) + markup.slice(childSrc.openEnd, childSrc.end);
  });

  return {
    markup: applySplices(markup, [{ start: group.src!.start, end: group.src!.end, text: pieces.join("") }]),
    childCount: visualCount,
  };
}

function setStyleDeclaration(style: string, prop: string, value: string): string {
  const decls = style
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d && d.split(":")[0]!.trim().toLowerCase() !== prop);
  decls.push(`${prop}:${value}`);
  return decls.join(";");
}

/** Which properties (fill / stroke) each CSS class sets to a visible value */
function cssClassPaint(root: SvgTreeNode): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const walk = (node: SvgTreeNode) => {
    for (const child of node.children) {
      if (child.tag === "style") {
        const css = child.outer().replace(/<\/?style[^>]*>/gi, "").replace(/<!\[CDATA\[|\]\]>/g, "");
        const ruleRe = /([^{}]+)\{([^}]*)\}/g;
        let rule: RegExpExecArray | null;
        while ((rule = ruleRe.exec(css)) !== null) {
          const props = new Set<string>();
          for (const decl of (rule[2] || "").split(";")) {
            const [p, v] = decl.split(":").map((x) => x?.trim().toLowerCase());
            if ((p === "fill" || p === "stroke") && v && v !== "none") props.add(p);
          }
          if (props.size === 0) continue;
          for (const sel of (rule[1] || "").split(",")) {
            const m = sel.trim().match(/\.([\w-]+)$/);
            if (!m || !m[1]) continue;
            const set = result.get(m[1]) || new Set<string>();
            props.forEach((p) => set.add(p));
            result.set(m[1], set);
          }
        }
      } else {
        walk(child);
      }
    }
  };
  walk(root);
  return result;
}

/**
 * Recolors a layer and everything inside it. Inline styles are used so the new colors also
 * win over CSS classes (Illustrator exports). Parts without a stroke never gain one.
 */
export function recolorSvgLayer(
  markup: string,
  path: number[],
  colors: { fill?: string; stroke?: string; strokeWidth?: number }
): string | null {
  const loc = locateSvgLayer(markup, path);
  if (!loc) return null;
  const classPaint = cssClassPaint(loc.root);
  const classHas = (node: SvgTreeNode, prop: string) =>
    (getAttr(node, "class") || "").split(/\s+/).some((c) => classPaint.get(c)?.has(prop));
  const paints = (node: SvgTreeNode, prop: string) => {
    const v = getPresentation(node, prop);
    if (v !== undefined) return v !== "none" && v !== "transparent";
    return classHas(node, prop);
  };

  const targets: SvgTreeNode[] = [];
  const walk = (node: SvgTreeNode) => {
    targets.push(node);
    node.children.forEach((c) => {
      if (!DEF_TAGS.has(c.tag) && c.src) walk(c);
    });
  };
  walk(loc.node);

  const splices: Splice[] = [];
  for (const t of targets) {
    const self = t === loc.node;
    const isShape = SHAPE_TAGS.has(t.tag);
    let style = getAttr(t, "style") || "";
    const edits: Record<string, string | null> = {};

    if (colors.fill !== undefined && t.tag !== "line") {
      const current = getPresentation(t, "fill");
      const explicitNone = current === "none";
      if ((self && !(isShape && explicitNone && colors.fill === "none")) || (!explicitNone && paints(t, "fill"))) {
        style = setStyleDeclaration(style, "fill", colors.fill);
        edits.fill = null;
      }
    }
    const strokeTarget = paints(t, "stroke") || (self && isShape);
    if (colors.stroke !== undefined && strokeTarget) {
      style = setStyleDeclaration(style, "stroke", colors.stroke);
      edits.stroke = null;
    }
    if (colors.strokeWidth !== undefined && strokeTarget) {
      style = setStyleDeclaration(style, "stroke-width", String(colors.strokeWidth));
      edits["stroke-width"] = null;
    }
    if (Object.keys(edits).length > 0) {
      edits.style = style;
      splices.push(attrSplice(t, edits));
    }
  }
  return splices.length > 0 ? applySplices(markup, splices) : markup;
}

/** Sets the root viewBox (and a matching intrinsic size) */
export function setSvgRootViewBox(markup: string, vb: { x: number; y: number; width: number; height: number }): string {
  const root = parseSvgMarkupTree(markup);
  if (!root || !root.src) return markup;
  return applySplices(markup, [
    attrSplice(root, {
      viewBox: `${fmt(vb.x)} ${fmt(vb.y)} ${fmt(vb.width)} ${fmt(vb.height)}`,
      width: fmt(vb.width),
      height: fmt(vb.height),
    }),
  ]);
}

/** Union bounds of all top-level layers in root viewBox space */
export function getSvgContentBounds(markup: string): { x: number; y: number; width: number; height: number } | null {
  const layers = getSvgLayerChildren(markup, []);
  if (!layers || layers.length === 0) return null;
  let acc: BBox | undefined;
  for (const layer of layers) acc = unionBBox(acc, layer.bbox);
  return acc || null;
}

/**
 * Modifies the color of an individual component inside an SVG without decomposing it
 */
export function modifySvgComponentColor(
  svgString: string,
  componentIdOrIndex: string | number,
  colors: { fill?: string; stroke?: string; strokeWidth?: number }
): string {
  if (!svgString || typeof svgString !== "string") return "";
  const { fill, stroke, strokeWidth } = colors;

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, "image/svg+xml");
      const svg = doc.querySelector("svg");

      if (svg) {
        let targetEl: Element | null = null;
        if (typeof componentIdOrIndex === "string") {
          targetEl = svg.querySelector(`#${CSS.escape(componentIdOrIndex)}`);
        }

        if (!targetEl) {
          // Resolve layers exactly like extractSvgSubComponents (single wrapper groups unwrapped)
          const isVisual = (el: Element) => VISUAL_TAGS.has((el.localName || el.tagName).toLowerCase());
          let children = Array.from(svg.children).filter(isVisual);
          while (children.length === 1 && (children[0]!.localName || "").toLowerCase() === "g") {
            const inner = Array.from(children[0]!.children).filter(isVisual);
            if (inner.length === 0) break;
            children = inner;
          }
          const idx = typeof componentIdOrIndex === "number" ? componentIdOrIndex : 0;
          targetEl = children[idx] || null;
        }

        if (targetEl) {
          const isLineTag = targetEl.tagName.toLowerCase() === "line";
          if (fill && !isLineTag) {
            targetEl.setAttribute("fill", fill);
            const subShapes = targetEl.querySelectorAll("path, circle, rect, ellipse, polygon");
            subShapes.forEach((s) => {
              if (s.getAttribute("fill") !== "none") s.setAttribute("fill", fill);
            });
          }
          if (stroke) {
            targetEl.setAttribute("stroke", stroke);
            const subShapes = targetEl.querySelectorAll("path, circle, rect, ellipse, polygon, polyline, line");
            subShapes.forEach((s) => {
              if (s.getAttribute("stroke") !== "none") s.setAttribute("stroke", stroke);
            });
          }
          if (strokeWidth !== undefined) {
            targetEl.setAttribute("stroke-width", String(strokeWidth));
            const subShapes = targetEl.querySelectorAll("path, circle, rect, ellipse, polygon, polyline, line");
            subShapes.forEach((s) => {
              s.setAttribute("stroke-width", String(strokeWidth));
            });
          }
          return new XMLSerializer().serializeToString(doc);
        }
      }
    } catch {
      // Fallback to regex
    }
  }

  // Regex fallback: replace fill/stroke on the specific target element
  if (typeof componentIdOrIndex === "string") {
    const idRegex = new RegExp(`(<[^>]*id=["']${componentIdOrIndex}["'][^>]*>)`, "i");
    return svgString.replace(idRegex, (match) => {
      let updated = match;
      if (fill) {
        if (/fill=["'][^"']*["']/i.test(updated)) {
          updated = updated.replace(/fill=["'][^"']*["']/i, `fill="${fill}"`);
        } else {
          updated = updated.replace(/>$/, ` fill="${fill}">`);
        }
      }
      if (stroke) {
        if (/stroke=["'][^"']*["']/i.test(updated)) {
          updated = updated.replace(/stroke=["'][^"']*["']/i, `stroke="${stroke}"`);
        } else {
          updated = updated.replace(/>$/, ` stroke="${stroke}">`);
        }
      }
      if (strokeWidth !== undefined) {
        if (/stroke-width=["'][^"']*["']/i.test(updated)) {
          updated = updated.replace(/stroke-width=["'][^"']*["']/i, `stroke-width="${strokeWidth}"`);
        } else {
          updated = updated.replace(/>$/, ` stroke-width="${strokeWidth}">`);
        }
      }
      return updated;
    });
  }

  return modifySvgColors(svgString, { fill, stroke, strokeWidth });
}

/**
 * Applies a scientific color preset (e.g. Bio Red, Bio Blue) to an SVG or its component
 */
export function applyScientificPreset(
  svgString: string,
  presetIdOrPreset: string | ScientificColorPreset,
  componentIdOrIndex?: string | number
): string {
  const preset =
    typeof presetIdOrPreset === "string"
      ? SCIENTIFIC_COLOR_PRESETS.find((p) => p.id === presetIdOrPreset) || SCIENTIFIC_COLOR_PRESETS[0]!
      : presetIdOrPreset;

  if (componentIdOrIndex !== undefined && componentIdOrIndex !== null) {
    return modifySvgComponentColor(svgString, componentIdOrIndex, {
      fill: preset.primary,
      stroke: preset.secondary,
    });
  }

  // Apply to entire SVG
  return modifySvgColors(svgString, {
    fill: preset.primary,
    stroke: preset.secondary,
  });
}

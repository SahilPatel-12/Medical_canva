/**
 * SVG Utilities for parsing, sanitizing, remote fetching, and vector color tuning
 */

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
  if (!svgString || typeof svgString !== "string" || !svgString.includes("<svg")) {
    return [];
  }

  const colors = new Set<string>();

  // Browser DOMParser
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, "image/svg+xml");
      const elements = doc.querySelectorAll("*");

      elements.forEach((el) => {
        const fill = el.getAttribute("fill");
        if (fill && fill !== "none" && fill !== "transparent" && !fill.startsWith("url(")) {
          colors.add(fill.toLowerCase());
        }
        const stroke = el.getAttribute("stroke");
        if (stroke && stroke !== "none" && stroke !== "transparent" && !stroke.startsWith("url(")) {
          colors.add(stroke.toLowerCase());
        }
      });

      if (colors.size > 0) {
        return Array.from(colors).slice(0, 12);
      }
    } catch {
      // Fallback to regex
    }
  }

  // Regex fallback for colors (hex or rgb)
  const hexMatches = svgString.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g);
  if (hexMatches) {
    hexMatches.forEach((c) => colors.add(c.toLowerCase()));
  }

  return Array.from(colors).slice(0, 12);
}

/**
 * Modifies fill and stroke colors in an SVG string without rasterizing.
 * Supports global fill/stroke override OR targeted color replacement via colorMap.
 */
export function modifySvgColors(
  svgString: string,
  fillOrOptions?: string | { fill?: string; stroke?: string; colorMap?: Record<string, string> },
  strokeArg?: string,
  colorMapArg?: Record<string, string>
): string {
  if (!svgString || typeof svgString !== "string") return "";

  let fill: string | undefined;
  let stroke: string | undefined;
  let colorMap: Record<string, string> | undefined;

  if (typeof fillOrOptions === "object" && fillOrOptions !== null) {
    fill = fillOrOptions.fill;
    stroke = fillOrOptions.stroke;
    colorMap = fillOrOptions.colorMap;
  } else {
    fill = fillOrOptions;
    stroke = strokeArg;
    colorMap = colorMapArg;
  }

  // If input is an HTTP URL rather than XML, we cannot modify it via string operations
  if (svgString.startsWith("http://") || svgString.startsWith("https://")) {
    return svgString;
  }

  // If running in browser with DOMParser support
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, "image/svg+xml");
      const svg = doc.querySelector("svg");

      if (svg) {
        const elements = svg.querySelectorAll(
          "path, rect, circle, ellipse, polygon, polyline, line, g"
        );

        elements.forEach((el) => {
          // 1. Color map replacement
          if (colorMap && Object.keys(colorMap).length > 0) {
            const currentFill = el.getAttribute("fill")?.toLowerCase();
            if (currentFill && colorMap[currentFill]) {
              el.setAttribute("fill", colorMap[currentFill]);
            }
            const currentStroke = el.getAttribute("stroke")?.toLowerCase();
            if (currentStroke && colorMap[currentStroke]) {
              el.setAttribute("stroke", colorMap[currentStroke]);
            }
          }

          // 2. Global fill override
          if (fill) {
            const currentFill = el.getAttribute("fill");
            if (currentFill && currentFill !== "none" && currentFill !== "transparent") {
              el.setAttribute("fill", fill);
            }

            const style = el.getAttribute("style");
            if (style && /fill\s*:/i.test(style)) {
              el.setAttribute("style", style.replace(/fill\s*:\s*[^;]+/gi, `fill: ${fill}`));
            }
          }

          // 3. Global stroke override
          if (stroke) {
            const currentStroke = el.getAttribute("stroke");
            if (currentStroke && currentStroke !== "none" && currentStroke !== "transparent") {
              el.setAttribute("stroke", stroke);
            }

            const style = el.getAttribute("style");
            if (style && /stroke\s*:/i.test(style)) {
              el.setAttribute("style", style.replace(/stroke\s*:\s*[^;]+/gi, `stroke: ${stroke}`));
            }
          }
        });

        // Also if root SVG has a non-none fill
        if (fill && svg.getAttribute("fill") && svg.getAttribute("fill") !== "none") {
          svg.setAttribute("fill", fill);
        }

        return new XMLSerializer().serializeToString(doc);
      }
    } catch {
      // Fallback to regex below
    }
  }

  // Regex fallback
  let modified = svgString;
  if (colorMap) {
    for (const [from, to] of Object.entries(colorMap)) {
      const regex = new RegExp(`(fill|stroke)="\\s*${from}\\s*"`, "gi");
      modified = modified.replace(regex, `$1="${to}"`);
    }
  }
  if (fill) {
    modified = modified.replace(/fill="((?!none|transparent)[^"]*)"/gi, `fill="${fill}"`);
  }
  if (stroke) {
    modified = modified.replace(/stroke="((?!none|transparent)[^"]*)"/gi, `stroke="${stroke}"`);
  }

  return modified;
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

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      svgImageCache.set(svgString, img);
      pendingSvgLoads.delete(svgString);
      resolve(img);
    };
    img.onerror = (err) => {
      pendingSvgLoads.delete(svgString);
      reject(err);
    };
    img.src = svgToDataUrl(svgString);
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

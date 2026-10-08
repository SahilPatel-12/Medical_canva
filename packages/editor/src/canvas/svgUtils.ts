/**
 * SVG Utilities for parsing and non-destructive vector color editing
 */

/**
 * Modifies fill and stroke colors in an SVG string without rasterizing
 */
export function modifySvgColors(svgString: string, fill?: string, stroke?: string): string {
  if (!svgString) return "";

  // If running in browser with DOMParser support
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, "image/svg+xml");
      const svg = doc.querySelector("svg");

      if (svg) {
        // Collect all vector elements that can hold fill or stroke
        const elements = svg.querySelectorAll(
          "path, rect, circle, ellipse, polygon, polyline, line"
        );

        elements.forEach((el) => {
          // If fill is provided, update existing fills (unless explicitly "none" or "transparent")
          if (fill) {
            const currentFill = el.getAttribute("fill");
            if (currentFill !== "none" && currentFill !== "transparent") {
              el.setAttribute("fill", fill);
            }

            // Also check inline style fill
            const style = el.getAttribute("style");
            if (style && /fill\s*:/i.test(style)) {
              el.setAttribute("style", style.replace(/fill\s*:\s*[^;]+/gi, `fill: ${fill}`));
            }
          }

          // If stroke is provided
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

        // Also if the root SVG has a fill attribute (and no children override), set root fill
        if (fill && svg.getAttribute("fill") && svg.getAttribute("fill") !== "none") {
          svg.setAttribute("fill", fill);
        }

        return new XMLSerializer().serializeToString(doc);
      }
    } catch {
      // Fallback to regex replacement below if DOMParser fails
    }
  }

  // Regex fallback
  let modified = svgString;
  if (fill) {
    // Replace fill="..." where value is not "none" or "transparent"
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
  // Clean up and encode UTF-8
  const encoded = encodeURIComponent(svgString).replace(/'/g, "%27").replace(/"/g, "%22");
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
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

    // Helper to finish
    const finish = (resultImg: HTMLImageElement) => {
      if (resolved) return;
      resolved = true;
      urlImageCache.set(url, resultImg);
      pendingUrlLoads.delete(url);
      resolve(resultImg);
    };

    // Attempt 1: with direct crossOrigin="anonymous"
    const imgWithCors = new window.Image();
    imgWithCors.crossOrigin = "anonymous";

    imgWithCors.onload = () => finish(imgWithCors);

    imgWithCors.onerror = () => {
      if (resolved) return;

      // Attempt 2: via local Next.js proxy endpoint (preserves CORS & avoids tainting canvas)
      const proxyUrl = `/api/assets/proxy?url=${encodeURIComponent(url)}`;
      const proxyImg = new window.Image();
      proxyImg.crossOrigin = "anonymous";
      proxyImg.onload = () => finish(proxyImg);

      proxyImg.onerror = () => {
        if (resolved) return;

        // Attempt 3: fallback without crossOrigin (renders image, but taints canvas)
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


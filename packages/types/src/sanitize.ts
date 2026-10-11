import type { Page, DesignElement, ElementProperties } from "./index";

/**
 * Detects if an object is a DOM node, React FiberNode, or browser Event
 */
export function isDomOrFiberNode(val: unknown): boolean {
  if (!val || typeof val !== "object") return false;

  const obj = val as Record<string, unknown>;

  // Native DOM node
  if ("nodeType" in obj || "ownerDocument" in obj) return true;

  // React SyntheticEvent or native browser Event
  if (
    "nativeEvent" in obj ||
    "syntheticEvent" in obj ||
    ("target" in obj && "currentTarget" in obj && "bubbles" in obj)
  ) {
    return true;
  }

  // React FiberNode / internals
  if ("stateNode" in obj || "_reactInternals" in obj) return true;

  // Constructor name checks
  const ctorName = (val as { constructor?: { name?: string } }).constructor?.name;
  if (
    ctorName &&
    (ctorName.includes("SVG") ||
      ctorName.includes("Element") ||
      ctorName.includes("Node") ||
      ctorName.includes("Fiber") ||
      ctorName.includes("Synthetic") ||
      ctorName.includes("Event"))
  ) {
    return true;
  }

  // React fiber property pattern on DOM elements
  for (const k of Object.keys(obj)) {
    if (k.startsWith("__reactFiber$") || k.startsWith("__reactProps$") || k.startsWith("__reactEvents$")) {
      return true;
    }
  }

  return false;
}

/**
 * Deeply sanitizes any nested object, breaking circular loops and omitting DOM/Fiber nodes.
 */
function sanitizeObjectDeep(val: unknown, seen: Set<unknown>): unknown {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return val;
  if (typeof val !== "object") return undefined;
  if (isDomOrFiberNode(val)) return undefined;

  if (seen.has(val)) return undefined; // Circular reference broken
  seen.add(val);

  if (Array.isArray(val)) {
    return val
      .map((item) => sanitizeObjectDeep(item, seen))
      .filter((item) => item !== undefined);
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (
      k.startsWith("__react") ||
      k === "stateNode" ||
      k === "_reactInternals" ||
      typeof v === "function" ||
      typeof v === "symbol"
    ) {
      continue;
    }
    const cleanV = sanitizeObjectDeep(v, seen);
    if (cleanV !== undefined) {
      result[k] = cleanV;
    }
  }
  return result;
}

/**
 * Strips circular structures, DOM elements (like SVGSVGElement), React Fiber nodes,
 * functions, and non-serializable objects from element properties.
 */
export function sanitizeProperties(props: unknown): ElementProperties {
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    return {};
  }

  if (isDomOrFiberNode(props)) {
    return {};
  }

  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (
      key.startsWith("__reactFiber$") ||
      key.startsWith("__reactProps$") ||
      key.startsWith("__reactEvents$") ||
      key === "stateNode" ||
      key === "_reactInternals"
    ) {
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
      continue;
    }

    if (typeof value !== "object") {
      continue;
    }

    if (isDomOrFiberNode(value)) {
      continue;
    }

    if (Array.isArray(value)) {
      clean[key] = value.filter(
        (item) =>
          (typeof item === "string" || typeof item === "number" || typeof item === "boolean") &&
          !isDomOrFiberNode(item)
      );
      continue;
    }

    try {
      const sanitizedNested = sanitizeObjectDeep(value, new Set([props]));
      if (sanitizedNested !== undefined) {
        clean[key] = sanitizedNested;
      }
    } catch {
      // Omit non-serializable property
    }
  }

  return clean as ElementProperties;
}

/**
 * Cleans an array of Pages ensuring all pages and elements are pure JSON serializable objects.
 */
export function sanitizePages(pages: Page[] | unknown): Page[] {
  if (!Array.isArray(pages)) return [];

  return pages.map((page, index) => {
    if (!page || typeof page !== "object") {
      return {
        id: `page-${index + 1}`,
        name: `Page ${index + 1}`,
        elements: [],
      };
    }

    const p = page as Record<string, unknown>;

    // Ensure page name is strictly a primitive string
    const rawName = p.name;
    const pageName =
      typeof rawName === "string" && rawName.trim().length > 0
        ? rawName.trim()
        : `Page ${index + 1}`;

    const rawThumb = p.thumbnail;
    const pageThumbnail =
      typeof rawThumb === "string" && rawThumb.trim().length > 0
        ? rawThumb.trim()
        : undefined;

    const rawElements = Array.isArray(p.elements) ? p.elements : [];
    const elements: DesignElement[] = rawElements
      .filter((el): el is Record<string, unknown> => Boolean(el && typeof el === "object" && !isDomOrFiberNode(el)))
      .map((el, elIndex) => {
        const id = typeof el.id === "string" ? el.id : `elem-${Date.now()}-${elIndex}`;
        const rawType = typeof el.type === "string" ? el.type : "shape";
        const type = (["svg", "shape", "text", "image"].includes(rawType)
          ? rawType
          : "shape") as DesignElement["type"];

        return {
          id,
          type,
          name: typeof el.name === "string" ? el.name : undefined,
          x: Number(el.x) || 0,
          y: Number(el.y) || 0,
          width: Number(el.width) || 100,
          height: Number(el.height) || 100,
          rotation: Number(el.rotation) || 0,
          opacity: typeof el.opacity === "number" ? el.opacity : 1,
          locked: Boolean(el.locked),
          visible: el.visible !== false,
          properties: sanitizeProperties(el.properties),
        };
      });

    return {
      id: typeof p.id === "string" ? p.id : `page-${index + 1}`,
      name: pageName,
      thumbnail: pageThumbnail,
      elements,
    };
  });
}

import { Asset } from "@design-platform/types";

/**
 * Built-in assets shipped with the editor: basic shapes only.
 * Scientific illustrations (cells, proteins, anatomy…) are served from the asset
 * store (Cloudflare R2 + the assets table), not hard-coded here.
 */
export const SAMPLE_ASSETS: Asset[] = [
  // ==========================================
  // Arrows and Shapes (the scientific library itself comes from the asset store)
  // ==========================================
  {
    id: "asset-shape-rect",
    name: "Rectangle Artboard",
    type: "shape",
    category: "Arrows and Shapes",
    categorySlug: "arrows-and-shapes",
    subcategorySlug: "shapes-2d",
    subcategoryName: "Shapes - 2D",
    defaultWidth: 160,
    defaultHeight: 100,
    tags: ["rectangle", "box", "square", "shape"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect x="10" y="20" width="80" height="60" rx="6" fill="#3b82f6"/>
    </svg>`,
  },
  {
    id: "asset-shape-circle",
    name: "Circle Vector",
    type: "shape",
    category: "Arrows and Shapes",
    categorySlug: "arrows-and-shapes",
    subcategorySlug: "shapes-2d",
    subcategoryName: "Shapes - 2D",
    defaultWidth: 120,
    defaultHeight: 120,
    tags: ["circle", "round", "oval", "shape"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <circle cx="50" cy="50" r="40" fill="#10b981"/>
    </svg>`,
  },
  {
    id: "asset-shape-arrow-right",
    name: "Pathway Arrow (Right)",
    type: "svg",
    category: "Arrows and Shapes",
    categorySlug: "arrows-and-shapes",
    subcategorySlug: "arrows-and-lines",
    subcategoryName: "Arrows and lines",
    defaultWidth: 160,
    defaultHeight: 90,
    tags: ["arrow", "right", "direction", "flow", "pointer", "pathway"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <path d="M 15 42 L 55 42 L 55 24 L 88 50 L 55 76 L 55 58 L 15 58 Z" fill="#8b5cf6"/>
    </svg>`,
  },
  {
    id: "asset-shape-star",
    name: "Star Badge",
    type: "svg",
    category: "Arrows and Shapes",
    categorySlug: "arrows-and-shapes",
    subcategorySlug: "shapes-2d",
    subcategoryName: "Shapes - 2D",
    defaultWidth: 130,
    defaultHeight: 130,
    tags: ["star", "favorite", "badge", "shape"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <polygon points="50,10 63,38 94,40 70,60 78,90 50,74 22,90 30,60 6,40 37,38" fill="#f59e0b"/>
    </svg>`,
  },
  {
    id: "asset-shape-hexagon",
    name: "Hexagon Ring",
    type: "svg",
    category: "Arrows and Shapes",
    categorySlug: "arrows-and-shapes",
    subcategorySlug: "shapes-2d",
    subcategoryName: "Shapes - 2D",
    defaultWidth: 140,
    defaultHeight: 130,
    tags: ["hexagon", "polygon", "benzene", "structure", "ring"],
    source: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <polygon points="50,12 85,32 85,68 50,88 15,68 15,32" fill="#06b6d4" stroke="#0891b2" stroke-width="3" stroke-linejoin="round"/>
    </svg>`,
  },
];

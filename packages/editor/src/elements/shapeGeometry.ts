import type { PolygonShapeType, ShapeType } from "@design-platform/types";

/**
 * Outlines of polygon shapes as [x0, y0, x1, y1, ...] in a unit box (0..1).
 * They are scaled to the element's width/height, so every shape resizes freely.
 */
export const SHAPE_POLYGONS: Record<PolygonShapeType, number[]> = {
  triangle: [0.5, 0, 1, 1, 0, 1],
  "right-triangle": [0, 0, 1, 1, 0, 1],
  diamond: [0.5, 0, 1, 0.5, 0.5, 1, 0, 0.5],
  pentagon: regular(5),
  hexagon: [0.25, 0, 0.75, 0, 1, 0.5, 0.75, 1, 0.25, 1, 0, 0.5],
  octagon: [0.3, 0, 0.7, 0, 1, 0.3, 1, 0.7, 0.7, 1, 0.3, 1, 0, 0.7, 0, 0.3],
  star: star(5, 0.4),
  plus: [0.35, 0, 0.65, 0, 0.65, 0.35, 1, 0.35, 1, 0.65, 0.65, 0.65, 0.65, 1, 0.35, 1, 0.35, 0.65, 0, 0.65, 0, 0.35, 0.35, 0.35],
  arrow: [0, 0.3, 0.6, 0.3, 0.6, 0, 1, 0.5, 0.6, 1, 0.6, 0.7, 0, 0.7],
  chevron: [0, 0, 0.7, 0, 1, 0.5, 0.7, 1, 0, 1, 0.3, 0.5],
  parallelogram: [0.25, 0, 1, 0, 0.75, 1, 0, 1],
  trapezoid: [0.2, 0, 0.8, 0, 1, 1, 0, 1],
};

export const POLYGON_SHAPE_TYPES = Object.keys(SHAPE_POLYGONS) as PolygonShapeType[];

export function isPolygonShape(type: ShapeType | string | undefined): type is PolygonShapeType {
  return Boolean(type && type in SHAPE_POLYGONS);
}

/** Polygon outline scaled to a box */
export function polygonPoints(type: PolygonShapeType, width: number, height: number): number[] {
  return (SHAPE_POLYGONS[type] || []).map((v, i) => (i % 2 === 0 ? v * width : v * height));
}

/** Dash pattern for a stroke width */
export function dashPattern(dash: "solid" | "dashed" | "dotted" | undefined, strokeWidth: number): number[] {
  const w = Math.max(1, strokeWidth);
  if (dash === "dashed") return [w * 3, w * 2];
  if (dash === "dotted") return [0.01, w * 2];
  return [];
}

function regular(sides: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
  }
  return normalize(pts);
}

function star(points: number, inner: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.5 * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a));
  }
  return normalize(pts);
}

/** Stretches an outline to fill the unit box exactly */
function normalize(pts: number[]): number[] {
  const xs = pts.filter((_, i) => i % 2 === 0);
  const ys = pts.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1;
  const h = Math.max(...ys) - minY || 1;
  return pts.map((v, i) => Math.round(((i % 2 === 0 ? (v - minX) / w : (v - minY) / h)) * 10000) / 10000);
}

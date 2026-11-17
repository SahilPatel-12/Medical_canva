import React from "react";
import type { DesignElement, LineCap, ShapeProperties, ShapeType } from "@design-platform/types";
import { SHAPE_POLYGONS, isPolygonShape } from "@design-platform/editor";

/** Everything needed to create an element (position is chosen when inserting) */
export type ElementTemplate = Omit<DesignElement, "id" | "x" | "y">;

export interface CatalogItem {
  id: string;
  label: string;
  keywords: string;
  template: ElementTemplate;
}

const SHAPE_COLOR = "#3b82f6";
const LINE_COLOR = "#334155";

const shape = (
  shapeType: ShapeType,
  label: string,
  size: [number, number],
  extra: Partial<ShapeProperties> = {}
): ElementTemplate => ({
  type: "shape",
  name: label,
  width: size[0],
  height: size[1],
  rotation: 0,
  opacity: 1,
  properties: { shapeType, fill: SHAPE_COLOR, stroke: "transparent", strokeWidth: 0, ...extra },
});

const line = (label: string, startCap: LineCap, endCap: LineCap, dash: ShapeProperties["dash"] = "solid"): ElementTemplate => ({
  type: "shape",
  name: label,
  width: 260,
  height: 24,
  rotation: 0,
  opacity: 1,
  properties: { shapeType: "line", fill: LINE_COLOR, strokeWidth: 4, startCap, endCap, dash },
});

const svg = (label: string, size: [number, number], markup: string): ElementTemplate => ({
  type: "svg",
  name: label,
  width: size[0],
  height: size[1],
  rotation: 0,
  opacity: 1,
  properties: { svgContent: markup, originalSvg: markup },
});

const outline = { fill: "transparent", stroke: SHAPE_COLOR, strokeWidth: 6 };

export const SHAPES: CatalogItem[] = [
  { id: "square", label: "Square", keywords: "square box", template: shape("rectangle", "Square", [180, 180]) },
  { id: "rounded", label: "Rounded square", keywords: "rounded square box card", template: shape("rectangle", "Rounded square", [180, 180], { cornerRadius: 28 }) },
  { id: "rect", label: "Rectangle", keywords: "rectangle box banner", template: shape("rectangle", "Rectangle", [260, 160]) },
  { id: "circle", label: "Circle", keywords: "circle round dot oval", template: shape("circle", "Circle", [180, 180]) },
  { id: "triangle", label: "Triangle", keywords: "triangle", template: shape("triangle", "Triangle", [200, 180]) },
  { id: "right-triangle", label: "Right triangle", keywords: "right triangle", template: shape("right-triangle", "Right triangle", [180, 180]) },
  { id: "diamond", label: "Diamond", keywords: "diamond rhombus decision", template: shape("diamond", "Diamond", [180, 180]) },
  { id: "pentagon", label: "Pentagon", keywords: "pentagon", template: shape("pentagon", "Pentagon", [180, 172]) },
  { id: "hexagon", label: "Hexagon", keywords: "hexagon benzene ring", template: shape("hexagon", "Hexagon", [200, 174]) },
  { id: "octagon", label: "Octagon", keywords: "octagon stop", template: shape("octagon", "Octagon", [180, 180]) },
  { id: "star", label: "Star", keywords: "star favorite", template: shape("star", "Star", [190, 182], { fill: "#f59e0b" }) },
  { id: "plus", label: "Plus", keywords: "plus cross add medical", template: shape("plus", "Plus", [160, 160], { fill: "#ef4444" }) },
  { id: "block-arrow", label: "Block arrow", keywords: "arrow block direction flow", template: shape("arrow", "Block arrow", [240, 140]) },
  { id: "chevron", label: "Chevron", keywords: "chevron step process", template: shape("chevron", "Chevron", [200, 140]) },
  { id: "parallelogram", label: "Parallelogram", keywords: "parallelogram input output", template: shape("parallelogram", "Parallelogram", [240, 140]) },
  { id: "trapezoid", label: "Trapezoid", keywords: "trapezoid", template: shape("trapezoid", "Trapezoid", [240, 150]) },
  { id: "square-outline", label: "Square outline", keywords: "outline square frame border", template: shape("rectangle", "Square outline", [180, 180], outline) },
  { id: "rounded-outline", label: "Rounded outline", keywords: "outline rounded frame border", template: shape("rectangle", "Rounded outline", [220, 160], { ...outline, cornerRadius: 24 }) },
  { id: "circle-outline", label: "Circle outline", keywords: "outline circle ring", template: shape("circle", "Circle outline", [180, 180], outline) },
  { id: "hexagon-outline", label: "Hexagon outline", keywords: "outline hexagon ring", template: shape("hexagon", "Hexagon outline", [200, 174], outline) },
];

export const LINES: CatalogItem[] = [
  { id: "line", label: "Line", keywords: "line straight connector", template: line("Line", "none", "none") },
  { id: "arrow", label: "Arrow", keywords: "arrow activation leads to pathway", template: line("Arrow", "none", "arrow") },
  { id: "double-arrow", label: "Double arrow", keywords: "double arrow reversible equilibrium", template: line("Double arrow", "arrow", "arrow") },
  { id: "inhibition", label: "Inhibition", keywords: "inhibition inhibits blocks t-bar", template: line("Inhibition", "none", "bar") },
  { id: "dashed", label: "Dashed line", keywords: "dashed line", template: line("Dashed line", "none", "none", "dashed") },
  { id: "dashed-arrow", label: "Dashed arrow", keywords: "dashed arrow indirect translocation", template: line("Dashed arrow", "none", "arrow", "dashed") },
  { id: "dotted", label: "Dotted line", keywords: "dotted line", template: line("Dotted line", "none", "none", "dotted") },
  { id: "dot-arrow", label: "Connector", keywords: "connector dot arrow binding", template: line("Connector", "dot", "arrow") },
];

const icon = (body: string, vb = "0 0 100 100") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100" height="100">${body}</svg>`;

export const SYMBOLS: CatalogItem[] = [
  {
    id: "upregulated",
    label: "Increase",
    keywords: "increase up upregulated rise arrow",
    template: svg("Increase", [100, 120], icon(`<path d="M50 6 L88 50 H64 V94 H36 V50 H12 Z" fill="#16a34a"/>`, "0 0 100 100")),
  },
  {
    id: "downregulated",
    label: "Decrease",
    keywords: "decrease down downregulated fall arrow",
    template: svg("Decrease", [100, 120], icon(`<path d="M50 94 L88 50 H64 V6 H36 V50 H12 Z" fill="#dc2626"/>`)),
  },
  {
    id: "positive",
    label: "Positive",
    keywords: "positive plus charge add",
    template: svg("Positive", [100, 100], icon(`<circle cx="50" cy="50" r="44" fill="#16a34a"/><path d="M50 26 V74 M26 50 H74" stroke="#fff" stroke-width="12" stroke-linecap="round"/>`)),
  },
  {
    id: "negative",
    label: "Negative",
    keywords: "negative minus charge remove",
    template: svg("Negative", [100, 100], icon(`<circle cx="50" cy="50" r="44" fill="#dc2626"/><path d="M26 50 H74" stroke="#fff" stroke-width="12" stroke-linecap="round"/>`)),
  },
  {
    id: "check",
    label: "Check",
    keywords: "check yes correct tick",
    template: svg("Check", [100, 100], icon(`<circle cx="50" cy="50" r="44" fill="#16a34a"/><path d="M28 52 L44 67 L73 35" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`)),
  },
  {
    id: "cross",
    label: "Cross",
    keywords: "cross no wrong x",
    template: svg("Cross", [100, 100], icon(`<circle cx="50" cy="50" r="44" fill="#dc2626"/><path d="M33 33 L67 67 M67 33 L33 67" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`)),
  },
  {
    id: "lightning",
    label: "Stimulus",
    keywords: "stimulus lightning signal energy",
    template: svg("Stimulus", [90, 120], icon(`<path d="M58 4 L18 58 H46 L38 96 L82 38 H54 Z" fill="#f59e0b"/>`)),
  },
  {
    id: "warning",
    label: "Warning",
    keywords: "warning caution hazard",
    template: svg("Warning", [110, 100], icon(`<path d="M50 6 L96 90 H4 Z" fill="#f59e0b" stroke="#f59e0b" stroke-width="6" stroke-linejoin="round"/><path d="M50 36 V62" stroke="#fff" stroke-width="9" stroke-linecap="round"/><circle cx="50" cy="76" r="5" fill="#fff"/>`)),
  },
  {
    id: "info",
    label: "Info",
    keywords: "info information note",
    template: svg("Info", [100, 100], icon(`<circle cx="50" cy="50" r="44" fill="#2563eb"/><circle cx="50" cy="29" r="6" fill="#fff"/><path d="M50 44 V74" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`)),
  },
  {
    id: "brace",
    label: "Bracket",
    keywords: "bracket brace group",
    template: svg("Bracket", [60, 200], icon(`<path d="M40 4 C20 4 22 20 22 34 C22 44 18 50 8 50 C18 50 22 56 22 66 C22 80 20 96 40 96" fill="none" stroke="#334155" stroke-width="5" stroke-linecap="round"/>`, "0 0 50 100")),
  },
  {
    id: "scale-bar",
    label: "Scale bar",
    keywords: "scale bar micrometer measure",
    template: svg("Scale bar", [220, 30], icon(`<rect x="0" y="4" width="200" height="12" fill="#0f172a"/>`, "0 0 200 20")),
  },
  {
    id: "repeat",
    label: "Cycle",
    keywords: "cycle repeat loop circular",
    template: svg("Cycle", [110, 110], icon(`<path d="M80 32 A36 36 0 1 0 86 58" fill="none" stroke="#2563eb" stroke-width="9" stroke-linecap="round"/><path d="M64 26 L88 26 L84 4 Z" fill="#2563eb"/>`)),
  },
];

/** Numbered markers for figure annotations */
export const MARKERS: CatalogItem[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `marker-${n}`,
  label: `Marker ${n}`,
  keywords: `number marker step label ${n}`,
  template: svg(
    `Marker ${n}`,
    [64, 64],
    icon(
      `<circle cx="50" cy="50" r="46" fill="#0f172a"/><text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="700" fill="#fff">${n}</text>`
    )
  ),
}));

// ---------- Previews ----------

/** Small vector preview of a template, drawn like the canvas draws it */
export const TemplatePreview: React.FC<{ template: ElementTemplate }> = ({ template }) => {
  if (template.type === "svg") {
    const markup = (template.properties as { svgContent: string }).svgContent;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        draggable={false}
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`}
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      />
    );
  }
  const p = template.properties as ShapeProperties;
  const w = template.width;
  const h = template.height;
  const k = 40 / Math.max(w, h);
  const vw = w * k;
  const vh = h * k;
  const stroke = p.stroke && p.stroke !== "transparent" ? p.stroke : undefined;
  const sw = stroke ? Math.max(2, (p.strokeWidth || 0) * k * 1.6) : 0;

  if (p.shapeType === "line") {
    const color = p.fill;
    const y = 20;
    const dash = p.dash === "dashed" ? "6 4" : p.dash === "dotted" ? "0.1 5" : undefined;
    const cap = (c: LineCap | undefined, x: number, dir: 1 | -1) =>
      c === "arrow" ? (
        <path d={`M${x} ${y} L${x - dir * 9} ${y - 5} L${x - dir * 9} ${y + 5} Z`} fill={color} />
      ) : c === "bar" ? (
        <rect x={dir === 1 ? x - 3 : x} y={y - 7} width={3} height={14} fill={color} />
      ) : c === "dot" ? (
        <circle cx={x - dir * 3} cy={y} r={3.5} fill={color} />
      ) : null;
    return (
      <svg viewBox="0 0 48 40" width="100%" height="100%">
        <line
          x1={p.startCap === "arrow" ? 10 : 2}
          y1={y}
          x2={p.endCap === "arrow" ? 38 : 46}
          y2={y}
          stroke={color}
          strokeWidth={3}
          strokeDasharray={dash}
          strokeLinecap={p.dash === "dotted" ? "round" : "butt"}
        />
        {cap(p.startCap, 2, -1)}
        {cap(p.endCap, 46, 1)}
      </svg>
    );
  }

  const common = {
    fill: p.fill === "transparent" ? "none" : p.fill,
    stroke,
    strokeWidth: sw,
    strokeLinejoin: "round" as const,
  };
  let body: React.ReactNode;
  if (p.shapeType === "circle") body = <ellipse cx={vw / 2} cy={vh / 2} rx={vw / 2 - sw / 2} ry={vh / 2 - sw / 2} {...common} />;
  else if (p.shapeType === "rectangle")
    body = (
      <rect
        x={sw / 2}
        y={sw / 2}
        width={vw - sw}
        height={vh - sw}
        rx={(p.cornerRadius || 0) * k}
        {...common}
      />
    );
  else if (isPolygonShape(p.shapeType)) {
    const pts = SHAPE_POLYGONS[p.shapeType]
      .map((v, i) => (i % 2 === 0 ? sw / 2 + v * (vw - sw) : sw / 2 + v * (vh - sw)))
      .join(" ");
    body = <polygon points={pts} {...common} />;
  }
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width={vw} height={vh}>
      {body}
    </svg>
  );
};

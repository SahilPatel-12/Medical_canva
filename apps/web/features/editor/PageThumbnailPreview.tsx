"use client";

import React from "react";
import { Page, DesignElement, LineCap, TextProperties } from "@design-platform/types";
import {
  canvasMeasurer,
  drawnSize,
  isPolygonShape,
  layoutRichText,
  polygonPoints,
  scriptShift,
} from "@design-platform/editor";

interface PageThumbnailPreviewProps {
  page: Page;
  docWidth: number;
  docHeight: number;
  backgroundColor: string;
  /** Ignore the stored low-res thumbnail and draw the page as vectors (crisp at any size) */
  preferVector?: boolean;
  /** Corner rounding in px (0 for full-screen slides) */
  radius?: number;
}

export const PageThumbnailPreview: React.FC<PageThumbnailPreviewProps> = ({
  page,
  docWidth,
  docHeight,
  backgroundColor,
  preferVector = false,
  radius = 4,
}) => {
  // If a high-res exported data URL is available, render that image
  if (page.thumbnail && !preferVector) {
    return (
      <img
        src={page.thumbnail}
        alt={page.name || "Page preview"}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          borderRadius: radius,
          display: "block",
        }}
      />
    );
  }

  // Otherwise, render a lightweight instant SVG miniature projection of the page
  const viewBox = `0 0 ${docWidth || 1200} ${docHeight || 800}`;
  const elements = page.elements || [];

  return (
    <svg
      viewBox={viewBox}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      {/* Canvas page background */}
      <rect
        x="0"
        y="0"
        width={docWidth || 1200}
        height={docHeight || 800}
        fill={backgroundColor || "#ffffff"}
      />

      {/* Render elements */}
      {elements.map((el) => {
        return <MiniElement key={el.id} element={el} />;
      })}
    </svg>
  );
};

const MiniElement: React.FC<{ element: DesignElement }> = ({ element }) => {
  const { x, y, width, height, rotation, opacity, type, properties } = element;
  const transform = rotation ? `rotate(${rotation} ${x + width / 2} ${y + height / 2})` : undefined;
  const elOpacity = opacity !== undefined ? opacity : 1;

  if (type === "shape") {
    const shapeProps = properties as {
      shapeType?: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      cornerRadius?: number;
      dash?: "solid" | "dashed" | "dotted";
      startCap?: LineCap;
      endCap?: LineCap;
      flipX?: boolean;
      flipY?: boolean;
    };
    const fill = shapeProps.fill === "transparent" ? "none" : shapeProps.fill || "#3b82f6";
    const outline = shapeProps.stroke && shapeProps.stroke !== "transparent" ? shapeProps.stroke : undefined;

    if (isPolygonShape(shapeProps.shapeType)) {
      // Mirrored shapes reflect their outline inside the box (as on the canvas)
      const pts = polygonPoints(shapeProps.shapeType, width, height)
        .map((v, i) =>
          i % 2 === 0 ? x + (shapeProps.flipX ? width - v : v) : y + (shapeProps.flipY ? height - v : v)
        )
        .join(" ");
      return (
        <polygon
          points={pts}
          fill={fill}
          stroke={outline}
          strokeWidth={outline ? shapeProps.strokeWidth : 0}
          strokeLinejoin="round"
          opacity={elOpacity}
          transform={transform}
        />
      );
    }

    if (shapeProps.shapeType === "circle") {
      const rx = width / 2;
      const ry = height / 2;
      return (
        <ellipse
          cx={x + rx}
          cy={y + ry}
          rx={rx}
          ry={ry}
          fill={fill}
          stroke={shapeProps.stroke}
          strokeWidth={shapeProps.strokeWidth}
          opacity={elOpacity}
          transform={transform}
        />
      );
    }

    if (shapeProps.shapeType === "line") {
      const color = shapeProps.fill || "#3b82f6";
      const sw = shapeProps.strokeWidth || 4;
      const head = Math.max(8, sw * 3);
      const cy = y + height / 2;
      const cap = (c: LineCap | undefined, cx: number, dir: 1 | -1) =>
        c === "arrow" ? (
          <path d={`M${cx} ${cy} L${cx - dir * head} ${cy - head * 0.55} L${cx - dir * head} ${cy + head * 0.55} Z`} fill={color} />
        ) : c === "bar" ? (
          <rect x={dir === 1 ? cx - sw : cx} y={cy - head * 0.7} width={sw} height={head * 1.4} fill={color} />
        ) : c === "dot" ? (
          <circle cx={cx - dir * sw * 1.2} cy={cy} r={sw * 1.4} fill={color} />
        ) : null;
      return (
        <g opacity={elOpacity} transform={transform}>
          <line
            x1={x + (shapeProps.startCap === "arrow" ? head * 0.8 : 0)}
            y1={cy}
            x2={x + width - (shapeProps.endCap === "arrow" ? head * 0.8 : 0)}
            y2={cy}
            stroke={color}
            strokeWidth={sw}
            strokeDasharray={shapeProps.dash === "dashed" ? `${sw * 3} ${sw * 2}` : shapeProps.dash === "dotted" ? `0.01 ${sw * 2}` : undefined}
            strokeLinecap={shapeProps.dash === "dotted" ? "round" : "butt"}
          />
          {cap(shapeProps.startCap, x, -1)}
          {cap(shapeProps.endCap, x + width, 1)}
        </g>
      );
    }

    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={shapeProps.cornerRadius || 0}
        ry={shapeProps.cornerRadius || 0}
        fill={fill}
        stroke={shapeProps.stroke}
        strokeWidth={shapeProps.strokeWidth}
        opacity={elOpacity}
        transform={transform}
      />
    );
  }

  if (type === "text") {
    // Same layout as the canvas: wrapping, alignment and mixed styles
    const layout = layoutRichText(properties as TextProperties, width, canvasMeasurer);
    return (
      <text opacity={elOpacity} transform={transform} style={{ whiteSpace: "pre" }}>
        {layout.lines.flatMap((line, li) =>
          line.fragments.map((f, fi) => {
            const st = f.style;
            const deco = [st.underline ? "underline" : "", st.strike ? "line-through" : ""].filter(Boolean).join(" ");
            return (
              <tspan
                key={`${li}-${fi}`}
                x={x + f.x}
                y={y + line.baseline + scriptShift(st)}
                fontSize={drawnSize(st)}
                fontFamily={st.fontFamily}
                fontWeight={st.fontWeight}
                fontStyle={st.fontStyle}
                fill={st.fill}
                textDecoration={deco || undefined}
              >
                {f.text}
              </tspan>
            );
          })
        )}
      </text>
    );
  }

  if (type === "image") {
    const imgProps = properties as { url?: string; src?: string; originalSrc?: string; flipX?: boolean; flipY?: boolean };
    const href = imgProps.src || imgProps.originalSrc || imgProps.url;
    if (href) {
      // Mirrored photo: reflect around the image's own center, inside the element transform
      const mirror =
        imgProps.flipX || imgProps.flipY
          ? ` translate(${x + width / 2} ${y + height / 2}) scale(${imgProps.flipX ? -1 : 1} ${imgProps.flipY ? -1 : 1}) translate(${-(x + width / 2)} ${-(y + height / 2)})`
          : "";
      return (
        <image
          href={href}
          x={x}
          y={y}
          width={width}
          height={height}
          opacity={elOpacity}
          transform={`${transform || ""}${mirror}`.trim() || undefined}
          preserveAspectRatio="xMidYMid slice"
        />
      );
    }
  }

  if (type === "svg") {
    const svgProps = properties as { svgContent?: string; originalSvg?: string; fill?: string };
    const rawSvg = svgProps.svgContent || svgProps.originalSvg;
    if (rawSvg) {
      // Drawn as an isolated image (scaled to the element box, no id clashes between copies)
      const href = /^https?:\/\//.test(rawSvg)
        ? rawSvg
        : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg)}`;
      return (
        <image
          href={href}
          x={x}
          y={y}
          width={width}
          height={height}
          opacity={elOpacity}
          transform={transform}
          preserveAspectRatio="none"
        />
      );
    }
  }

  // Fallback generic element preview box
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="rgba(59, 130, 246, 0.4)"
      stroke="#3b82f6"
      strokeWidth={1}
      opacity={elOpacity}
      transform={transform}
    />
  );
};

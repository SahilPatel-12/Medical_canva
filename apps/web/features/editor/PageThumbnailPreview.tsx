"use client";

import React from "react";
import { Page, DesignElement } from "@design-platform/types";

interface PageThumbnailPreviewProps {
  page: Page;
  docWidth: number;
  docHeight: number;
  backgroundColor: string;
}

export const PageThumbnailPreview: React.FC<PageThumbnailPreviewProps> = ({
  page,
  docWidth,
  docHeight,
  backgroundColor,
}) => {
  // If a high-res exported data URL is available, render that image
  if (page.thumbnail) {
    return (
      <img
        src={page.thumbnail}
        alt={page.name || "Page preview"}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          borderRadius: "4px",
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
        borderRadius: "4px",
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
      shapeType?: "rectangle" | "circle" | "line";
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      cornerRadius?: number;
    };

    if (shapeProps.shapeType === "circle") {
      const rx = width / 2;
      const ry = height / 2;
      return (
        <ellipse
          cx={x + rx}
          cy={y + ry}
          rx={rx}
          ry={ry}
          fill={shapeProps.fill || "#3b82f6"}
          stroke={shapeProps.stroke}
          strokeWidth={shapeProps.strokeWidth}
          opacity={elOpacity}
          transform={transform}
        />
      );
    }

    if (shapeProps.shapeType === "line") {
      return (
        <line
          x1={x}
          y1={y + height / 2}
          x2={x + width}
          y2={y + height / 2}
          stroke={shapeProps.stroke || shapeProps.fill || "#3b82f6"}
          strokeWidth={shapeProps.strokeWidth || 4}
          opacity={elOpacity}
          transform={transform}
        />
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
        fill={shapeProps.fill || "#3b82f6"}
        stroke={shapeProps.stroke}
        strokeWidth={shapeProps.strokeWidth}
        opacity={elOpacity}
        transform={transform}
      />
    );
  }

  if (type === "text") {
    const textProps = properties as {
      text?: string;
      fill?: string;
      fontSize?: number;
      fontWeight?: string;
      fontFamily?: string;
    };
    const fontSize = textProps.fontSize || 24;

    return (
      <text
        x={x}
        y={y + fontSize}
        fontSize={fontSize}
        fill={textProps.fill || "#000000"}
        fontWeight={textProps.fontWeight || "normal"}
        fontFamily={textProps.fontFamily || "Inter, sans-serif"}
        opacity={elOpacity}
        transform={transform}
      >
        {textProps.text || ""}
      </text>
    );
  }

  if (type === "image") {
    const imgProps = properties as { url?: string };
    if (imgProps.url) {
      return (
        <image
          href={imgProps.url}
          x={x}
          y={y}
          width={width}
          height={height}
          opacity={elOpacity}
          transform={transform}
          preserveAspectRatio="xMidYMid slice"
        />
      );
    }
  }

  if (type === "svg") {
    const svgProps = properties as { svgContent?: string; originalSvg?: string; fill?: string };
    const rawSvg = svgProps.svgContent || svgProps.originalSvg;
    if (rawSvg) {
      // Clean SVG for embedding or placeholder box
      return (
        <g
          transform={`${transform || ""} translate(${x}, ${y})`}
          opacity={elOpacity}
          dangerouslySetInnerHTML={{ __html: rawSvg }}
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

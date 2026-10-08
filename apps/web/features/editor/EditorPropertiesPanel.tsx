"use client";

import React from "react";
import {
  DesignDocument,
  DesignElement,
  ShapeProperties,
  TextProperties,
  SvgProperties,
} from "@design-platform/types";
import { ColorPicker, Button, Input } from "@design-platform/ui";
import {
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  RotateCw,
} from "lucide-react";

export interface EditorPropertiesPanelProps {
  document: DesignDocument;
  selectedElement: DesignElement | null;
  onUpdateElement: (id: string, updates: Partial<DesignElement>) => void;
  onDeleteElement: (id?: string) => void;
  onDuplicateElement: (id?: string) => void;
  onBringForward: (id?: string) => void;
  onSendBackward: (id?: string) => void;
  onBringToFront: (id?: string) => void;
  onSendToBack: (id?: string) => void;
  onUpdateSvgColor: (fill?: string, stroke?: string) => void;
  onSetCanvasBackground: (color: string) => void;
}

const FONT_FAMILIES = [
  { label: "Inter / System Sans", value: "Inter, -apple-system, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia (Serif)", value: "Georgia, serif" },
  { label: "Courier New (Mono)", value: "'Courier New', monospace" },
];

export const EditorPropertiesPanel: React.FC<EditorPropertiesPanelProps> = ({
  document,
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onUpdateSvgColor,
  onSetCanvasBackground,
}) => {
  return (
    <aside
      style={{
        width: "290px",
        flexShrink: 0,
        borderLeft: "1px solid #27272a",
        backgroundColor: "#121215",
        height: "calc(100vh - 56px)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
        zIndex: 30,
      }}
    >
      {/* ========================================== */}
      {/* 1. NOTHING SELECTED: CANVAS PROPERTIES     */}
      {/* ========================================== */}
      {!selectedElement ? (
        <div
          style={{
            padding: "1.25rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <div>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#f4f4f5", margin: 0 }}>
              Canvas Settings
            </h2>
            <p style={{ fontSize: "0.75rem", color: "#a1a1aa", marginTop: "2px", margin: 0 }}>
              Global page dimensions & background
            </p>
          </div>

          {/* Dimensions Display */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              backgroundColor: "#18181b",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid #27272a",
            }}
          >
            <div>
              <span style={{ fontSize: "0.6875rem", color: "#71717a", textTransform: "uppercase" }}>
                Width
              </span>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "#f4f4f5",
                  marginTop: "2px",
                }}
              >
                {document.width} px
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.6875rem", color: "#71717a", textTransform: "uppercase" }}>
                Height
              </span>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "#f4f4f5",
                  marginTop: "2px",
                }}
              >
                {document.height} px
              </div>
            </div>
          </div>

          {/* Canvas Background Color */}
          <ColorPicker
            label="Canvas Background"
            value={document.backgroundColor || "#ffffff"}
            onChange={onSetCanvasBackground}
          />

          {/* Document Info */}
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              fontSize: "0.75rem",
              color: "#a1a1aa",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Elements:</span>
              <span style={{ color: "#f4f4f5", fontWeight: 600 }}>
                {document.pages?.[0]?.elements?.length || 0}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Orientation:</span>
              <span style={{ color: "#f4f4f5", fontWeight: 600 }}>
                {document.width >= document.height ? "Landscape" : "Portrait"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================== */
        /* 2. ELEMENT SELECTED: ELEMENT PROPERTIES    */
        /* ========================================== */
        <div
          style={{
            padding: "1.25rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Header & Quick Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#3b82f6",
                }}
              >
                {selectedElement.type === "svg"
                  ? "SVG Asset"
                  : selectedElement.type === "shape"
                    ? (selectedElement.properties as ShapeProperties)?.shapeType?.toUpperCase() ||
                      "SHAPE"
                    : "TEXT"}
              </span>
              <h2
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  color: "#f4f4f5",
                  margin: "2px 0 0",
                  maxWidth: "160px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedElement.name || selectedElement.type}
              </h2>
            </div>

            {/* Quick Actions: Duplicate & Delete */}
            <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <Button
                variant="icon"
                size="xs"
                onClick={() => onDuplicateElement(selectedElement.id)}
                title="Duplicate (Ctrl/Cmd + D)"
              >
                <Copy size={15} />
              </Button>
              <Button
                variant="icon"
                size="xs"
                onClick={() => onDeleteElement(selectedElement.id)}
                title="Delete (Delete / Backspace)"
                style={{ color: "#f87171" }}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>

          {/* Layer Ordering Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                color: "#71717a",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Layer Position
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "4px",
                backgroundColor: "#18181b",
                padding: "3px",
                borderRadius: "8px",
                border: "1px solid #27272a",
              }}
            >
              <Button
                variant="icon"
                size="xs"
                onClick={() => onBringToFront(selectedElement.id)}
                title="Bring to Front"
              >
                <ChevronsUp size={14} />
              </Button>
              <Button
                variant="icon"
                size="xs"
                onClick={() => onBringForward(selectedElement.id)}
                title="Bring Forward"
              >
                <ArrowUp size={14} />
              </Button>
              <Button
                variant="icon"
                size="xs"
                onClick={() => onSendBackward(selectedElement.id)}
                title="Send Backward"
              >
                <ArrowDown size={14} />
              </Button>
              <Button
                variant="icon"
                size="xs"
                onClick={() => onSendToBack(selectedElement.id)}
                title="Send to Back"
              >
                <ChevronsDown size={14} />
              </Button>
            </div>
          </div>

          {/* Position & Size Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                color: "#71717a",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Transform
            </span>

            {/* X and Y */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <Input
                label="X Position"
                type="number"
                value={selectedElement.x}
                onChange={(e) => onUpdateElement(selectedElement.id, { x: Number(e.target.value) })}
              />
              <Input
                label="Y Position"
                type="number"
                value={selectedElement.y}
                onChange={(e) => onUpdateElement(selectedElement.id, { y: Number(e.target.value) })}
              />
            </div>

            {/* Width and Height */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <Input
                label="Width"
                type="number"
                min={5}
                value={selectedElement.width}
                onChange={(e) =>
                  onUpdateElement(selectedElement.id, {
                    width: Math.max(5, Number(e.target.value)),
                  })
                }
              />
              <Input
                label="Height"
                type="number"
                min={5}
                value={selectedElement.height}
                onChange={(e) =>
                  onUpdateElement(selectedElement.id, {
                    height: Math.max(5, Number(e.target.value)),
                  })
                }
              />
            </div>

            {/* Rotation */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span style={{ fontSize: "0.75rem", color: "#e4e4e7" }}>Rotation</span>
                <span style={{ fontSize: "0.75rem", color: "#a1a1aa", fontFamily: "monospace" }}>
                  {selectedElement.rotation}°
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={selectedElement.rotation || 0}
                onChange={(e) =>
                  onUpdateElement(selectedElement.id, { rotation: Number(e.target.value) })
                }
                style={{ accentColor: "#3b82f6", cursor: "pointer" }}
              />
            </div>

            {/* Opacity */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span style={{ fontSize: "0.75rem", color: "#e4e4e7" }}>Opacity</span>
                <span style={{ fontSize: "0.75rem", color: "#a1a1aa", fontFamily: "monospace" }}>
                  {Math.round((selectedElement.opacity ?? 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round((selectedElement.opacity ?? 1) * 100)}
                onChange={(e) =>
                  onUpdateElement(selectedElement.id, { opacity: Number(e.target.value) / 100 })
                }
                style={{ accentColor: "#3b82f6", cursor: "pointer" }}
              />
            </div>
          </div>

          <div style={{ height: "1px", backgroundColor: "#27272a" }} />

          {/* ========================================== */}
          {/* SVG SPECIFIC: VECTOR COLOR EDITING         */}
          {/* ========================================== */}
          {selectedElement.type === "svg" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "#71717a",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Vector Styling
                </span>
                <p style={{ fontSize: "0.75rem", color: "#a1a1aa", marginTop: "2px" }}>
                  Change vector fill or stroke color non-destructively
                </p>
              </div>

              <ColorPicker
                label="Fill Color"
                value={(selectedElement.properties as SvgProperties).fill || "#3b82f6"}
                onChange={(c) => onUpdateSvgColor(c, undefined)}
              />

              <ColorPicker
                label="Stroke / Outline Color"
                value={(selectedElement.properties as SvgProperties).stroke || "#2563eb"}
                onChange={(c) => onUpdateSvgColor(undefined, c)}
              />

              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  const props = selectedElement.properties as SvgProperties;
                  onUpdateElement(selectedElement.id, {
                    properties: {
                      ...props,
                      svgContent: props.originalSvg,
                      fill: undefined,
                      stroke: undefined,
                    },
                  });
                }}
              >
                Reset to Original Colors
              </Button>
            </div>
          )}

          {/* ========================================== */}
          {/* SHAPE SPECIFIC: FILL, STROKE, CORNERS     */}
          {/* ========================================== */}
          {selectedElement.type === "shape" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "#71717a",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Shape Appearance
              </span>

              <ColorPicker
                label="Fill Color"
                value={(selectedElement.properties as ShapeProperties).fill || "#3b82f6"}
                onChange={(fill) =>
                  onUpdateElement(selectedElement.id, {
                    properties: {
                      ...selectedElement.properties,
                      fill,
                    },
                  })
                }
              />

              {(selectedElement.properties as ShapeProperties).shapeType !== "line" && (
                <ColorPicker
                  label="Stroke Color"
                  value={(selectedElement.properties as ShapeProperties).stroke || "#2563eb"}
                  onChange={(stroke) =>
                    onUpdateElement(selectedElement.id, {
                      properties: {
                        ...selectedElement.properties,
                        stroke,
                        strokeWidth:
                          (selectedElement.properties as ShapeProperties).strokeWidth || 2,
                      },
                    })
                  }
                />
              )}

              {/* Stroke Width */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#e4e4e7" }}>Stroke Width</span>
                  <span style={{ fontSize: "0.75rem", color: "#a1a1aa", fontFamily: "monospace" }}>
                    {(selectedElement.properties as ShapeProperties).strokeWidth || 0}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={(selectedElement.properties as ShapeProperties).strokeWidth || 0}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      properties: {
                        ...selectedElement.properties,
                        strokeWidth: Number(e.target.value),
                      },
                    })
                  }
                  style={{ accentColor: "#3b82f6", cursor: "pointer" }}
                />
              </div>

              {/* Corner radius for rectangles */}
              {(selectedElement.properties as ShapeProperties).shapeType === "rectangle" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "#e4e4e7" }}>Corner Radius</span>
                    <span
                      style={{ fontSize: "0.75rem", color: "#a1a1aa", fontFamily: "monospace" }}
                    >
                      {(selectedElement.properties as ShapeProperties).cornerRadius || 0}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={(selectedElement.properties as ShapeProperties).cornerRadius || 0}
                    onChange={(e) =>
                      onUpdateElement(selectedElement.id, {
                        properties: {
                          ...selectedElement.properties,
                          cornerRadius: Number(e.target.value),
                        },
                      })
                    }
                    style={{ accentColor: "#3b82f6", cursor: "pointer" }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* TEXT SPECIFIC: CONTENT, FONT, COLOR, ALIGN */}
          {/* ========================================== */}
          {selectedElement.type === "text" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "#71717a",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Typography
              </span>

              {/* Content textarea */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.75rem", color: "#e4e4e7" }}>Text Content</span>
                <textarea
                  rows={3}
                  value={(selectedElement.properties as TextProperties).text || ""}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      properties: {
                        ...selectedElement.properties,
                        text: e.target.value,
                      },
                    })
                  }
                  style={{
                    backgroundColor: "#18181b",
                    color: "#f4f4f5",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                    padding: "6px 8px",
                    fontSize: "0.8125rem",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Font Family */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.75rem", color: "#e4e4e7" }}>Font Family</span>
                <select
                  value={
                    (selectedElement.properties as TextProperties).fontFamily ||
                    FONT_FAMILIES[0]?.value
                  }
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      properties: {
                        ...selectedElement.properties,
                        fontFamily: e.target.value,
                      },
                    })
                  }
                  style={{
                    backgroundColor: "#18181b",
                    color: "#f4f4f5",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                    padding: "6px 8px",
                    fontSize: "0.8125rem",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Size & Weight */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.5rem",
                  alignItems: "flex-end",
                }}
              >
                <Input
                  label="Font Size (px)"
                  type="number"
                  min={8}
                  max={200}
                  value={(selectedElement.properties as TextProperties).fontSize || 24}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      properties: {
                        ...selectedElement.properties,
                        fontSize: Number(e.target.value),
                      },
                    })
                  }
                />
                <Button
                  variant={
                    (selectedElement.properties as TextProperties).fontWeight === "bold"
                      ? "primary"
                      : "secondary"
                  }
                  size="md"
                  onClick={() => {
                    const isBold =
                      (selectedElement.properties as TextProperties).fontWeight === "bold";
                    onUpdateElement(selectedElement.id, {
                      properties: {
                        ...selectedElement.properties,
                        fontWeight: isBold ? "normal" : "bold",
                      },
                    });
                  }}
                  icon={<Bold size={16} />}
                >
                  Bold
                </Button>
              </div>

              {/* Alignment */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.75rem", color: "#e4e4e7" }}>Alignment</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  {[
                    { align: "left" as const, icon: <AlignLeft size={16} /> },
                    { align: "center" as const, icon: <AlignCenter size={16} /> },
                    { align: "right" as const, icon: <AlignRight size={16} /> },
                  ].map((btn) => {
                    const isAlign =
                      ((selectedElement.properties as TextProperties).align || "left") ===
                      btn.align;
                    return (
                      <Button
                        key={btn.align}
                        variant={isAlign ? "primary" : "secondary"}
                        size="sm"
                        style={{ flex: 1 }}
                        onClick={() =>
                          onUpdateElement(selectedElement.id, {
                            properties: {
                              ...selectedElement.properties,
                              align: btn.align,
                            },
                          })
                        }
                      >
                        {btn.icon}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Text Color */}
              <ColorPicker
                label="Text Color"
                value={(selectedElement.properties as TextProperties).fill || "#18181b"}
                onChange={(fill) =>
                  onUpdateElement(selectedElement.id, {
                    properties: {
                      ...selectedElement.properties,
                      fill,
                    },
                  })
                }
              />
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

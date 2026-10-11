"use client";

import React, { useMemo } from "react";
import {
  DesignDocument,
  DesignElement,
  ShapeProperties,
  TextProperties,
  SvgProperties,
} from "@design-platform/types";
import { ColorPicker, Button, Input } from "@design-platform/ui";
import { extractSvgColors } from "@design-platform/editor";
import {
  ArrowLeft,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  RotateCcw,
  RotateCw,
  Palette,
  Sparkles,
} from "lucide-react";

export interface EditorPropertiesPanelProps {
  document: DesignDocument;
  selectedElement: DesignElement | null;
  activePageIndex?: number;
  onUpdateElement: (id: string, updates: Partial<DesignElement>) => void;
  onDeleteElement: (id?: string) => void;
  onDuplicateElement: (id?: string) => void;
  onBringForward: (id?: string) => void;
  onSendBackward: (id?: string) => void;
  onBringToFront: (id?: string) => void;
  onSendToBack: (id?: string) => void;
  onUpdateSvgColor: (fill?: string, stroke?: string) => void;
  onUpdateSvgColorMap?: (colorMap: Record<string, string>) => void;
  onResetSvgColors?: () => void;
  onSetCanvasBackground: (color: string) => void;
  embedded?: boolean;
  onBackToLibrary?: () => void;
}

const FONT_FAMILIES = [
  { label: "Inter (System Sans)", value: "Inter, -apple-system, sans-serif" },
  { label: "Roboto (Sans)", value: "Roboto, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia (Serif)", value: "Georgia, serif" },
  { label: "Courier New (Mono)", value: "'Courier New', monospace" },
];

const THEME_PALETTES = [
  { name: "Clean White", hex: "#ffffff" },
  { name: "Mist Light", hex: "#f8fafc" },
  { name: "Soft Sky", hex: "#f0f9ff" },
  { name: "Pale Emerald", hex: "#f0fdf4" },
  { name: "Light Lavender", hex: "#f5f3ff" },
  { name: "Subtle Gray", hex: "#e2e8f0" },
  { name: "Slate Dark", hex: "#1e293b" },
  { name: "Midnight Navy", hex: "#0f172a" },
];

export const EditorPropertiesPanel: React.FC<EditorPropertiesPanelProps> = ({
  document,
  selectedElement,
  activePageIndex = 0,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onUpdateSvgColor,
  onUpdateSvgColorMap,
  onResetSvgColors,
  onSetCanvasBackground,
  embedded = false,
  onBackToLibrary,
}) => {
  // Alignment utilities
  const handleAlign = (type: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (!selectedElement) return;

    let newX = selectedElement.x;
    let newY = selectedElement.y;

    if (type === "left") newX = 0;
    else if (type === "center")
      newX = Math.max(0, Math.round((document.width - selectedElement.width) / 2));
    else if (type === "right")
      newX = Math.max(0, document.width - selectedElement.width);
    else if (type === "top") newY = 0;
    else if (type === "middle")
      newY = Math.max(0, Math.round((document.height - selectedElement.height) / 2));
    else if (type === "bottom")
      newY = Math.max(0, document.height - selectedElement.height);

    onUpdateElement(selectedElement.id, { x: newX, y: newY });
  };

  const handleRotateDelta = (delta: number) => {
    if (!selectedElement) return;
    const current = selectedElement.rotation || 0;
    const next = (current + delta + 360) % 360;
    onUpdateElement(selectedElement.id, { rotation: next });
  };

  // Detected colors in the SVG for multi-color palette inspector
  const detectedSvgColors = useMemo(() => {
    if (!selectedElement || selectedElement.type !== "svg") return [];
    const props = selectedElement.properties as SvgProperties;
    const markup = props.svgContent || props.originalSvg || "";
    if (!markup.includes("<svg")) return [];
    return extractSvgColors(markup);
  }, [selectedElement]);

  const handleSwatchReplace = (originalColor: string, newColor: string) => {
    if (!selectedElement || selectedElement.type !== "svg") return;
    const props = selectedElement.properties as SvgProperties & {
      colorMap?: Record<string, string>;
    };
    const currentMap = { ...(props.colorMap || {}) };
    currentMap[originalColor] = newColor;

    if (onUpdateSvgColorMap) {
      onUpdateSvgColorMap(currentMap);
    } else {
      // Fallback direct element update
      onUpdateElement(selectedElement.id, {
        properties: {
          ...props,
          colorMap: currentMap,
        },
      });
    }
  };

  return (
    <div
      style={
        embedded
          ? {
              width: "100%",
              flex: 1,
              backgroundColor: "#ffffff",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              userSelect: "none",
            }
          : {
              width: "320px",
              flexShrink: 0,
              borderLeft: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              height: "100%",
              minHeight: 0,
              paddingBottom: "5rem",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              userSelect: "none",
              zIndex: 30,
              boxShadow: "-1px 0 3px 0 rgba(0, 0, 0, 0.02)",
            }
      }
    >
      {/* Contextual Navigation Header when Embedded in Left Panel */}
      {onBackToLibrary && (
        <div
          style={{
            padding: "9px 12px",
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <button
            type="button"
            onClick={onBackToLibrary}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              background: "transparent",
              border: "none",
              color: "#2563eb",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "6px",
              transition: "background-color 0.1s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#eff6ff")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <ArrowLeft size={13} />
            <span>Back to Library</span>
          </button>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              maxWidth: "140px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selectedElement ? selectedElement.name || selectedElement.type : "Canvas"}
          </span>
        </div>
      )}
      {/* ========================================== */}
      {/* 1. NOTHING SELECTED: CANVAS PROPERTIES     */}
      {/* ========================================== */}
      {!selectedElement ? (
        <div
          style={{
            padding: "1.25rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "0.9375rem",
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Palette size={16} style={{ color: "#2563eb" }} />
              Canvas Settings
            </h2>
            <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px", margin: 0 }}>
              Page dimensions & background
            </p>
          </div>

          {/* Dimensions Display */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              backgroundColor: "#f8fafc",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div>
              <span style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase" }}>
                Width
              </span>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  marginTop: "2px",
                }}
              >
                {document.width} px
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.6875rem", color: "#64748b", textTransform: "uppercase" }}>
                Height
              </span>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  marginTop: "2px",
                }}
              >
                {document.height} px
              </div>
            </div>
          </div>

          {/* Canvas Background Color Picker & Palettes */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 700,
              }}
            >
              Background Color
            </span>

            <ColorPicker
              label=""
              value={document.backgroundColor || "#ffffff"}
              onChange={onSetCanvasBackground}
            />

            {/* Quick Scientific Swatches */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "6px",
                marginTop: "4px",
              }}
            >
              {THEME_PALETTES.map((theme) => {
                const isActive = (document.backgroundColor || "#ffffff") === theme.hex;
                return (
                  <button
                    key={theme.hex}
                    type="button"
                    onClick={() => onSetCanvasBackground(theme.hex)}
                    title={theme.name}
                    style={{
                      height: "26px",
                      borderRadius: "6px",
                      backgroundColor: theme.hex,
                      border: `2px solid ${isActive ? "#2563eb" : "#cbd5e1"}`,
                      cursor: "pointer",
                      boxShadow: isActive ? "0 0 0 2px rgba(37, 99, 235, 0.25)" : "none",
                      transition: "transform 0.1s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  />
                );
              })}
            </div>
          </div>

          {/* Document Summary Card */}
          <div
            style={{
              padding: "0.875rem",
              borderRadius: "8px",
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              fontSize: "0.75rem",
              color: "#64748b",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Active Page:</span>
              <span style={{ color: "#0f172a", fontWeight: 600 }}>
                Page {activePageIndex + 1} of {document.pages?.length || 1}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Page Elements:</span>
              <span style={{ color: "#0f172a", fontWeight: 600 }}>
                {document.pages?.[activePageIndex]?.elements?.length || 0}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Orientation:</span>
              <span style={{ color: "#0f172a", fontWeight: 600 }}>
                {document.width >= document.height ? "Landscape" : "Portrait"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================== */
        /* 2. ELEMENT SELECTED: CONTEXTUAL INSPECTOR  */
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
                  color: "#2563eb",
                }}
              >
                {selectedElement.type === "svg"
                  ? "SVG Vector Asset"
                  : selectedElement.type === "shape"
                  ? (selectedElement.properties as ShapeProperties)?.shapeType?.toUpperCase() ||
                    "SHAPE"
                  : selectedElement.type === "text"
                  ? "TYPOGRAPHY"
                  : "IMAGE ASSET"}
              </span>
              <h2
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: "2px 0 0",
                  maxWidth: "170px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedElement.name || selectedElement.type}
              </h2>
            </div>

            {/* Quick Actions: Duplicate & Delete */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
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
                style={{ color: "#dc2626" }}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>

          {/* Alignment Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 700,
              }}
            >
              Align to Canvas
            </span>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: "3px",
                backgroundColor: "#f8fafc",
                padding: "3px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => handleAlign("left")}
                title="Align Left"
                style={{
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  borderRadius: "5px",
                  color: "#475569",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e2e8f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <AlignLeft size={14} />
              </button>

              <button
                type="button"
                onClick={() => handleAlign("center")}
                title="Center Horizontally"
                style={{
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  borderRadius: "5px",
                  color: "#475569",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e2e8f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <AlignCenter size={14} />
              </button>

              <button
                type="button"
                onClick={() => handleAlign("right")}
                title="Align Right"
                style={{
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  borderRadius: "5px",
                  color: "#475569",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e2e8f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <AlignRight size={14} />
              </button>

              <button
                type="button"
                onClick={() => handleAlign("top")}
                title="Align Top"
                style={{
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  borderRadius: "5px",
                  color: "#475569",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e2e8f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <ArrowUp size={14} />
              </button>

              <button
                type="button"
                onClick={() => handleAlign("middle")}
                title="Center Vertically"
                style={{
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  borderRadius: "5px",
                  color: "#475569",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e2e8f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <AlignJustify size={14} />
              </button>

              <button
                type="button"
                onClick={() => handleAlign("bottom")}
                title="Align Bottom"
                style={{
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  borderRadius: "5px",
                  color: "#475569",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e2e8f0")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <ArrowDown size={14} />
              </button>
            </div>
          </div>

          {/* Layer Ordering Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 700,
              }}
            >
              Layer Order
            </span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "4px",
                backgroundColor: "#f8fafc",
                padding: "3px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
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
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 700,
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
                <span style={{ fontSize: "0.75rem", color: "#334155" }}>Rotation</span>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>
                  {selectedElement.rotation || 0}°
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={selectedElement.rotation || 0}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, { rotation: Number(e.target.value) })
                  }
                  style={{ accentColor: "#2563eb", cursor: "pointer", flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => handleRotateDelta(-90)}
                  title="Rotate -90°"
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRotateDelta(90)}
                  title="Rotate +90°"
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <RotateCw size={12} />
                </button>
              </div>
            </div>

            {/* Opacity */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span style={{ fontSize: "0.75rem", color: "#334155" }}>Opacity</span>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>
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
                style={{ accentColor: "#2563eb", cursor: "pointer" }}
              />

              <div style={{ display: "flex", gap: "4px" }}>
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onUpdateElement(selectedElement.id, { opacity: pct / 100 })}
                    style={{
                      flex: 1,
                      padding: "3px 0",
                      borderRadius: "4px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      color: "#475569",
                      fontSize: "10px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ height: "1px", backgroundColor: "#e2e8f0" }} />

          {/* ========================================== */}
          {/* SVG SPECIFIC: VECTOR COLOR TUNING          */}
          {/* ========================================== */}
          {selectedElement.type === "svg" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 700,
                  }}
                >
                  Vector Color Tuning
                </span>
                <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px", margin: 0 }}>
                  Customize illustration fills and outlines
                </p>
              </div>

              {/* Primary Fill Color */}
              <ColorPicker
                label="Primary Fill Color"
                value={(selectedElement.properties as SvgProperties).fill || "#2563eb"}
                onChange={(c) => onUpdateSvgColor(c, undefined)}
              />

              {/* Stroke / Outline Color */}
              <ColorPicker
                label="Outline / Stroke Color"
                value={(selectedElement.properties as SvgProperties).stroke || "#1d4ed8"}
                onChange={(c) => onUpdateSvgColor(undefined, c)}
              />

              {/* Dynamic Multi-Color Palette Swatches */}
              {detectedSvgColors.length > 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                    Detected Illustration Colors ({detectedSvgColors.length})
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      padding: "6px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {detectedSvgColors.map((hex) => (
                      <div
                        key={hex}
                        title={`Replace color ${hex}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          backgroundColor: "#ffffff",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <span
                          style={{
                            width: "14px",
                            height: "14px",
                            borderRadius: "3px",
                            backgroundColor: hex,
                            border: "1px solid rgba(0,0,0,0.15)",
                          }}
                        />
                        <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#475569" }}>
                          {hex}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reset Original Colors */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onResetSvgColors) {
                    onResetSvgColors();
                  } else {
                    const props = selectedElement.properties as SvgProperties;
                    onUpdateElement(selectedElement.id, {
                      properties: {
                        ...props,
                        svgContent: props.originalSvg,
                        fill: undefined,
                        stroke: undefined,
                      },
                    });
                  }
                }}
              >
                Reset to Original Colors
              </Button>
            </div>
          )}

          {/* ========================================== */}
          {/* TEXT SPECIFIC: CONTENT, FONT & ALIGNMENT   */}
          {/* ========================================== */}
          {selectedElement.type === "text" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontWeight: 700,
                }}
              >
                Typography Styling
              </span>

              {/* Text Content */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.75rem", color: "#334155", fontWeight: 500 }}>
                  Content
                </span>
                <textarea
                  value={(selectedElement.properties as TextProperties).text || ""}
                  onChange={(e) =>
                    onUpdateElement(selectedElement.id, {
                      properties: {
                        ...selectedElement.properties,
                        text: e.target.value,
                      },
                    })
                  }
                  rows={2}
                  style={{
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.8125rem",
                    color: "#0f172a",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Font Family Dropdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.75rem", color: "#334155", fontWeight: 500 }}>
                  Font Family
                </span>
                <select
                  value={
                    (selectedElement.properties as TextProperties).fontFamily ||
                    "Inter, -apple-system, sans-serif"
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
                    height: "36px",
                    padding: "0 8px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    fontSize: "0.8125rem",
                    color: "#0f172a",
                    outline: "none",
                  }}
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Size & Style Stepper */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <Input
                  label="Font Size"
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

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "0.75rem", color: "#334155", fontWeight: 500 }}>
                    Formatting
                  </span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {/* Bold */}
                    <button
                      type="button"
                      onClick={() => {
                        const current =
                          (selectedElement.properties as TextProperties).fontWeight === "bold";
                        onUpdateElement(selectedElement.id, {
                          properties: {
                            ...selectedElement.properties,
                            fontWeight: current ? "normal" : "bold",
                          },
                        });
                      }}
                      style={{
                        flex: 1,
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor:
                          (selectedElement.properties as TextProperties).fontWeight === "bold"
                            ? "#eff6ff"
                            : "#f8fafc",
                        border: `1px solid ${
                          (selectedElement.properties as TextProperties).fontWeight === "bold"
                            ? "#2563eb"
                            : "#e2e8f0"
                        }`,
                        color:
                          (selectedElement.properties as TextProperties).fontWeight === "bold"
                            ? "#2563eb"
                            : "#475569",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <Bold size={15} />
                    </button>

                    {/* Italic */}
                    <button
                      type="button"
                      onClick={() => {
                        const current =
                          (selectedElement.properties as TextProperties).fontStyle === "italic";
                        onUpdateElement(selectedElement.id, {
                          properties: {
                            ...selectedElement.properties,
                            fontStyle: current ? "normal" : "italic",
                          },
                        });
                      }}
                      style={{
                        flex: 1,
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor:
                          (selectedElement.properties as TextProperties).fontStyle === "italic"
                            ? "#eff6ff"
                            : "#f8fafc",
                        border: `1px solid ${
                          (selectedElement.properties as TextProperties).fontStyle === "italic"
                            ? "#2563eb"
                            : "#e2e8f0"
                        }`,
                        color:
                          (selectedElement.properties as TextProperties).fontStyle === "italic"
                            ? "#2563eb"
                            : "#475569",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <Italic size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Text Alignment */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.75rem", color: "#334155", fontWeight: 500 }}>
                  Alignment
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "4px",
                    backgroundColor: "#f8fafc",
                    padding: "3px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {(["left", "center", "right"] as const).map((align) => {
                    const isSelected =
                      ((selectedElement.properties as TextProperties).align || "left") === align;
                    return (
                      <button
                        key={align}
                        type="button"
                        onClick={() =>
                          onUpdateElement(selectedElement.id, {
                            properties: {
                              ...selectedElement.properties,
                              align,
                            },
                          })
                        }
                        style={{
                          height: "30px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isSelected ? "#ffffff" : "transparent",
                          border: isSelected ? "1px solid #cbd5e1" : "none",
                          borderRadius: "4px",
                          color: isSelected ? "#2563eb" : "#64748b",
                          cursor: "pointer",
                          boxShadow: isSelected ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                        }}
                      >
                        {align === "left" && <AlignLeft size={14} />}
                        {align === "center" && <AlignCenter size={14} />}
                        {align === "right" && <AlignRight size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Text Color */}
              <ColorPicker
                label="Text Color"
                value={(selectedElement.properties as TextProperties).fill || "#000000"}
                onChange={(color) =>
                  onUpdateElement(selectedElement.id, {
                    properties: {
                      ...selectedElement.properties,
                      fill: color,
                    },
                  })
                }
              />
            </div>
          )}

          {/* ========================================== */}
          {/* SHAPE SPECIFIC: GEOMETRY & STYLING         */}
          {/* ========================================== */}
          {selectedElement.type === "shape" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  fontWeight: 700,
                }}
              >
                Shape Geometry & Styling
              </span>

              {/* Fill color */}
              <ColorPicker
                label="Fill Color"
                value={(selectedElement.properties as ShapeProperties).fill || "#2563eb"}
                onChange={(fill) =>
                  onUpdateElement(selectedElement.id, {
                    properties: {
                      ...selectedElement.properties,
                      fill,
                    },
                  })
                }
              />

              {/* Stroke color */}
              {(selectedElement.properties as ShapeProperties).shapeType !== "line" && (
                <ColorPicker
                  label="Outline / Stroke Color"
                  value={
                    (selectedElement.properties as ShapeProperties).stroke || "transparent"
                  }
                  onChange={(stroke) =>
                    onUpdateElement(selectedElement.id, {
                      properties: {
                        ...selectedElement.properties,
                        stroke,
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
                  <span style={{ fontSize: "0.75rem", color: "#334155" }}>Stroke Width</span>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}>
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
                  style={{ accentColor: "#2563eb", cursor: "pointer" }}
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
                    <span style={{ fontSize: "0.75rem", color: "#334155" }}>Corner Radius</span>
                    <span
                      style={{ fontSize: "0.75rem", color: "#64748b", fontFamily: "monospace" }}
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
                    style={{ accentColor: "#2563eb", cursor: "pointer" }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

"use client";

import React from "react";

export interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (color: string) => void;
  presetColors?: string[];
}

const DEFAULT_PRESETS = [
  "#ffffff",
  "#000000",
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#64748b", // Slate
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value,
  onChange,
  presetColors = DEFAULT_PRESETS,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {label && (
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "#a1a1aa",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </span>
      )}

      {/* Hex & native picker input row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div
          style={{
            position: "relative",
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            border: "1px solid #3f3f46",
            overflow: "hidden",
            flexShrink: 0,
            boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
          }}
        >
          <input
            type="color"
            value={value.startsWith("#") && value.length === 7 ? value : "#3b82f6"}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              top: "-50%",
              left: "-50%",
              width: "200%",
              height: "200%",
              cursor: "pointer",
              border: "none",
              padding: 0,
            }}
          />
        </div>

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          style={{
            flex: 1,
            backgroundColor: "#18181b",
            color: "#f4f4f5",
            border: "1px solid #3f3f46",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "0.8125rem",
            fontFamily: "monospace",
            outline: "none",
          }}
        />
      </div>

      {/* Swatch palette */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "6px",
          marginTop: "0.25rem",
        }}
      >
        {presetColors.map((color) => {
          const isSelected = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={`Select color ${color}`}
              style={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: "4px",
                backgroundColor: color,
                border: isSelected ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.15)",
                cursor: "pointer",
                padding: 0,
                outline: "none",
                transform: isSelected ? "scale(1.1)" : "scale(1)",
                transition: "transform 0.1s ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

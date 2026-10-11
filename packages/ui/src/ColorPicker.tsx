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
  "#0f172a",
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#2563eb", // Blue
  "#4f46e5", // Indigo
  "#7c3aed", // Purple
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
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      {label && (
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#475569",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
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
            width: "30px",
            height: "30px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            overflow: "hidden",
            flexShrink: 0,
            boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.05)",
          }}
        >
          <input
            type="color"
            value={value && value.startsWith("#") && value.length === 7 ? value : "#2563eb"}
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
            backgroundColor: "#ffffff",
            color: "#0f172a",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "0.8125rem",
            fontFamily: "monospace",
            outline: "none",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
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
          const isSelected = value?.toLowerCase() === color.toLowerCase();
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
                border: isSelected ? "2px solid #2563eb" : "1px solid rgba(0, 0, 0, 0.15)",
                cursor: "pointer",
                padding: 0,
                outline: "none",
                transform: isSelected ? "scale(1.1)" : "scale(1)",
                transition: "transform 0.1s ease",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

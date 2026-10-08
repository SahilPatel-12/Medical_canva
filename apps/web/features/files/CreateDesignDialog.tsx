"use client";

import React, { useState } from "react";
import { Dialog, Button, Input } from "@design-platform/ui";
import { CreateDesignInput } from "@design-platform/types";
import { Monitor, Smartphone, FileText, Sparkles, Layout } from "lucide-react";

export interface CreateDesignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateDesignInput) => Promise<void>;
}

interface DimensionPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  icon: React.ReactNode;
  description: string;
}

const PRESETS: DimensionPreset[] = [
  {
    id: "standard",
    name: "Standard Canvas",
    width: 1200,
    height: 800,
    icon: <Layout size={18} />,
    description: "Ideal for diagrams & workflows",
  },
  {
    id: "presentation",
    name: "Presentation (16:9)",
    width: 1920,
    height: 1080,
    icon: <Monitor size={18} />,
    description: "Full HD presentation slide",
  },
  {
    id: "poster",
    name: "Bio/Medical Poster",
    width: 1400,
    height: 900,
    icon: <Sparkles size={18} />,
    description: "Detailed scientific illustration",
  },
  {
    id: "square",
    name: "Square (1:1)",
    width: 1080,
    height: 1080,
    icon: <Smartphone size={18} />,
    description: "Figures & square publication graphics",
  },
  {
    id: "document",
    name: "Document / A4",
    width: 1240,
    height: 1754,
    icon: <FileText size={18} />,
    description: "Printable portrait document",
  },
];

export const CreateDesignDialog: React.FC<CreateDesignDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("Untitled Design");
  const [selectedPreset, setSelectedPreset] = useState("standard");
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(800);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectPreset = (preset: DimensionPreset) => {
    setSelectedPreset(preset.id);
    setWidth(preset.width);
    setHeight(preset.height);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      await onSubmit({
        name: name.trim(),
        width: Number(width) || 1200,
        height: Number(height) || 800,
        backgroundColor,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Design"
      description="Choose a preset canvas size or enter custom dimensions"
      maxWidth="540px"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? "Creating..." : "Create Design"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        {/* Design Name */}
        <Input
          label="Design Title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Molecular Pathway Diagram"
          autoFocus
          required
        />

        {/* Presets */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#e4e4e7",
              letterSpacing: "0.01em",
            }}
          >
            Canvas Presets
          </span>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
            {PRESETS.map((preset) => {
              const isSelected = selectedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    backgroundColor: isSelected ? "rgba(59, 130, 246, 0.12)" : "#141417",
                    border: `1px solid ${isSelected ? "#3b82f6" : "#27272a"}`,
                    cursor: "pointer",
                    textAlign: "left",
                    color: "#f4f4f5",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      color: isSelected ? "#60a5fa" : "#71717a",
                      display: "flex",
                      alignItems: "center",
                      marginTop: "2px",
                    }}
                  >
                    {preset.icon}
                  </span>
                  <div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{preset.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#a1a1aa", marginTop: "2px" }}>
                      {preset.width} × {preset.height} px
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Dimensions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Input
            label="Width (px)"
            type="number"
            min={100}
            max={5000}
            value={width}
            onChange={(e) => {
              setWidth(Number(e.target.value));
              setSelectedPreset("custom");
            }}
          />
          <Input
            label="Height (px)"
            type="number"
            min={100}
            max={5000}
            value={height}
            onChange={(e) => {
              setHeight(Number(e.target.value));
              setSelectedPreset("custom");
            }}
          />
        </div>

        {/* Background Color */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#e4e4e7" }}>
            Initial Canvas Background
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {["#ffffff", "#f8fafc", "#f1f5f9", "#0f172a"].map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setBackgroundColor(bg)}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: bg,
                  border: backgroundColor === bg ? "2px solid #3b82f6" : "1px solid #3f3f46",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
      </form>
    </Dialog>
  );
};

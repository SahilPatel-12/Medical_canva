"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Check,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button, Dropdown, DropdownItem } from "@design-platform/ui";
import { SaveStatus } from "@design-platform/editor";

export interface EditorTopBarProps {
  name: string;
  onRename: (newName: string) => void;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;
  onSetZoom: (zoom: number) => void;
  onSave: () => void;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  name,
  onRename,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  onSetZoom,
  onSave,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [titleValue, setTitleValue] = useState(name);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (titleValue.trim() && titleValue.trim() !== name) {
      onRename(titleValue.trim());
    } else {
      setTitleValue(name);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setTitleValue(name);
      setIsEditingName(false);
    }
  };

  const zoomMenuItems: DropdownItem[] = [
    {
      id: "fit",
      label: "Fit to Screen",
      onClick: onFitToScreen,
    },
    {
      id: "zoom-25",
      label: "25%",
      onClick: () => onSetZoom(0.25),
    },
    {
      id: "zoom-50",
      label: "50%",
      onClick: () => onSetZoom(0.5),
    },
    {
      id: "zoom-75",
      label: "75%",
      onClick: () => onSetZoom(0.75),
    },
    {
      id: "zoom-100",
      label: "100% (Actual)",
      onClick: onResetZoom,
    },
    {
      id: "zoom-125",
      label: "125%",
      onClick: () => onSetZoom(1.25),
    },
    {
      id: "zoom-150",
      label: "150%",
      onClick: () => onSetZoom(1.5),
    },
    {
      id: "zoom-200",
      label: "200%",
      onClick: () => onSetZoom(2),
    },
  ];

  return (
    <header
      style={{
        height: "56px",
        backgroundColor: "#0d0d10",
        borderBottom: "1px solid #27272a",
        padding: "0 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        userSelect: "none",
        zIndex: 50,
      }}
    >
      {/* Left: Back button & Title */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link
          href="/files"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "#a1a1aa",
            textDecoration: "none",
            fontSize: "0.8125rem",
            fontWeight: 500,
            padding: "6px 10px",
            borderRadius: "6px",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#18181b";
            e.currentTarget.style.color = "#f4f4f5";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#a1a1aa";
          }}
        >
          <ArrowLeft size={16} />
          <span>Files</span>
        </Link>

        <div style={{ height: "20px", width: "1px", backgroundColor: "#27272a" }} />

        {/* Editable Name */}
        {isEditingName ? (
          <input
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            autoFocus
            style={{
              backgroundColor: "#18181b",
              color: "#f4f4f5",
              border: "1px solid #3b82f6",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "0.875rem",
              fontWeight: 600,
              outline: "none",
              fontFamily: "inherit",
              minWidth: "200px",
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setTitleValue(name);
              setIsEditingName(true);
            }}
            title="Click to rename design"
            style={{
              background: "transparent",
              border: "1px solid transparent",
              borderRadius: "6px",
              padding: "4px 8px",
              color: "#f4f4f5",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
              maxWidth: "280px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              transition: "border-color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3f3f46")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
          >
            {name}
          </button>
        )}

        {/* Save Status Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.75rem",
            color: "#71717a",
            marginLeft: "0.25rem",
          }}
        >
          {saveStatus === "saving" ? (
            <>
              <Loader2 size={12} className="animate-spin" style={{ color: "#3b82f6" }} />
              <span>Saving...</span>
            </>
          ) : saveStatus === "saved" ? (
            <>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#22c55e",
                }}
              />
              <span style={{ color: "#86efac" }}>Saved</span>
            </>
          ) : (
            <>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#f59e0b",
                }}
              />
              <span style={{ color: "#fcd34d" }}>Unsaved changes</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Undo / Redo & Zoom Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {/* Undo / Redo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            backgroundColor: "#141417",
            padding: "2px",
            borderRadius: "8px",
            border: "1px solid #27272a",
          }}
        >
          <Button
            variant="icon"
            size="xs"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl/Cmd + Z)"
          >
            <Undo2 size={15} />
          </Button>
          <Button
            variant="icon"
            size="xs"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl/Cmd + Shift + Z)"
          >
            <Redo2 size={15} />
          </Button>
        </div>

        <div style={{ height: "16px", width: "1px", backgroundColor: "#27272a" }} />

        {/* Zoom Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            backgroundColor: "#141417",
            padding: "2px",
            borderRadius: "8px",
            border: "1px solid #27272a",
          }}
        >
          <Button variant="icon" size="xs" onClick={onZoomOut} title="Zoom Out (Ctrl/Cmd + Minus)">
            <ZoomOut size={15} />
          </Button>

          {/* Interactive Zoom Dropdown */}
          <Dropdown
            align="right"
            trigger={
              <button
                type="button"
                title="Zoom Presets"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#e4e4e7",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0 6px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  minWidth: "52px",
                  justifyContent: "center",
                }}
              >
                <span>{Math.round(zoom * 100)}%</span>
                <ChevronDown size={12} style={{ color: "#71717a" }} />
              </button>
            }
            items={zoomMenuItems}
          />

          <Button variant="icon" size="xs" onClick={onZoomIn} title="Zoom In (Ctrl/Cmd + Plus)">
            <ZoomIn size={15} />
          </Button>

          <Button variant="icon" size="xs" onClick={onFitToScreen} title="Fit to Screen">
            <Maximize2 size={14} />
          </Button>
        </div>
      </div>

      {/* Right: Save Button */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Button
          variant="primary"
          size="sm"
          onClick={onSave}
          icon={saveStatus === "saved" ? <Check size={14} /> : <Save size={14} />}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saved" ? "Saved" : "Save"}
        </Button>
      </div>
    </header>
  );
};

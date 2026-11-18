"use client";

import React, { useState, useEffect } from "react";
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
  Share2,
  Download,
  HelpCircle,
  X,
  Keyboard,
  FileImage,
  FileCode,
  Sparkles,
  Presentation,
} from "lucide-react";
import { Button, Dropdown, DropdownItem, Badge, ThemeToggle } from "@design-platform/ui";
import { SaveStatus } from "@design-platform/editor";
import { CollaboratorInfo } from "@design-platform/types";

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
  isReadOnly?: boolean;
  onShareClick?: () => void;
  /** Opens the keyboard shortcuts sheet */
  onOpenShortcuts?: () => void;
  onExportPng?: () => void;
  onExportJson?: () => void;
  collaborators?: CollaboratorInfo[];
  connectionStatus?: "connected" | "connecting" | "reconnecting" | "disconnected";
  canManageShare?: boolean;
  /** Starts presenting full screen from the current page */
  onPresent?: () => void;
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
  isReadOnly = false,
  onShareClick,
  onExportPng,
  onExportJson,
  collaborators = [],
  connectionStatus,
  canManageShare = true,
  onOpenShortcuts,
  onPresent,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [titleValue, setTitleValue] = useState(name);

  useEffect(() => {
    setTitleValue(name);
  }, [name]);


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

  const exportMenuItems: DropdownItem[] = [
    ...(onExportPng
      ? [
          {
            id: "export-png",
            label: "Export PNG (High Resolution)",
            icon: <FileImage size={15} style={{ color: "#047857" }} />,
            onClick: onExportPng,
          },
        ]
      : []),
    ...(onExportJson
      ? [
          {
            id: "export-json",
            label: "Export Document (JSON)",
            icon: <FileCode size={15} style={{ color: "#64748b" }} />,
            onClick: onExportJson,
          },
        ]
      : []),
  ];

  return (
    <>
      <header
        style={{
          height: "56px",
          backgroundColor: "var(--surface, #ffffff)",
          borderBottom: "1px solid var(--border, #e2e8f0)",
          padding: "0 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          userSelect: "none",
          zIndex: 50,
          boxShadow: "var(--shadow-xs, 0 1px 3px 0 rgba(0, 0, 0, 0.04))",
        }}
      >
        {/* Left: Brand mark, Back button, Editable Name & Save Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", minWidth: 0 }}>
          {/* Brand Mark & Files Link */}
          <Link
            href="/files"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--foreground-secondary, #475569)",
              textDecoration: "none",
              fontSize: "0.8125rem",
              fontWeight: 600,
              padding: "6px 10px",
              borderRadius: "8px",
              transition: "all 0.15s ease",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-hover, #f1f5f9)";
              e.currentTarget.style.color = "var(--foreground, #0f172a)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--foreground-secondary, #475569)";
            }}
            title="Return to files"
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                backgroundColor: "var(--primary-subtle, #ecfdf5)",
                border: "1px solid var(--primary-border, #a7f3d0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary, #047857)",
              }}
            >
              <ArrowLeft size={14} />
            </div>
            <span>Files</span>
          </Link>

          <div style={{ height: "20px", width: "1px", backgroundColor: "var(--border, #e2e8f0)" }} />

          {/* Editable Name */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            {isEditingName ? (
              <input
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                autoFocus
                style={{
                  backgroundColor: "var(--input-bg, var(--surface, #ffffff))",
                  color: "var(--foreground, #0f172a)",
                  border: "1px solid var(--primary, #047857)",
                  boxShadow: "0 0 0 3px var(--primary-glow, rgba(4, 120, 87, 0.15))",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  outline: "none",
                  fontFamily: "inherit",
                  minWidth: "180px",
                  maxWidth: "280px",
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
                  color: "var(--foreground, #0f172a)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  maxWidth: "240px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-strong, #cbd5e1)";
                  e.currentTarget.style.backgroundColor = "var(--surface-hover, #f8fafc)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "transparent";
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {name}
              </button>
            )}

            {/* Save Status Indicator */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "0.75rem",
                color: "var(--foreground-muted, #64748b)",
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: "var(--surface-muted, #f8fafc)",
                border: "1px solid var(--border, #e2e8f0)",
              }}
            >
              {saveStatus === "saving" ? (
                <>
                  <Loader2 size={12} className="animate-spin" style={{ color: "#047857" }} />
                  <span style={{ color: "#047857", fontWeight: 500 }}>Saving...</span>
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#16a34a",
                    }}
                  />
                  <span style={{ color: "#16a34a", fontWeight: 500 }}>Saved</span>
                </>
              ) : (
                <>
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#d97706",
                    }}
                  />
                  <span style={{ color: "#b45309", fontWeight: 500 }}>Unsaved changes</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Undo / Redo & Zoom Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          {/* Undo / Redo Segment */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
              backgroundColor: "#f8fafc",
              padding: "2px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
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

          <div style={{ height: "16px", width: "1px", backgroundColor: "#e2e8f0" }} />

          {/* Zoom Controls Segment */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
              backgroundColor: "var(--surface-muted, #f8fafc)",
              padding: "2px",
              borderRadius: "8px",
              border: "1px solid var(--border, #e2e8f0)",
            }}
          >
            <Button
              variant="icon"
              size="xs"
              onClick={onZoomOut}
              title="Zoom Out (Ctrl/Cmd + Minus)"
            >
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
                    color: "var(--foreground, #0f172a)",
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
                  <ChevronDown size={12} style={{ color: "var(--foreground-muted, #64748b)" }} />
                </button>
              }
              items={zoomMenuItems}
            />

            <Button
              variant="icon"
              size="xs"
              onClick={onZoomIn}
              title="Zoom In (Ctrl/Cmd + Plus)"
            >
              <ZoomIn size={15} />
            </Button>

            <Button
              variant="icon"
              size="xs"
              onClick={onFitToScreen}
              title="Fit to Screen (Cmd + 0)"
            >
              <Maximize2 size={14} />
            </Button>
          </div>
        </div>

        {/* Right: ThemeToggle, Shortcuts, Collaborators, Export, Save & Share */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          {/* Light / Dark Mode Toggle */}
          <ThemeToggle size="sm" />

          {/* Keyboard shortcuts sheet */}
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                color: "var(--foreground-muted, #64748b)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface-hover, #f1f5f9)";
                e.currentTarget.style.color = "var(--foreground, #0f172a)";
                e.currentTarget.style.borderColor = "var(--border-strong, #cbd5e1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--surface, #ffffff)";
                e.currentTarget.style.color = "var(--foreground-muted, #64748b)";
                e.currentTarget.style.borderColor = "var(--border, #e2e8f0)";
              }}
            >
              <HelpCircle size={15} />
            </button>
          )}

          {/* Connection Status Indicator */}
          {connectionStatus && (
            <div
              title={`Real-time sync: ${connectionStatus}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 8px",
                borderRadius: "6px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: "11px",
                color:
                  connectionStatus === "connected"
                    ? "#16a34a"
                    : connectionStatus === "reconnecting"
                    ? "#d97706"
                    : "#64748b",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor:
                    connectionStatus === "connected"
                      ? "#16a34a"
                      : connectionStatus === "reconnecting"
                      ? "#d97706"
                      : "#dc2626",
                }}
              />
              <span style={{ fontSize: "10px", textTransform: "capitalize", fontWeight: 600 }}>
                {connectionStatus === "connected" ? "Live" : connectionStatus}
              </span>
            </div>
          )}

          {/* Collaborators Avatar Stack */}
          {collaborators.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", marginRight: "4px" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                {collaborators.slice(0, 3).map((c, idx) => {
                  const initial = (c.name || "U")[0]?.toUpperCase() || "U";
                  return (
                    <div
                      key={c.clientId}
                      title={`${c.name} (Active collaborator)`}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: c.color,
                        color: "#ffffff",
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid #ffffff",
                        marginLeft: idx > 0 ? "-8px" : 0,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        userSelect: "none",
                        cursor: "default",
                        transition: "transform 0.1s ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.transform = "scale(1.15) translateY(-1px)")
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1) translateY(0)")}
                    >
                      {initial}
                    </div>
                  );
                })}
                {collaborators.length > 3 && (
                  <div
                    title={`${collaborators.length - 3} more collaborators`}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      backgroundColor: "#f1f5f9",
                      color: "#475569",
                      fontSize: "10px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid #ffffff",
                      marginLeft: "-8px",
                    }}
                  >
                    +{collaborators.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Export Dropdown Button */}
          {exportMenuItems.length > 0 && (
            <Dropdown
              align="right"
              trigger={
                <Button variant="secondary" size="sm" icon={<Download size={14} />}>
                  Export
                </Button>
              }
              items={exportMenuItems}
            />
          )}

          {/* Save Button or Read-Only Badge */}
          {isReadOnly ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Badge variant="outline" size="sm">
                VIEWER (READ ONLY)
              </Badge>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={onSave}
              icon={saveStatus === "saved" ? <Check size={14} /> : <Save size={14} />}
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saved" ? "Saved" : "Save"}
            </Button>
          )}

          {/* Present Button (full-screen slideshow, also for viewers) */}
          {onPresent && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onPresent}
              icon={<Presentation size={14} style={{ color: "#047857" }} />}
              title="Present full screen"
            >
              Present
            </Button>
          )}

          {/* Share Button */}
          {onShareClick && canManageShare && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onShareClick}
              icon={<Share2 size={14} style={{ color: "#047857" }} />}
            >
              Share
            </Button>
          )}
        </div>
      </header>

    </>
  );
};

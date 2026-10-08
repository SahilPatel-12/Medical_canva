"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { DesignDocument } from "@design-platform/types";
import { useEditor } from "@design-platform/editor";
import { getDesignRepository } from "../../lib/repository";
import { EditorTopBar } from "./EditorTopBar";
import { EditorLeftPanel } from "./EditorLeftPanel";
import { EditorPropertiesPanel } from "./EditorPropertiesPanel";
import { Button } from "@design-platform/ui";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  Copy,
  Trash2,
} from "lucide-react";

export interface EditorViewProps {
  designId: string;
}

export const EditorView: React.FC<EditorViewProps> = ({ designId }) => {
  const repository = useMemo(() => getDesignRepository(), []);
  const [initialDoc, setInitialDoc] = useState<DesignDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchDesign() {
      try {
        setIsLoading(true);
        const doc = await repository.getById(designId);
        if (!doc) {
          if (isMounted) setError("Design not found or has been deleted.");
          return;
        }
        if (isMounted) setInitialDoc(doc);
      } catch (err) {
        if (isMounted) setError("Failed to load design.");
        console.error(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchDesign();

    return () => {
      isMounted = false;
    };
  }, [designId, repository]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: "#09090b",
          color: "#a1a1aa",
          gap: "1rem",
        }}
      >
        <Loader2 size={32} className="animate-spin" style={{ color: "#3b82f6" }} />
        <span style={{ fontSize: "0.875rem" }}>Opening design studio...</span>
      </div>
    );
  }

  if (error || !initialDoc) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: "#09090b",
          color: "#f4f4f5",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ef4444",
            marginBottom: "1rem",
          }}
        >
          <AlertCircle size={28} />
        </div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Design Not Found
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#a1a1aa",
            maxWidth: "360px",
            marginBottom: "1.5rem",
          }}
        >
          {error || "The requested design document could not be retrieved."}
        </p>
        <Link href="/files" style={{ textDecoration: "none" }}>
          <Button variant="primary" size="md" icon={<ArrowLeft size={16} />}>
            Back to My Files
          </Button>
        </Link>
      </div>
    );
  }

  return <EditorStudio initialDocument={initialDoc} repository={repository} />;
};

interface EditorStudioProps {
  initialDocument: DesignDocument;
  repository: ReturnType<typeof getDesignRepository>;
}

const EditorStudio: React.FC<EditorStudioProps> = ({ initialDocument, repository }) => {
  const {
    containerRef,
    state,
    selectedElement,
    save,
    addAssetToCenter,
    addShape,
    addText,
    updateElement,
    deleteElement,
    duplicateElement,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    updateSelectedSvgColor,
    setCanvasBackgroundColor,
    renameDocument,
    undo,
    redo,
    setZoom,
    zoomIn,
    zoomOut,
    fitToScreen,
    resetZoom,
  } = useEditor({ initialDocument, repository });

  // Auto-save periodically if dirty
  useEffect(() => {
    const timer = setInterval(() => {
      if (state.saveStatus === "unsaved") {
        save();
      }
    }, 12000);

    return () => clearInterval(timer);
  }, [state.saveStatus, save]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#09090b",
        overflow: "hidden",
      }}
    >
      {/* Top Bar */}
      <EditorTopBar
        name={state.document.name}
        onRename={renameDocument}
        saveStatus={state.saveStatus}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        onUndo={undo}
        onRedo={redo}
        zoom={state.zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
        onFitToScreen={fitToScreen}
        onSetZoom={setZoom}
        onSave={save}
      />

      {/* Main Studio Body: Left Panel + Canvas + Right Properties */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Left Toolbar & Library */}
        <EditorLeftPanel onAddAsset={addAssetToCenter} onAddShape={addShape} onAddText={addText} />

        {/* Center Canvas Viewport */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#111114",
            backgroundImage: "radial-gradient(circle, #27272a 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Konva Stage Mount Point */}
          <div
            ref={containerRef}
            style={{
              width: "100%",
              height: "100%",
              outline: "none",
            }}
          />

          {/* Floating Element Quick-Action Bar */}
          {selectedElement && (
            <div
              style={{
                position: "absolute",
                top: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                backgroundColor: "rgba(18, 18, 21, 0.94)",
                backdropFilter: "blur(12px)",
                padding: "4px 8px",
                borderRadius: "10px",
                border: "1px solid #3b82f6",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(59, 130, 246, 0.25)",
                zIndex: 30,
                userSelect: "none",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#f4f4f5",
                  padding: "0 6px",
                  maxWidth: "140px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={selectedElement.name || selectedElement.type}
              >
                {selectedElement.name || selectedElement.type}
              </span>

              <div style={{ width: "1px", height: "16px", backgroundColor: "#27272a" }} />

              <button
                type="button"
                onClick={() => duplicateElement(selectedElement.id)}
                title="Duplicate Element (Ctrl/Cmd + D)"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  color: "#e4e4e7",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 0.1s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#27272a")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Copy size={13} style={{ color: "#3b82f6" }} />
                <span>Copy</span>
              </button>

              <button
                type="button"
                onClick={() => deleteElement(selectedElement.id)}
                title="Delete Element (Delete / Backspace)"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  color: "#f87171",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 0.1s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.15)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            </div>
          )}

          {/* Floating Navigation Hint (Bottom Left) */}
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              left: "16px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "rgba(18, 18, 21, 0.8)",
              backdropFilter: "blur(8px)",
              padding: "5px 10px",
              borderRadius: "8px",
              border: "1px solid rgba(39, 39, 42, 0.7)",
              fontSize: "11px",
              color: "#a1a1aa",
              pointerEvents: "none",
              userSelect: "none",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            }}
          >
            <Hand size={13} style={{ color: "#3b82f6" }} />
            <span>Scroll / Pinch to zoom • Hold Space to pan</span>
          </div>

          {/* Floating Canvas Zoom Bar (Bottom Right) */}
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              right: "16px",
              display: "flex",
              alignItems: "center",
              gap: "3px",
              backgroundColor: "rgba(18, 18, 21, 0.85)",
              backdropFilter: "blur(10px)",
              padding: "4px 6px",
              borderRadius: "10px",
              border: "1px solid #27272a",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
              zIndex: 20,
              userSelect: "none",
            }}
          >
            <button
              type="button"
              onClick={zoomOut}
              title="Zoom Out (Ctrl/Cmd + Minus)"
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                borderRadius: "6px",
                color: "#d4d4d8",
                cursor: "pointer",
                transition: "background-color 0.1s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#27272a")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <ZoomOut size={15} />
            </button>

            <button
              type="button"
              onClick={resetZoom}
              title="Click to reset to 100% (Ctrl/Cmd + 0)"
              style={{
                padding: "2px 8px",
                height: "28px",
                background: "transparent",
                border: "none",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                fontFamily: "monospace",
                cursor: "pointer",
                transition: "background-color 0.1s ease",
                minWidth: "48px",
                textAlign: "center",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#27272a")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {Math.round(state.zoom * 100)}%
            </button>

            <button
              type="button"
              onClick={zoomIn}
              title="Zoom In (Ctrl/Cmd + Plus)"
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                borderRadius: "6px",
                color: "#d4d4d8",
                cursor: "pointer",
                transition: "background-color 0.1s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#27272a")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <ZoomIn size={15} />
            </button>

            <div
              style={{ width: "1px", height: "16px", backgroundColor: "#27272a", margin: "0 2px" }}
            />

            <button
              type="button"
              onClick={fitToScreen}
              title="Fit to Screen (Ctrl/Cmd + 9)"
              style={{
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                borderRadius: "6px",
                color: "#d4d4d8",
                cursor: "pointer",
                transition: "background-color 0.1s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#27272a")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* Right Properties Panel */}
        <EditorPropertiesPanel
          document={state.document}
          selectedElement={selectedElement}
          onUpdateElement={updateElement}
          onDeleteElement={deleteElement}
          onDuplicateElement={duplicateElement}
          onBringForward={bringForward}
          onSendBackward={sendBackward}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          onUpdateSvgColor={updateSelectedSvgColor}
          onSetCanvasBackground={setCanvasBackgroundColor}
        />
      </div>
    </div>
  );
};

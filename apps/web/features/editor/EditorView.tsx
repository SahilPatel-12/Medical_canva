"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DesignDocument } from "@design-platform/types";
import { useEditor } from "@design-platform/editor";
import { getDesignRepository } from "../../lib/repository";
import { EditorTopBar } from "./EditorTopBar";
import { EditorLeftPanel, LeftPanelTab } from "./EditorLeftPanel";
import { EditorPropertiesPanel } from "./EditorPropertiesPanel";
import { EditorBottomBar } from "./EditorBottomBar";
import { EditorGridViewModal } from "./EditorGridViewModal";
import { Button } from "@design-platform/ui";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Hand,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Crosshair,
  SlidersHorizontal,
  Sparkles,
  LibraryBig,
  Type,
  Shapes,
  Upload,
} from "lucide-react";
import { useAuth } from "@design-platform/auth";
import { ShareDialog } from "../sharing/ShareDialog";
import { useDesignCollaboration } from "../collaboration/useDesignCollaboration";

export interface EditorViewProps {
  designId: string;
}

export const EditorView: React.FC<EditorViewProps> = ({ designId }) => {
  const router = useRouter();
  const { user, currentWorkspace, isLoading: isAuthLoading } = useAuth();
  const repository = useMemo(
    () => getDesignRepository({ workspaceId: currentWorkspace?.id, userId: user?.id }),
    [currentWorkspace?.id, user?.id]
  );
  const [initialDoc, setInitialDoc] = useState<DesignDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.replace(`/login?redirectTo=/editor/${designId}`);
    }
  }, [isAuthLoading, user, router, designId]);

  useEffect(() => {
    let isMounted = true;

    async function fetchDesign() {
      if (isAuthLoading) return;
      if (!currentWorkspace?.id) {
        if (isMounted) {
          setError("No active workspace found.");
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);
        const doc = await repository.getById(designId, currentWorkspace.id);
        if (!doc) {
          if (isMounted) setError("Design not found or access denied.");
          return;
        }
        if (isMounted) setInitialDoc(doc);
      } catch (err) {
        if (isMounted) setError("Failed to load design or access denied.");
        console.error(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchDesign();

    return () => {
      isMounted = false;
    };
  }, [designId, repository, currentWorkspace?.id, isAuthLoading]);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: "#f8fafc",
          color: "#64748b",
          gap: "1rem",
        }}
      >
        <Loader2 size={36} className="animate-spin" style={{ color: "#2563eb" }} />
        <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Opening design studio...</span>
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
          backgroundColor: "#f8fafc",
          color: "#0f172a",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            backgroundColor: "#fee2e2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#dc2626",
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
            color: "#64748b",
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

  const isReadOnly = currentWorkspace?.role === "viewer";
  return (
    <EditorStudio
      initialDocument={initialDoc}
      repository={repository}
      isReadOnly={isReadOnly}
    />
  );
};

interface EditorStudioProps {
  initialDocument: DesignDocument;
  repository: ReturnType<typeof getDesignRepository>;
  isReadOnly?: boolean;
}

const EditorStudio: React.FC<EditorStudioProps> = ({
  initialDocument,
  repository,
  isReadOnly = false,
}) => {
  const { user } = useAuth();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isGridViewOpen, setIsGridViewOpen] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>("assets");
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

  const {
    containerRef,
    state,
    store,
    selectedElement,
    selectElement,
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
    updateSelectedSvgColorMap,
    resetSelectedSvgColors,
    setCanvasBackgroundColor,
    exportImage,
    renameDocument,
    undo,
    redo,
    activePageIndex,
    pages,
    setActivePage,
    addPage,
    duplicatePage,
    deletePage,
    reorderPages,
    setZoom,
    zoomIn,
    zoomOut,
    fitToScreen,
    resetZoom,
  } = useEditor({ initialDocument, repository, isReadOnly });

  const handleExportPng = () => {
    const dataUrl = exportImage(2.0);
    if (!dataUrl) {
      alert("Unable to export canvas image at this time.");
      return;
    }
    const link = document.createElement("a");
    link.download = `${state.document.name || "design"}-page-${activePageIndex + 1}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state.document, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${state.document.name || "design"}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const {
    collaborators,
    connectionStatus,
    hasEditPermission,
    permissionWarning,
  } = useDesignCollaboration({
    designId: state.document.id,
    store,
    currentUser: user,
    isReadOnly,
  });

  const effectiveReadOnly = isReadOnly || !hasEditPermission;

  // Auto-save periodically if dirty (disabled in read-only viewer mode)
  useEffect(() => {
    if (effectiveReadOnly) return;
    const timer = setInterval(() => {
      if (state.saveStatus === "unsaved") {
        save();
      }
    }, 12000);

    return () => clearInterval(timer);
  }, [state.saveStatus, save, effectiveReadOnly]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      {permissionWarning && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            borderBottom: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "8px 16px",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            zIndex: 60,
          }}
        >
          <AlertCircle size={14} style={{ color: "#dc2626" }} />
          <span>{permissionWarning}</span>
        </div>
      )}

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
        onExportPng={handleExportPng}
        onExportJson={handleExportJson}
        isReadOnly={effectiveReadOnly}
        onShareClick={() => setIsShareOpen(true)}
        collaborators={collaborators}
        connectionStatus={connectionStatus}
        canManageShare={!isReadOnly}
      />

      {/* Main Studio Body: Contextual Left Panel + Expanded Center Canvas */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Contextual Left Toolbar & Inspector */}
        <EditorLeftPanel
          activeTab={leftPanelTab}
          onTabChange={setLeftPanelTab}
          isCollapsed={isLeftPanelCollapsed}
          onToggleCollapse={() => setIsLeftPanelCollapsed((prev) => !prev)}
          onAddAsset={addAssetToCenter}
          onAddShape={addShape}
          onAddText={addText}
          document={state.document}
          selectedElement={selectedElement}
          activePageIndex={activePageIndex}
          onSelectElement={selectElement}
          onUpdateElement={updateElement}
          onDeleteElement={deleteElement}
          onDuplicateElement={duplicateElement}
          onBringForward={bringForward}
          onSendBackward={sendBackward}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          onUpdateSvgColor={updateSelectedSvgColor}
          onUpdateSvgColorMap={updateSelectedSvgColorMap}
          onResetSvgColors={resetSelectedSvgColors}
          onSetCanvasBackground={setCanvasBackgroundColor}
        />

        {/* Center Canvas Viewport (Maximized Area) */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#eef2f6",
            backgroundImage: "radial-gradient(circle, #cbd5e1 1.25px, transparent 1.25px)",
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

          {/* Empty Canvas Guidance Card */}
          {(!pages[activePageIndex]?.elements || pages[activePageIndex].elements.length === 0) && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(12px)",
                padding: "2rem 2.5rem",
                borderRadius: "16px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
                maxWidth: "460px",
                pointerEvents: "auto",
                zIndex: 25,
                userSelect: "none",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  backgroundColor: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#2563eb",
                  marginBottom: "1rem",
                }}
              >
                <Sparkles size={24} />
              </div>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.375rem" }}>
                Start your scientific illustration
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
                Add a scientific illustration from the library, insert text or shapes, or upload your own files.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem", width: "100%" }}>
                <button
                  type="button"
                  onClick={() => {
                    setLeftPanelTab("assets");
                    setIsLeftPanelCollapsed(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)",
                  }}
                >
                  <LibraryBig size={14} />
                  <span>Browse Assets</span>
                </button>
                <button
                  type="button"
                  onClick={() => addText("heading")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#f8fafc",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Type size={14} />
                  <span>Add Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => addShape("rectangle")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#f8fafc",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Shapes size={14} />
                  <span>Add Shape</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeftPanelTab("uploads");
                    setIsLeftPanelCollapsed(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "#f8fafc",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Upload size={14} />
                  <span>Upload File</span>
                </button>
              </div>
            </div>
          )}

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
                gap: "3px",
                backgroundColor: "rgba(255, 255, 255, 0.96)",
                backdropFilter: "blur(12px)",
                padding: "4px 8px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
                zIndex: 30,
                userSelect: "none",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#0f172a",
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

              <div style={{ width: "1px", height: "16px", backgroundColor: "#e2e8f0" }} />

              {/* Edit Properties Button */}
              <button
                type="button"
                onClick={() => {
                  setLeftPanelTab("properties");
                  setIsLeftPanelCollapsed(false);
                }}
                title="Edit Properties & Vector Colors"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "6px",
                  color: "#2563eb",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background-color 0.1s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#dbeafe")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#eff6ff")}
              >
                <SlidersHorizontal size={13} />
                <span>Edit</span>
              </button>

              {/* Duplicate */}
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
                  color: "#334155",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 0.1s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Copy size={13} style={{ color: "#2563eb" }} />
                <span>Copy</span>
              </button>

              {/* Layer Forward */}
              <button
                type="button"
                onClick={() => bringForward(selectedElement.id)}
                title="Bring Forward (])"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "4px 6px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  color: "#475569",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <ArrowUp size={13} />
              </button>

              {/* Layer Backward */}
              <button
                type="button"
                onClick={() => sendBackward(selectedElement.id)}
                title="Send Backward ([)"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "4px 6px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  color: "#475569",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <ArrowDown size={13} />
              </button>

              {/* Center on Canvas */}
              <button
                type="button"
                onClick={() => {
                  const centerX = Math.max(
                    0,
                    Math.round((state.document.width - selectedElement.width) / 2)
                  );
                  const centerY = Math.max(
                    0,
                    Math.round((state.document.height - selectedElement.height) / 2)
                  );
                  updateElement(selectedElement.id, { x: centerX, y: centerY });
                }}
                title="Center on Canvas"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "4px 6px",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  color: "#2563eb",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#eff6ff")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Crosshair size={13} />
              </button>

              <div style={{ width: "1px", height: "16px", backgroundColor: "#e2e8f0" }} />

              {/* Delete */}
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
                  color: "#dc2626",
                  fontSize: "11px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "background-color 0.1s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#fee2e2")
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
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              backdropFilter: "blur(8px)",
              padding: "5px 10px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "11px",
              color: "#64748b",
              pointerEvents: "none",
              userSelect: "none",
              boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
            }}
          >
            <Hand size={13} style={{ color: "#2563eb" }} />
            <span>Scroll / Pinch to zoom • Hold Space to pan</span>
          </div>
        </div>
      </div>

      {/* Canva Bottom Bar: Multi-Page Filmstrip, Tabs, Notes, Timer, Zoom Slider */}
      <EditorBottomBar
        document={state.document}
        pages={pages}
        activePageIndex={activePageIndex}
        zoom={state.zoom}
        onSelectPage={setActivePage}
        onAddPage={() => addPage()}
        onDuplicatePage={duplicatePage}
        onDeletePage={deletePage}
        onReorderPages={reorderPages}
        onSetZoom={setZoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitToScreen={fitToScreen}
        onResetZoom={resetZoom}
        onOpenGridView={() => setIsGridViewOpen(true)}
        isReadOnly={effectiveReadOnly}
      />

      {/* Canva Full-Screen Grid View Modal */}
      <EditorGridViewModal
        isOpen={isGridViewOpen}
        onClose={() => setIsGridViewOpen(false)}
        document={state.document}
        activePageIndex={activePageIndex}
        onSelectPage={setActivePage}
        onAddPage={() => addPage()}
        onDuplicatePage={duplicatePage}
        onDeletePage={deletePage}
        onReorderPages={reorderPages}
        isReadOnly={effectiveReadOnly}
      />

      <ShareDialog
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        designId={state.document.id}
        designName={state.document.name}
      />
    </div>
  );
};

"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SharedDesignDetails, DesignDocument, DesignElement } from "@design-platform/types";
import { SupabaseShareRepository } from "@design-platform/database";
import { getBrowserSupabaseClient, useAuth } from "@design-platform/auth";
import { useEditor, CanvasEngine, DocumentChangeAction } from "@design-platform/editor";

import { SharedDesignRepository } from "../../../lib/repository";
import { useDesignCollaboration } from "../../../features/collaboration/useDesignCollaboration";
import { EditorTopBar } from "../../../features/editor/EditorTopBar";
import { EditorLeftPanel, LeftPanelTab } from "../../../features/editor/EditorLeftPanel";
import { EditorBottomBar } from "../../../features/editor/EditorBottomBar";
import { EditorGridViewModal } from "../../../features/editor/EditorGridViewModal";
import { Button, Badge } from "@design-platform/ui";
import {
  Loader2,
  AlertCircle,
  Eye,
  Edit3,
  LogIn,
  UserPlus,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  Copy,
  Trash2,
  Shield,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Crosshair,
  SlidersHorizontal,
  LibraryBig,
  Type,
  Shapes,
  Upload,
} from "lucide-react";

export interface ShareClientProps {
  token: string;
}

export function ShareClient({ token }: { token: string }) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [details, setDetails] = useState<SharedDesignDetails | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [revocationMessage, setRevocationMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!token) return;

      try {
        const client = getBrowserSupabaseClient();
        const repo = new SupabaseShareRepository({ client });
        const result = await repo.getSharedDesign(token);

        if (!isMounted) return;
        if (!result) {
          setError("This share link is invalid, has expired, or has been disabled by the design owner.");
        } else {
          setDetails(result);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("[ShareClient] Error resolving share token:", err);
        setError((err as Error)?.message || "Failed to load shared design.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (isLoading || isAuthLoading) {
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
        <span style={{ fontSize: "0.875rem" }}>Opening shared design...</span>
      </div>
    );
  }

  if (error || !details) {
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
          Link Expired or Access Revoked
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#a1a1aa",
            maxWidth: "420px",
            marginBottom: "1.5rem",
            lineHeight: 1.5,
          }}
        >
          {error || "This design is no longer accessible via this link. Contact the design owner for an updated link."}
        </p>
        <Link href="/files" style={{ textDecoration: "none" }}>
          <Button variant="primary" size="md" icon={<ArrowLeft size={16} />}>
            Return to BioCanvas
          </Button>
        </Link>
      </div>
    );
  }

  // FLOW 1: Viewer Link OR Editor Link for Unauthenticated User
  // (In both cases, we show clean Viewer Studio. If editor link + logged out, we show an invite prompt banner)
  const isEditorLink = details.permission === "edit";
  const isAuthenticated = Boolean(user);

  if (!isEditorLink || !isAuthenticated) {
    return (
      <SharedViewerStudio
        details={details}
        token={token}
        isEditorLink={isEditorLink}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  // FLOW 2: Editor Link for Authenticated User (Full Collaborative Editor Mode)
  return (
    <SharedEditorStudio
      details={details}
      token={token}
      onPermissionRevoked={(msg) => setRevocationMessage(msg)}
      revocationMessage={revocationMessage}
    />
  );
}

// ==============================================================================
// Component 1: Shared Viewer Studio (Clean View Experience)
// ==============================================================================

interface SharedViewerStudioProps {
  details: SharedDesignDetails;
  token: string;
  isEditorLink: boolean;
  isAuthenticated: boolean;
}

function SharedViewerStudio({
  details,
  token,
  isEditorLink,
  isAuthenticated,
}: SharedViewerStudioProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isGridViewOpen, setIsGridViewOpen] = useState<boolean>(false);

  const [doc, setDoc] = useState<DesignDocument>(details.design);
  const pages = doc.pages || [{ id: "page-1", name: "Page 1", elements: [] }];

  const handleSelectPage = (index: number) => {
    setActivePageIndex(index);
    if (engineRef.current) {
      engineRef.current.setActivePageIndex(index);
      engineRef.current.renderDocument(doc, index);
    }
  };

  // Real-time live synchronization for read-only viewers
  useEffect(() => {
    let supabase;
    try {
      supabase = getBrowserSupabaseClient();
    } catch {
      return;
    }

    const channel = supabase.channel(`design-room:${details.design.id}`);
    channel.on(
      "broadcast",
      { event: "design_change" },
      ({ payload }: { payload: { action: DocumentChangeAction; senderId: string } }) => {
        if (!payload || !payload.action) return;
        const { action } = payload;
        setDoc((prevDoc) => {
          const nextDoc = { ...prevDoc };
          const currentPages = prevDoc.pages ? [...prevDoc.pages] : [];

          if (action.type === "page_add") {
            if (!currentPages.some((p) => p.id === action.page.id)) {
              nextDoc.pages = [...currentPages, action.page];
            }
          } else if (action.type === "page_delete") {
            nextDoc.pages = currentPages.filter((_, i) => i !== action.pageIndex);
          } else if (action.type === "pages_sync") {
            nextDoc.pages = action.pages;
          } else if (action.type === "background_color") {
            nextDoc.backgroundColor = action.color;
          } else if (action.type === "element_add") {
            const targetIdx =
              action.pageId !== undefined
                ? currentPages.findIndex((p) => p.id === action.pageId)
                : action.pageIndex !== undefined &&
                  action.pageIndex >= 0 &&
                  action.pageIndex < currentPages.length
                ? action.pageIndex
                : 0;
            const targetPage = currentPages[targetIdx];
            if (targetPage && !targetPage.elements.some((el) => el.id === action.element.id)) {
              currentPages[targetIdx] = {
                ...targetPage,
                elements: [...targetPage.elements, action.element],
              };
              nextDoc.pages = currentPages;
            }
          } else if (action.type === "element_update") {
            let targetIdx =
              action.pageId !== undefined ? currentPages.findIndex((p) => p.id === action.pageId) : -1;
            if (
              targetIdx === -1 &&
              action.pageIndex !== undefined &&
              action.pageIndex >= 0 &&
              action.pageIndex < currentPages.length
            ) {
              targetIdx = action.pageIndex;
            }
            if (targetIdx === -1) {
              targetIdx = currentPages.findIndex((p) =>
                p.elements.some((el) => el.id === action.elementId)
              );
            }
            if (targetIdx !== -1 && currentPages[targetIdx]) {
              const targetPage = currentPages[targetIdx]!;
              currentPages[targetIdx] = {
                ...targetPage,
                elements: targetPage.elements.map((el) =>
                  el.id === action.elementId ? { ...el, ...action.updates } : el
                ),
              };
              nextDoc.pages = currentPages;
            }
          } else if (action.type === "element_delete") {
            let targetIdx =
              action.pageId !== undefined ? currentPages.findIndex((p) => p.id === action.pageId) : -1;
            if (
              targetIdx === -1 &&
              action.pageIndex !== undefined &&
              action.pageIndex >= 0 &&
              action.pageIndex < currentPages.length
            ) {
              targetIdx = action.pageIndex;
            }
            if (targetIdx === -1) {
              targetIdx = currentPages.findIndex((p) =>
                p.elements.some((el) => el.id === action.elementId)
              );
            }
            if (targetIdx !== -1 && currentPages[targetIdx]) {
              const targetPage = currentPages[targetIdx]!;
              currentPages[targetIdx] = {
                ...targetPage,
                elements: targetPage.elements.filter((el) => el.id !== action.elementId),
              };
              nextDoc.pages = currentPages;
            }
          }

          if (engineRef.current) {
            engineRef.current.renderDocument(nextDoc, activePageIndex);
          }
          return nextDoc;
        });
      }
    );

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [details.design.id, activePageIndex]);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new CanvasEngine(containerRef.current, {
      onSelect: () => {},
      onElementChange: () => {},
      onDropAsset: () => {},
      onZoomChange: (newZoom) => setZoom(newZoom),
      isReadOnly: true,
    });

    engineRef.current = engine;
    engine.setActivePageIndex(activePageIndex);
    engine.renderDocument(doc, activePageIndex);

    const resizeObserver = new ResizeObserver(() => {
      engine.handleResize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, [doc]);

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
      {/* Editor Invitation Banner for Unauthenticated Visitors */}
      {isEditorLink && !isAuthenticated && (
        <div
          style={{
            backgroundColor: "rgba(59, 130, 246, 0.15)",
            borderBottom: "1px solid rgba(59, 130, 246, 0.3)",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            zIndex: 60,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} style={{ color: "#3b82f6" }} />
            <span style={{ fontSize: "13px", color: "#e4e4e7" }}>
              You have been granted <strong>Editor access</strong> to this design. Sign in to start collaborating live.
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link href={`/login?redirectTo=/share/${token}`} style={{ textDecoration: "none" }}>
              <Button variant="primary" size="xs" icon={<LogIn size={13} />}>
                Sign In to Edit
              </Button>
            </Link>
            <Link href={`/signup?redirectTo=/share/${token}`} style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="xs" icon={<UserPlus size={13} />}>
                Create Account
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Viewer Navigation Bar */}
      <header
        style={{
          height: "56px",
          backgroundColor: "#0d0d10",
          borderBottom: "1px solid #27272a",
          padding: "0 1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "7px",
                background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "14px",
              }}
            >
              B
            </div>
            <h1
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "#f4f4f5",
                margin: 0,
                maxWidth: "280px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {doc.name}
            </h1>
          </div>

          <Badge variant="outline" size="sm">
            VIEWER
          </Badge>
        </div>

        {/* Center: Zoom Controls */}
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
            onClick={() => engineRef.current?.zoomOut()}
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </Button>

          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#e4e4e7",
              padding: "0 8px",
              minWidth: "48px",
              textAlign: "center",
            }}
          >
            {Math.round(zoom * 100)}%
          </span>

          <Button
            variant="icon"
            size="xs"
            onClick={() => engineRef.current?.zoomIn()}
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </Button>

          <Button
            variant="icon"
            size="xs"
            onClick={() => engineRef.current?.fitToScreen()}
            title="Fit to Screen"
          >
            <Maximize2 size={14} />
          </Button>
        </div>

        {/* Right side info */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "12px", color: "#71717a" }}>
            Anyone with the link • Read-only
          </span>
        </div>
      </header>

      {/* Main Viewer Canvas */}
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
        <div ref={containerRef} style={{ width: "100%", height: "100%", outline: "none", cursor: "grab" }} />

        {/* Navigation Hint */}
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
          }}
        >
          <Hand size={13} style={{ color: "#3b82f6" }} />
          <span>Scroll / Pinch to zoom • Drag anywhere to pan</span>
        </div>
      </div>

      {/* Canva Bottom Bar for Viewer */}
      <EditorBottomBar
        document={doc}
        pages={pages}
        activePageIndex={activePageIndex}
        zoom={zoom}
        onSelectPage={handleSelectPage}
        onAddPage={() => {}}
        onDuplicatePage={() => {}}
        onDeletePage={() => {}}
        onSetZoom={(newZoom) => {
          setZoom(newZoom);
          engineRef.current?.setZoom(newZoom);
        }}
        onZoomIn={() => engineRef.current?.zoomIn()}
        onZoomOut={() => engineRef.current?.zoomOut()}
        onFitToScreen={() => engineRef.current?.fitToScreen()}
        onResetZoom={() => engineRef.current?.resetZoom()}
        onOpenGridView={() => setIsGridViewOpen(true)}
        isReadOnly={true}
      />

      {/* Canva Grid View Modal for Viewer */}
      <EditorGridViewModal
        isOpen={isGridViewOpen}
        onClose={() => setIsGridViewOpen(false)}
        document={doc}
        activePageIndex={activePageIndex}
        onSelectPage={handleSelectPage}
        onAddPage={() => {}}
        onDuplicatePage={() => {}}
        onDeletePage={() => {}}
        isReadOnly={true}
      />
    </div>
  );
}

// ==============================================================================
// Component 2: Shared Editor Studio (Authenticated Collaborator Mode)
// ==============================================================================

interface SharedEditorStudioProps {
  details: SharedDesignDetails;
  token: string;
  onPermissionRevoked: (reason: string) => void;
  revocationMessage: string | null;
}

function SharedEditorStudio({
  details,
  token,
  onPermissionRevoked,
  revocationMessage,
}: SharedEditorStudioProps) {
  const { user } = useAuth();

  const repository = useMemo(
    () =>
      new SharedDesignRepository({
        token,
        onPermissionRevoked,
      }),
    [token, onPermissionRevoked]
  );

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
  } = useEditor({ initialDocument: details.design, repository });

  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>("assets");
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

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

  const [isGridViewOpen, setIsGridViewOpen] = useState(false);

  // Hook up real-time collaboration via Supabase Realtime
  const {
    collaborators,
    connectionStatus,
    hasEditPermission,
    permissionWarning,
  } = useDesignCollaboration({
    designId: details.design.id,
    store,
    currentUser: user,
    isReadOnly: Boolean(revocationMessage),
    shareToken: token,
    onPermissionRevoked,
  });

  const isReadOnly = Boolean(revocationMessage) || !hasEditPermission;

  // Active page elements for empty-canvas detection
  const currentPage = pages[activePageIndex] || pages[0];
  const currentElements = currentPage?.elements || [];

  // Autosave periodically if dirty
  useEffect(() => {
    if (isReadOnly) return;
    const timer = setInterval(() => {
      if (state.saveStatus === "unsaved") {
        save();
      }
    }, 12000);

    return () => clearInterval(timer);
  }, [state.saveStatus, save, isReadOnly]);

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
      {/* Revocation or View-Only Warning */}
      {(revocationMessage || permissionWarning) && (
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
          <AlertCircle size={14} style={{ color: "#ef4444" }} />
          <span>
            {revocationMessage || permissionWarning || "Editing permission is no longer active."}
          </span>
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
        isReadOnly={isReadOnly}
        collaborators={collaborators}
        connectionStatus={connectionStatus}
        canManageShare={false} // Shared collaborators cannot alter link share settings
      />

      {/* Main Studio Body: Contextual Left Panel + Maximized Center Canvas */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Contextual Left Toolbar & Inspector (Disabled if revoked) */}
        {!isReadOnly ? (
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
        ) : null}

        {/* Center Canvas Viewport */}
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
          <div ref={containerRef} style={{ width: "100%", height: "100%", outline: "none" }} />

          {/* Empty Artboard Subtle Guidance Card (vanishing once content is added) */}
          {(!currentElements || currentElements.length === 0) && !isReadOnly && (
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

          {/* Floating Element Quick-Action Bar for Selected Element */}
          {selectedElement && !isReadOnly && (
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

              <button
                type="button"
                onClick={() => duplicateElement(selectedElement.id)}
                title="Duplicate Element"
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
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <Copy size={13} style={{ color: "#2563eb" }} />
                <span>Copy</span>
              </button>

              <button
                type="button"
                onClick={() => bringForward(selectedElement.id)}
                title="Bring Forward"
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

              <button
                type="button"
                onClick={() => sendBackward(selectedElement.id)}
                title="Send Backward"
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

              <button
                type="button"
                onClick={() => deleteElement(selectedElement.id)}
                title="Delete Element"
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

          {/* Floating Navigation Hint */}
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

      {/* Canva Bottom Bar */}
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
        isReadOnly={isReadOnly}
      />

      {/* Canva Grid View Modal */}
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
        isReadOnly={isReadOnly}
      />
    </div>
  );
}

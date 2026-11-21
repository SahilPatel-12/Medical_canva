"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
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
import { EditorCanvasViewport } from "./EditorCanvasViewport";
import { EditorContextToolbar } from "./EditorContextToolbar";
import { MultiSelectionActions, MultiSelectionToolbar } from "./inspector/MultiSelection";
import { EditorContextMenu, buildCanvasMenu } from "./EditorContextMenu";
import { KeyboardShortcutsDialog, useEditorShortcuts } from "./KeyboardShortcuts";
import { PresentationMode } from "./PresentationMode";
import { usePdfExport } from "./usePdfExport";
import { TextStyleContext } from "./text/TextStyle";
import type { ElementTemplate } from "./panels/elementTemplates";
import { Button } from "@design-platform/ui";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
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
          backgroundColor: "var(--background, #f8fafc)",
          color: "var(--foreground-muted, #64748b)",
          gap: "1rem",
        }}
      >
        <Loader2 size={36} className="animate-spin" style={{ color: "var(--primary, #047857)" }} />
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
          backgroundColor: "var(--background, #f8fafc)",
          color: "var(--foreground, #0f172a)",
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
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<LeftPanelTab>("assets");
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  /** Page the presentation opened on; null while not presenting */
  const [presentFrom, setPresentFrom] = useState<number | null>(null);

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
    insertElement,
    moveElementTo,
    editText,
    selectedIds,
    setSelection,
    toggleInSelection,
    alignSelection,
    distributeSelection,
    deleteSelection,
    duplicateSelection,
    updateElements,
    groupSelection,
    updateElement,
    deleteElement,
    duplicateElement,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    updateSelectedSvgColor,
    updateSelectedSvgColorMap,
    updateSelectedSvgComponentColor,
    applyScientificPreset,
    distributeSvgComponents,
    groupEditSession,
    enterGroupEdit,
    exitGroupEdit,
    exitAllGroupEdits,
    ungroupSelectedLayer,
    groupElements,
    ungroupSelected,
    resetSelectedSvgColors,
    setCanvasBackgroundColor,
    setPageBackgroundColor,
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
    setPageName,
    setViewportController,
    setZoom,
    zoomIn,
    zoomOut,
    fitToScreen,
    resetZoom,
    contextMenu,
    closeContextMenu,
    cutSelection,
    copySelection,
    pasteSelection,
    hasClipboard,
    flipSelection,
    flipSelectedLayer,
    canFlip,
    toggleLockSelection,
    duplicateSelectedLayer,
    deleteSelectedLayer,
    alignSelectionToPage,
    selectAll,
    canEnterGroup,
    textEdit,
    applyTextStyle,
    updateTextBox,
    setTextContent,
  } = useEditor({ initialDocument, repository, isReadOnly });

  // The PDF captures the document as it is when the user clicks
  const { exportPdf, pdfProgress } = usePdfExport(useCallback(() => state.document, [state.document]));
  const textStyleApi = useMemo(
    () => ({ textEdit, applyTextStyle, updateTextBox, setTextContent }),
    // The functions are rebuilt every render; only the selection matters for consumers
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textEdit]
  );

  // Several elements selected: shared actions for the toolbar and the inspector
  const selectedSet = new Set(selectedIds);
  const multiElements = (state.document.pages?.[activePageIndex]?.elements || []).filter((el) => selectedSet.has(el.id));
  const multi: MultiSelectionActions | null =
    multiElements.length > 1
      ? {
          elements: multiElements,
          onAlign: alignSelection,
          onDistribute: distributeSelection,
          onGroup: () => groupSelection(),
          onDuplicate: duplicateSelection,
          onDelete: deleteSelection,
          onUpdateMany: updateElements,
          onSelectOne: (id) => setSelection([id]),
          onDeselectOne: (id) => setSelection(selectedIds.filter((x) => x !== id)),
        }
      : null;

  // Right-click menu: its items follow what is selected (element(s), a part, or nothing)
  const pageElements = state.document.pages?.[activePageIndex]?.elements || [];
  const menuTarget = multiElements.length === 1 ? multiElements[0]! : null;
  const menuTargetIndex = menuTarget ? pageElements.findIndex((el) => el.id === menuTarget.id) : -1;
  const canvasMenu = contextMenu
    ? buildCanvasMenu({
        selected: multiElements,
        groupEditSession,
        hasClipboard: hasClipboard(),
        canUndo: state.canUndo,
        canRedo: state.canRedo,
        canFlip: (el, axis) => canFlip(el, axis),
        canEnterGroup,
        isTopmost: menuTargetIndex === pageElements.length - 1,
        isBottommost: menuTargetIndex === 0,
        actions: {
          cut: cutSelection,
          copy: copySelection,
          paste: pasteSelection,
          duplicate: duplicateSelection,
          remove: deleteSelection,
          flip: flipSelection,
          flipPart: flipSelectedLayer,
          duplicatePart: duplicateSelectedLayer,
          removePart: deleteSelectedLayer,
          bringToFront: () => bringToFront(),
          bringForward: () => bringForward(),
          sendBackward: () => sendBackward(),
          sendToBack: () => sendToBack(),
          align: alignSelection,
          alignToPage: alignSelectionToPage,
          distribute: distributeSelection,
          group: () => groupSelection(),
          ungroup: () => ungroupSelected(),
          editParts: (id) => enterGroupEdit(id),
          goInside: (id) => enterGroupEdit(id),
          selectParent: exitGroupEdit,
          doneEditingParts: exitAllGroupEdits,
          ungroupPart: ungroupSelectedLayer,
          editText,
          selectAll,
          toggleLock: toggleLockSelection,
          undo,
          redo,
          addPage: () => addPage(undefined, activePageIndex),
          fitToScreen,
        },
      })
    : null;

  /** Adds an element at the page center; repeated adds step down-right so none hide each other */
  const insertFromTemplate = (template: ElementTemplate, startEditing?: boolean) => {
    const doc = state.document;
    let x = Math.round(doc.width / 2 - template.width / 2);
    let y = Math.round(doc.height / 2 - template.height / 2);
    const taken = new Set(pageElements.map((el) => `${el.x},${el.y}`));
    for (let i = 0; i < 40 && taken.has(`${x},${y}`); i++) {
      x += 24;
      y += 24;
    }
    const created = insertElement({ ...template, x, y });
    if (startEditing && created.type === "text") editText(created.id);
  };

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

  const startPresenting = () => {
    closeContextMenu();
    setIsGridViewOpen(false);
    setIsShortcutsOpen(false);
    setPresentFrom(activePageIndex);
  };

  // One-key inserts (T, R, C, L, A), "?" for the shortcuts sheet, Ctrl/⌘+Alt+P to present
  useEditorShortcuts({
    enabled: !effectiveReadOnly && !isShortcutsOpen && presentFrom === null,
    onInsert: insertFromTemplate,
    onOpenHelp: () => setIsShortcutsOpen(true),
    onPresent: presentFrom === null ? startPresenting : undefined,
  });

  // Automatically reveal properties panel when an element or subcomponent is selected
  useEffect(() => {
    if (selectedElement) {
      setLeftPanelTab("properties");
      setIsLeftPanelCollapsed(false);
    }
  }, [selectedElement?.id]);

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
    <TextStyleContext.Provider value={textStyleApi}>
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
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
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
        onExportPdf={exportPdf}
        pdfProgress={pdfProgress}
        isReadOnly={effectiveReadOnly}
        onShareClick={() => setIsShareOpen(true)}
        collaborators={collaborators}
        connectionStatus={connectionStatus}
        canManageShare={!isReadOnly}
        onPresent={startPresenting}
      />

      {/* Main Studio Body: Contextual Left Panel + Expanded Center Canvas */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
        {/* Contextual Left Toolbar & Inspector */}
        <EditorLeftPanel
          activeTab={leftPanelTab}
          onTabChange={setLeftPanelTab}
          isCollapsed={isLeftPanelCollapsed}
          onToggleCollapse={() => setIsLeftPanelCollapsed((prev) => !prev)}
          onAddAsset={addAssetToCenter}
          onAddShape={addShape}
          onAddText={addText}
          onInsertElement={insertFromTemplate}
          onMoveElement={moveElementTo}
          selectedIds={selectedIds}
          onToggleSelect={toggleInSelection}
          multi={multi}
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
          onUpdateSvgComponentColor={updateSelectedSvgComponentColor}
          onApplyScientificPreset={applyScientificPreset}
          onDistributeSvgComponents={distributeSvgComponents}
          onResetSvgColors={resetSelectedSvgColors}
          groupEditSession={groupEditSession}
          onEnterGroupEdit={enterGroupEdit}
          onExitGroupEdit={exitGroupEdit}
          onExitAllGroupEdits={exitAllGroupEdits}
          onUngroupLayer={ungroupSelectedLayer}
          onSetCanvasBackground={setCanvasBackgroundColor}
          onSetPageBackground={(color) => setPageBackgroundColor(color)}
        />

        {/* Center: Canva-style page stack (pages stay centered; scroll between pages, zoom in/out) */}
        <EditorCanvasViewport
          document={state.document}
          activePageIndex={activePageIndex}
          isReadOnly={effectiveReadOnly}
          containerRef={containerRef}
          setViewportController={setViewportController}
          onSelectPage={setActivePage}
          onAddPage={(afterIndex) => addPage(undefined, afterIndex)}
          onDuplicatePage={duplicatePage}
          onDeletePage={deletePage}
          onMovePage={reorderPages}
          onRenamePage={setPageName}
        >

          {/* Contextual toolbar: the most used actions for the selection */}
          {multi && !effectiveReadOnly && (
            <div className="ctb-wrap">
              <MultiSelectionToolbar
                actions={multi}
                onOpenInspector={() => {
                  setLeftPanelTab("properties");
                  setIsLeftPanelCollapsed(false);
                }}
              />
            </div>
          )}
          {selectedElement && !multi && !effectiveReadOnly && (
            <div className="ctb-wrap">
              <EditorContextToolbar
                element={selectedElement}
                groupEditSession={groupEditSession}
                onUpdateElement={updateElement}
                onUpdateSvgColor={updateSelectedSvgColor}
                onUpdateSvgColorMap={updateSelectedSvgColorMap}
                onDuplicate={duplicateElement}
                onDelete={deleteElement}
                onEnterGroupEdit={enterGroupEdit}
                onExitGroupEdit={exitGroupEdit}
                onExitAllGroupEdits={exitAllGroupEdits}
                onUngroupLayer={ungroupSelectedLayer}
                onSplitIllustration={distributeSvgComponents}
                onOpenInspector={() => {
                  setLeftPanelTab("properties");
                  setIsLeftPanelCollapsed(false);
                }}
              />
            </div>
          )}

          {/* Floating canvas controls: notes · pages · zoom */}
          <EditorBottomBar
            document={state.document}
            pages={pages}
            activePageIndex={activePageIndex}
            zoom={state.zoom}
            onSelectPage={setActivePage}
            onAddPage={() => addPage()}
            onSetZoom={setZoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onFitToScreen={fitToScreen}
            onResetZoom={resetZoom}
            onOpenGridView={() => setIsGridViewOpen(true)}
            isReadOnly={effectiveReadOnly}
          />
        </EditorCanvasViewport>
      </div>

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

      <KeyboardShortcutsDialog open={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {presentFrom !== null && (
        <PresentationMode
          document={state.document}
          startIndex={presentFrom}
          onExit={(pageIndex) => {
            setPresentFrom(null);
            if (pageIndex !== activePageIndex) setActivePage(pageIndex);
          }}
        />
      )}

      {contextMenu && canvasMenu && !effectiveReadOnly && (
        <EditorContextMenu
          key={`${contextMenu.x},${contextMenu.y}`}
          x={contextMenu.x}
          y={contextMenu.y}
          title={canvasMenu.title}
          entries={canvasMenu.entries}
          onClose={closeContextMenu}
        />
      )}

      <ShareDialog
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        designId={state.document.id}
        designName={state.document.name}
      />
    </div>
    </TextStyleContext.Provider>
  );
};

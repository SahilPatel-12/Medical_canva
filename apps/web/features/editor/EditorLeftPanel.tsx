"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  SAMPLE_ASSETS,
  CANONICAL_TAXONOMY,
  getCategoryBySlug,
  getSubcategory,
} from "@design-platform/editor";
import { Asset, AssetCategory, AssetCategoryItem, DesignDocument, DesignElement } from "@design-platform/types";
import { EditorPropertiesPanel, EditorPropertiesPanelProps } from "./EditorPropertiesPanel";
import { ElementsPanel, LayersPanel, TextPanel, UploadsPanel } from "./panels/LeftPanels";
import type { ElementTemplate } from "./panels/elementTemplates";
import {
  AdjustIcon,
  AssetsIcon,
  ElementsIcon,
  LayersIcon,
  PaletteIcon,
  TextIcon,
  UploadsIcon,
} from "./icons/EditorIcons";
import { ScientificAssetsPanel, AssetNavLevel } from "./ScientificAssetsPanel";
import {
  Shapes,
  ChevronRight,
  Heart,
  Layers,
  Activity,
  Dna,
  FlaskConical,
  Folder,
  Sparkles,
} from "lucide-react";

export type LeftPanelTab = "assets" | "elements" | "text" | "uploads" | "layers" | "properties";

export interface EditorLeftPanelProps {
  activeTab?: LeftPanelTab;
  onTabChange?: (tab: LeftPanelTab) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onAddAsset: (asset: Asset) => void;
  onAddShape: (shapeType: "rectangle" | "circle" | "line") => void;
  onAddText: (variant: "heading" | "subheading" | "body" | "label") => void;
  /** Adds an element from the Elements / Text panels (and optionally starts typing into text) */
  onInsertElement?: (template: ElementTemplate, startEditing?: boolean) => void;
  /** Moves an element to a stacking index (0 = bottom), from the Layers panel */
  onMoveElement?: (id: string, index: number) => void;
  /** Multi-selection (ids + actions) */
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  multi?: EditorPropertiesPanelProps["multi"];
  document?: DesignDocument;
  selectedElement?: DesignElement | null;
  activePageIndex?: number;
  onSelectElement?: (id: string | null) => void;
  onUpdateElement?: (id: string, updates: Partial<DesignElement>) => void;
  onDeleteElement?: (id?: string) => void;
  onDuplicateElement?: (id?: string) => void;
  onBringForward?: (id?: string) => void;
  onSendBackward?: (id?: string) => void;
  onBringToFront?: (id?: string) => void;
  onSendToBack?: (id?: string) => void;
  onUpdateSvgColor?: (fill?: string, stroke?: string, strokeWidth?: number) => void;
  onUpdateSvgColorMap?: (colorMap: Record<string, string>) => void;
  onUpdateSvgComponentColor?: (
    componentIdOrIndex: string | number,
    colors: { fill?: string; stroke?: string }
  ) => void;
  onApplyScientificPreset?: (
    presetIdOrPreset: string,
    componentIdOrIndex?: string | number
  ) => void;
  onDistributeSvgComponents?: () => void;
  onResetSvgColors?: () => void;
  groupEditSession?: EditorPropertiesPanelProps["groupEditSession"];
  onEnterGroupEdit?: (id?: string) => void;
  onExitGroupEdit?: () => void;
  onExitAllGroupEdits?: () => void;
  onUngroupLayer?: () => void;
  onSetCanvasBackground?: (color: string) => void;
  onSetPageBackground?: (color: string) => void;
}

/**
 * Format asset filenames into human-readable titles.
 */
export function formatAssetName(name: string): string {
  if (!name) return "";
  let clean = name
    .replace(/\.svg$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\bsvgrepo\b/gi, "")
    .replace(/\bcom\b/gi, "")
    .replace(/\bicon\b/gi, "")
    .trim();

  clean = clean
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return clean || name;
}

// Category icon mapper helper
function getCategoryIcon(slug: string) {
  switch (slug) {
    case "cell-types":
    case "cell-structures":
      return <Activity size={15} style={{ color: "#2563eb" }} />;
    case "proteins":
    case "nucleic-acids":
      return <Dna size={15} style={{ color: "#059669" }} />;
    case "lab-and-objects":
    case "chemistry":
      return <FlaskConical size={15} style={{ color: "#7c3aed" }} />;
    case "human-anatomy":
      return <Heart size={15} style={{ color: "#e11d48" }} />;
    case "membranes":
    case "epithelium":
      return <Layers size={15} style={{ color: "#d97706" }} />;
    case "arrows-and-shapes":
    case "graphs-and-symbols":
      return <Shapes size={15} style={{ color: "#0284c7" }} />;
    case "biomojii":
      return <Sparkles size={15} style={{ color: "#db2777" }} />;
    default:
      return <Folder size={15} style={{ color: "#64748b" }} />;
  }
}

export const EditorLeftPanel: React.FC<EditorLeftPanelProps> = ({
  activeTab: controlledActiveTab,
  onTabChange,
  onAddAsset,
  document,
  selectedElement,
  activePageIndex = 0,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onUpdateSvgColor,
  onUpdateSvgColorMap,
  onUpdateSvgComponentColor,
  onApplyScientificPreset,
  onDistributeSvgComponents,
  onResetSvgColors,
  groupEditSession,
  onEnterGroupEdit,
  onExitGroupEdit,
  onInsertElement,
  onMoveElement,
  selectedIds,
  onToggleSelect,
  multi,
  onExitAllGroupEdits,
  onUngroupLayer,
  onSetCanvasBackground,
  onSetPageBackground,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}) => {
  const isDraggingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [internalTab, setInternalTab] = useState<LeftPanelTab>("assets");
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalTab;

  const setActiveTab = (tab: LeftPanelTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [assetNavState, setAssetNavState] = useState<{
    level: AssetNavLevel;
    categorySlug: string | null;
    subcategorySlug: string | null;
  }>({
    level: "root",
    categorySlug: null,
    subcategorySlug: null,
  });
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("all");
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    "cell-types": true,
  });

  const [remoteAssets, setRemoteAssets] = useState<Asset[]>([]);
  const [uploadedAssets, setUploadedAssets] = useState<Asset[]>([]);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isCollapsed =
    typeof controlledCollapsed === "boolean" ? controlledCollapsed : internalCollapsed;

  const toggleCollapsed = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  // Keyboard shortcut '/' to quickly focus the asset search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        if (isCollapsed) toggleCollapsed();
        setActiveTab("assets");
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed]);

  // Fetch dynamic assets from Supabase / R2
  useEffect(() => {
    let mounted = true;
    async function loadAssets() {
      try {
        const res = await fetch("/api/assets");
        const json = await res.json();
        if (mounted && json.success && Array.isArray(json.data)) {
          setRemoteAssets(json.data);
        }
      } catch (err) {
        console.warn("Could not load dynamic assets:", err);
      }
    }
    loadAssets();
    return () => {
      mounted = false;
    };
  }, []);

  const creationTabs = [
    { id: "assets" as LeftPanelTab, label: "Assets", icon: <AssetsIcon size={24} /> },
    { id: "elements" as LeftPanelTab, label: "Elements", icon: <ElementsIcon size={24} /> },
    { id: "text" as LeftPanelTab, label: "Text", icon: <TextIcon size={24} /> },
    { id: "uploads" as LeftPanelTab, label: "Uploads", icon: <UploadsIcon size={24} /> },
  ];

  const organizationTabs = [
    { id: "layers" as LeftPanelTab, label: "Layers", icon: <LayersIcon size={24} /> },
  ];

  const contextualTabs = [
    {
      id: "properties" as LeftPanelTab,
      label: selectedElement ? "Properties" : "Canvas",
      icon: selectedElement ? <AdjustIcon size={24} /> : <PaletteIcon size={24} />,
    },
  ];

  // Combined library assets
  const combinedAssets = useMemo(() => {
    const remoteIds = new Set(remoteAssets.map((a) => a.id));
    const merged = [...remoteAssets];
    for (const sample of SAMPLE_ASSETS) {
      if (!remoteIds.has(sample.id)) {
        merged.push(sample);
      }
    }
    return merged;
  }, [remoteAssets]);

  // Shapes & symbols from the library, offered in the Elements panel
  const libraryShapeAssets = useMemo(
    () =>
      combinedAssets.filter((a) =>
        ["arrows-and-shapes", "graphs-and-symbols"].includes(a.categorySlug || a.category)
      ),
    [combinedAssets]
  );

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return combinedAssets.filter((asset) => {
      // Subcategory filter
      if (selectedSubcategorySlug !== "all") {
        if (asset.subcategorySlug !== selectedSubcategorySlug) return false;
      }
      // Category filter
      else if (selectedCategorySlug !== "all") {
        const cat = asset.categorySlug || asset.category;
        if (cat !== selectedCategorySlug) return false;
      }

      // Search filter
      if (assetSearch.trim()) {
        const q = assetSearch.toLowerCase();
        const cleanName = formatAssetName(asset.name).toLowerCase();
        const matchesName = cleanName.includes(q) || asset.name.toLowerCase().includes(q);
        const matchesTag = asset.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesCategory =
          asset.category.toLowerCase().includes(q) ||
          (asset.categorySlug && asset.categorySlug.toLowerCase().includes(q));
        const matchesSubcategory =
          asset.subcategorySlug && asset.subcategorySlug.toLowerCase().includes(q);
        return matchesName || matchesTag || matchesCategory || matchesSubcategory;
      }

      return true;
    });
  }, [combinedAssets, assetSearch, selectedCategorySlug, selectedSubcategorySlug]);

  const handleAssetInsert = (asset: Asset) => {
    onAddAsset(asset);
    setJustAddedId(asset.id);
    setTimeout(() => setJustAddedId(null), 600);
  };

  const handleTabClick = (tabId: LeftPanelTab) => {
    if (activeTab === tabId && !isCollapsed) {
      toggleCollapsed();
    } else {
      setActiveTab(tabId);
      if (isCollapsed) toggleCollapsed();
    }
  };

  // Progressive disclosure: only expand one category at a time
  const toggleCategoryExpand = (slug: string) => {
    setExpandedCategories((prev) => {
      const isCurrentlyOpen = !!prev[slug];
      if (isCurrentlyOpen) return {};
      return { [slug]: true };
    });
  };

  // Upload handler: several files at once; each keeps its real proportions on the page
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const valid = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];
    const accepted = Array.from(files).filter((f) => valid.includes(f.type) || f.name.toLowerCase().endsWith(".svg"));
    const rejected = files.length - accepted.length;
    const tooBig = accepted.filter((f) => f.size > 15 * 1024 * 1024);
    const usable = accepted.filter((f) => f.size <= 15 * 1024 * 1024);
    if (rejected > 0 || tooBig.length > 0) {
      setUploadError(
        [
          rejected > 0 ? `${rejected} file${rejected > 1 ? "s" : ""} skipped: use SVG, PNG, JPG or WebP.` : "",
          tooBig.length > 0 ? `${tooBig.map((f) => f.name).join(", ")} ${tooBig.length > 1 ? "are" : "is"} over 15 MB.` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
    }
    if (usable.length === 0) return;
    setIsUploading(true);

    const fit = (w: number, h: number) => {
      const k = Math.min(1, 420 / Math.max(w || 1, h || 1));
      return { defaultWidth: Math.max(24, Math.round((w || 200) * k)), defaultHeight: Math.max(24, Math.round((h || 200) * k)) };
    };
    const readOne = (file: File) =>
      new Promise<Asset | null>((resolve) => {
        const reader = new FileReader();
        const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
        const name = file.name.replace(/\.[^/.]+$/, "");
        const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        reader.onerror = () => resolve(null);
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (isSvg) {
            const vb = result.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
            const size = vb ? fit(parseFloat(vb[1]!), parseFloat(vb[2]!)) : fit(240, 240);
            resolve({ id, name, type: "svg", category: "uploads", source: result, createdAt: new Date().toISOString(), ...size });
            return;
          }
          const img = new window.Image();
          img.onload = () =>
            resolve({ id, name, type: "image", category: "uploads", source: result, url: result, createdAt: new Date().toISOString(), ...fit(img.naturalWidth, img.naturalHeight) });
          img.onerror = () => resolve(null);
          img.src = result;
        };
        if (isSvg) reader.readAsText(file);
        else reader.readAsDataURL(file);
      });

    Promise.all(usable.map(readOne)).then((assets) => {
      const ok = assets.filter((a): a is Asset => Boolean(a));
      setUploadedAssets((prev) => [...ok, ...prev]);
      if (ok.length < usable.length) setUploadError("Some files could not be read.");
      setIsUploading(false);
    });
  };

  const activePage = document?.pages?.[activePageIndex || 0] || document?.pages?.[0];
  const pageElements = activePage?.elements || [];

  const renderRailButton = (tab: { id: LeftPanelTab; label: string; icon: React.ReactNode }) => {
    const isActive = activeTab === tab.id && !isCollapsed;
    return (
      <button
        key={tab.id}
        type="button"
        className={isActive ? "is-active" : undefined}
        aria-current={isActive ? "page" : undefined}
        onClick={() => handleTabClick(tab.id)}
        title={`${tab.label} (Click to ${isActive ? "collapse" : "open"})`}
        style={{
          width: "52px",
          height: "52px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "3px",
          borderRadius: "10px",
          border: "none",
          backgroundColor: isActive ? "var(--primary-subtle, #ecfdf5)" : "transparent",
          color: isActive ? "var(--primary, #047857)" : "var(--foreground-muted, #64748b)",
          cursor: "pointer",
          transition: "all 0.15s ease",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = "var(--surface-hover, #f8fafc)";
            e.currentTarget.style.color = "var(--foreground, #0f172a)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--foreground-muted, #64748b)";
          }
        }}
      >
        <span>{tab.icon}</span>
        <span style={{ fontSize: "10px", fontWeight: isActive ? 600 : 500 }}>
          {tab.label}
        </span>
        {isActive && (
          <span
            style={{
              position: "absolute",
              left: 0,
              top: "14px",
              bottom: "14px",
              width: "3px",
              backgroundColor: "var(--primary, #047857)",
              borderRadius: "0 4px 4px 0",
            }}
          />
        )}
      </button>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        backgroundColor: "var(--surface, #ffffff)",
        zIndex: 40,
        position: "relative",
      }}
    >
      {/* Icon Navigation Rail */}
      <nav
        style={{
          width: "64px",
          height: "100%",
          minHeight: 0,
          borderRight: "1px solid var(--border, #e2e8f0)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "0.75rem 0",
          gap: "0.375rem",
          backgroundColor: "var(--surface, #ffffff)",
          flexShrink: 0,
          overflowY: "auto",
        }}
      >
        {/* Creation Tools */}
        {creationTabs.map(renderRailButton)}

        {/* Divider */}
        <div style={{ width: "32px", height: "1px", backgroundColor: "var(--border, #e2e8f0)", margin: "4px 0" }} />

        {/* Organization Tools */}
        {organizationTabs.map(renderRailButton)}

        {/* Contextual Properties Tool */}
        {contextualTabs.map(renderRailButton)}
      </nav>

      {/* Expand Chevron Tab (When Collapsed) */}
      {isCollapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Open Library Drawer"
          style={{
            position: "absolute",
            left: "64px",
            top: "16px",
            zIndex: 45,
            width: "24px",
            height: "40px",
            backgroundColor: "var(--surface, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderLeft: "none",
            borderRadius: "0 8px 8px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--foreground-muted, #64748b)",
            cursor: "pointer",
            boxShadow: "2px 0 8px rgba(0,0,0,0.06)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--surface-hover, #f8fafc)";
            e.currentTarget.style.color = "var(--foreground, #0f172a)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--surface, #ffffff)";
            e.currentTarget.style.color = "var(--foreground-muted, #64748b)";
          }}
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Drawer Body */}
      {!isCollapsed && (
        <div
          style={{
            width: "340px",
            height: "100%",
            minHeight: 0,
            borderRight: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--surface, #ffffff)",
            overflowY: "auto",
            transition: "width 0.2s ease",
            position: "relative",
          }}
        >
          {/* ==================================================== */}
          {/* 1. ASSETS TAB (Category-First Scientific Library)   */}
          {/* ==================================================== */}
          <div
            style={{
              display: activeTab === "assets" ? "flex" : "none",
              flexDirection: "column",
              minHeight: "100%",
            }}
          >
            <ScientificAssetsPanel
              onAddAsset={onAddAsset}
              onToggleCollapse={toggleCollapsed}
              initialNavLevel={assetNavState.level}
              initialCategorySlug={assetNavState.categorySlug}
              initialSubcategorySlug={assetNavState.subcategorySlug}
              onNavStateChange={setAssetNavState}
            />
          </div>

          {/* ==================================================== */}
          {/* 2. ELEMENTS TAB (Shapes, Badges & Connectors)        */}
          {/* ==================================================== */}
          {activeTab === "elements" && (
            <ElementsPanel
              onInsert={(template) => onInsertElement?.(template)}
              libraryItems={libraryShapeAssets}
              onAddAsset={handleAssetInsert}
              onCollapse={toggleCollapsed}
            />
          )}

          {activeTab === "text" && (
            <TextPanel onInsert={(template, edit) => onInsertElement?.(template, edit)} onCollapse={toggleCollapsed} />
          )}

          {activeTab === "uploads" && (
            <UploadsPanel
              uploads={uploadedAssets}
              isUploading={isUploading}
              error={uploadError}
              onFiles={handleFileUpload}
              onAddAsset={handleAssetInsert}
              onRemove={(id) => setUploadedAssets((prev) => prev.filter((a) => a.id !== id))}
              onCollapse={toggleCollapsed}
            />
          )}

          {activeTab === "layers" && (
            <LayersPanel
              elements={pageElements}
              selectedId={selectedElement?.id || null}
              selectedIds={selectedIds}
              onSelect={(id, additive) => (additive && onToggleSelect ? onToggleSelect(id) : onSelectElement?.(id))}
              onUpdate={(id, updates) => onUpdateElement?.(id, updates)}
              onDuplicate={(id) => onDuplicateElement?.(id)}
              onDelete={(id) => onDeleteElement?.(id)}
              onMove={(id, index) => onMoveElement?.(id, index)}
              onCollapse={toggleCollapsed}
            />
          )}

          {activeTab === "properties" && document && onUpdateElement && (
            <EditorPropertiesPanel
              document={document}
              selectedElement={selectedElement || null}
              activePageIndex={activePageIndex}
              onUpdateElement={onUpdateElement}
              onDeleteElement={onDeleteElement || (() => {})}
              onDuplicateElement={onDuplicateElement || (() => {})}
              onBringForward={onBringForward || (() => {})}
              onSendBackward={onSendBackward || (() => {})}
              onBringToFront={onBringToFront || (() => {})}
              onSendToBack={onSendToBack || (() => {})}
              onUpdateSvgColor={onUpdateSvgColor || (() => {})}
              onUpdateSvgColorMap={onUpdateSvgColorMap}
              onUpdateSvgComponentColor={onUpdateSvgComponentColor}
              onApplyScientificPreset={onApplyScientificPreset}
              onDistributeSvgComponents={onDistributeSvgComponents}
              onResetSvgColors={onResetSvgColors}
              groupEditSession={groupEditSession}
              onEnterGroupEdit={onEnterGroupEdit}
              onExitGroupEdit={onExitGroupEdit}
              onExitAllGroupEdits={onExitAllGroupEdits}
              onUngroupLayer={onUngroupLayer}
              multi={multi}
              onSetCanvasBackground={onSetCanvasBackground || (() => {})}
              onSetPageBackground={onSetPageBackground}
              embedded
              onBackToLibrary={() => handleTabClick("assets")}
            />
          )}

          {activeTab === "properties" && (!document || !onUpdateElement) && (
            <div
              style={{
                padding: "2rem 1rem",
                color: "var(--foreground-muted, #64748b)",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              Properties inspector is available when editing designs.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

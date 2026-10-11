"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  SAMPLE_ASSETS,
  CANONICAL_TAXONOMY,
  getCategoryBySlug,
  getSubcategory,
} from "@design-platform/editor";
import { Asset, AssetCategory, AssetCategoryItem, DesignDocument, DesignElement } from "@design-platform/types";
import { EditorPropertiesPanel } from "./EditorPropertiesPanel";
import { ScientificAssetsPanel, AssetNavLevel } from "./ScientificAssetsPanel";
import {
  LibraryBig,
  Shapes,
  Type,
  Upload,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Star,
  Triangle,
  Hexagon,
  ArrowRight,
  Heart,
  Plus,
  Layers,
  Shield,
  Activity,
  Dna,
  FlaskConical,
  Folder,
  Tag,
  FileUp,
  Trash2,
  Sparkles,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Copy,
  FileImage,
  Check,
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
  onUpdateSvgColor?: (fill?: string, stroke?: string) => void;
  onUpdateSvgColorMap?: (colorMap: Record<string, string>) => void;
  onResetSvgColors?: () => void;
  onSetCanvasBackground?: (color: string) => void;
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
  onAddShape,
  onAddText,
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
  onResetSvgColors,
  onSetCanvasBackground,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}) => {
  const isDraggingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    { id: "assets" as LeftPanelTab, label: "Assets", icon: <LibraryBig size={18} /> },
    { id: "elements" as LeftPanelTab, label: "Elements", icon: <Shapes size={18} /> },
    { id: "text" as LeftPanelTab, label: "Text", icon: <Type size={18} /> },
    { id: "uploads" as LeftPanelTab, label: "Uploads", icon: <Upload size={18} /> },
  ];

  const organizationTabs = [
    { id: "layers" as LeftPanelTab, label: "Layers", icon: <Layers size={18} /> },
  ];

  const contextualTabs = [
    {
      id: "properties" as LeftPanelTab,
      label: selectedElement ? "Properties" : "Canvas",
      icon: <SlidersHorizontal size={18} />,
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

  // Upload file handler
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setIsUploading(true);

    const file = files[0];
    const validTypes = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type) && !file.name.endsWith(".svg")) {
      setUploadError("Invalid file type. Please upload SVG, PNG, JPEG, or WebP.");
      setIsUploading(false);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError("File is too large. Maximum size is 15 MB.");
      setIsUploading(false);
      return;
    }

    const reader = new FileReader();
    if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
      reader.onload = (e) => {
        const svgContent = e.target?.result as string;
        const newAsset: Asset = {
          id: `upload-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          type: "svg",
          category: "uploads",
          source: svgContent,
          createdAt: new Date().toISOString(),
        };
        setUploadedAssets((prev) => [newAsset, ...prev]);
        setIsUploading(false);
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newAsset: Asset = {
          id: `upload-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          type: "image",
          category: "uploads",
          source: dataUrl,
          url: dataUrl,
          createdAt: new Date().toISOString(),
        };
        setUploadedAssets((prev) => [newAsset, ...prev]);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const activePage = document?.pages?.[activePageIndex || 0] || document?.pages?.[0];
  const pageElements = activePage?.elements || [];

  const renderRailButton = (tab: { id: LeftPanelTab; label: string; icon: React.ReactNode }) => {
    const isActive = activeTab === tab.id && !isCollapsed;
    return (
      <button
        key={tab.id}
        type="button"
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
          backgroundColor: isActive ? "#eff6ff" : "transparent",
          color: isActive ? "#2563eb" : "#64748b",
          cursor: "pointer",
          transition: "all 0.15s ease",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = "#f8fafc";
            e.currentTarget.style.color = "#0f172a";
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#64748b";
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
              backgroundColor: "#2563eb",
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
        backgroundColor: "#ffffff",
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
          borderRight: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "0.75rem 0",
          gap: "0.375rem",
          backgroundColor: "#ffffff",
          flexShrink: 0,
          overflowY: "auto",
        }}
      >
        {/* Creation Tools */}
        {creationTabs.map(renderRailButton)}

        {/* Divider */}
        <div style={{ width: "32px", height: "1px", backgroundColor: "#e2e8f0", margin: "4px 0" }} />

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
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderLeft: "none",
            borderRadius: "0 8px 8px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            cursor: "pointer",
            boxShadow: "2px 0 8px rgba(0,0,0,0.06)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f8fafc";
            e.currentTarget.style.color = "#0f172a";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#ffffff";
            e.currentTarget.style.color = "#64748b";
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
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#ffffff",
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
            <div
              style={{
                padding: "1.125rem 1.125rem 5rem 1.125rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Shapes size={17} style={{ color: "#059669" }} />
                    Shapes & Elements
                  </h2>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginTop: "2px",
                      margin: 0,
                    }}
                  >
                    Geometric shapes and scientific connectors
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleCollapsed}
                  title="Collapse panel"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "transparent",
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              {/* Section 1: Geometric Shapes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#64748b",
                  }}
                >
                  Geometric Shapes
                </span>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "0.5rem",
                  }}
                >
                  {/* Rectangle */}
                  <button
                    type="button"
                    onClick={() => onAddShape("rectangle")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "0.75rem 0.5rem",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#0f172a",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#2563eb";
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "26px",
                        backgroundColor: "#2563eb",
                        borderRadius: "3px",
                      }}
                    />
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>Rectangle</span>
                  </button>

                  {/* Circle */}
                  <button
                    type="button"
                    onClick={() => onAddShape("circle")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "0.75rem 0.5rem",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#0f172a",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#059669";
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                  >
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        backgroundColor: "#059669",
                        borderRadius: "50%",
                      }}
                    />
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>Circle</span>
                  </button>

                  {/* Connector Line */}
                  <button
                    type="button"
                    onClick={() => onAddShape("line")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "0.75rem 0.5rem",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#0f172a",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#d97706";
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "4px",
                        backgroundColor: "#d97706",
                        borderRadius: "2px",
                      }}
                    />
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>Connector Line</span>
                  </button>

                  {/* Star */}
                  <button
                    type="button"
                    onClick={() => {
                      const starAsset = combinedAssets.find((a) => a.id === "asset-shape-star");
                      if (starAsset) onAddAsset(starAsset);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "0.75rem 0.5rem",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#0f172a",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#eab308";
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                  >
                    <Star size={26} style={{ color: "#eab308", fill: "#eab308" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>Star</span>
                  </button>

                  {/* Triangle */}
                  <button
                    type="button"
                    onClick={() => {
                      const tri = combinedAssets.find((a) => a.id === "asset-shape-triangle");
                      if (tri) onAddAsset(tri);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "0.75rem 0.5rem",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#0f172a",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#2563eb";
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                  >
                    <Triangle size={24} style={{ color: "#2563eb", fill: "#2563eb" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>Triangle</span>
                  </button>

                  {/* Arrow Right */}
                  <button
                    type="button"
                    onClick={() => {
                      const arrow = combinedAssets.find(
                        (a) => a.id === "asset-shape-arrow-right"
                      );
                      if (arrow) onAddAsset(arrow);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "0.75rem 0.5rem",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#0f172a",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#8b5cf6";
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                  >
                    <ArrowRight size={24} style={{ color: "#8b5cf6" }} />
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>Arrow Indicator</span>
                  </button>
                </div>
              </div>

              {/* Section 2: Medical & Scientific Symbols */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#64748b",
                  }}
                >
                  Medical & Science Badges
                </span>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "0.5rem",
                  }}
                >
                  {/* Medical Cross */}
                  <button
                    type="button"
                    onClick={() => {
                      const cross = combinedAssets.find((a) => a.id === "asset-bio-cross");
                      if (cross) onAddAsset(cross);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "0.625rem 0.75rem",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#0f172a",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#ef4444";
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "4px",
                        backgroundColor: "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontWeight: 900,
                        fontSize: "16px",
                      }}
                    >
                      +
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 600 }}>Medical Cross</div>
                      <div style={{ fontSize: "9px", color: "#64748b" }}>First aid</div>
                    </div>
                  </button>

                  {/* Heart / Pulse */}
                  <button
                    type="button"
                    onClick={() => {
                      const heart = combinedAssets.find((a) => a.id === "asset-bio-heart");
                      if (heart) onAddAsset(heart);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "0.625rem 0.75rem",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#0f172a",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#ef4444";
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                  >
                    <Heart size={20} style={{ color: "#ef4444", fill: "#ef4444" }} />
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 600 }}>Heart Pulse</div>
                      <div style={{ fontSize: "9px", color: "#64748b" }}>Cardiology</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 3. TEXT TAB (Headings, Body & Scientific Labels)     */}
          {/* ==================================================== */}
          {activeTab === "text" && (
            <div
              style={{
                padding: "1.125rem 1.125rem 5rem 1.125rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Type size={17} style={{ color: "#2563eb" }} />
                    Typography & Labels
                  </h2>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginTop: "2px",
                      margin: 0,
                    }}
                  >
                    Scientific titles, body text, and figure callouts
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleCollapsed}
                  title="Collapse panel"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "transparent",
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {/* Heading */}
                <button
                  type="button"
                  onClick={() => onAddText("heading")}
                  style={{
                    padding: "0.875rem 1rem",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "#0f172a",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#2563eb";
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>Add a Heading</div>
                  <div style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "2px" }}>
                    32px Bold title for illustrations & diagrams
                  </div>
                </button>

                {/* Subheading */}
                <button
                  type="button"
                  onClick={() => onAddText("subheading")}
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "#0f172a",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#2563eb";
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontSize: "1rem", fontWeight: 600 }}>Add a Subheading</div>
                  <div style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "2px" }}>
                    20px Semi-bold section subtitle
                  </div>
                </button>

                {/* Body Text */}
                <button
                  type="button"
                  onClick={() => onAddText("body")}
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "#0f172a",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#2563eb";
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontSize: "0.875rem", fontWeight: 400 }}>Add Body Text</div>
                  <div style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "2px" }}>
                    15px Regular descriptive paragraph
                  </div>
                </button>

                {/* Scientific Label / Callout */}
                <button
                  type="button"
                  onClick={() => onAddText("label")}
                  style={{
                    padding: "0.75rem 1rem",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "#0f172a",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#2563eb";
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#2563eb" }}>
                    Add Figure Label / Caption
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "#64748b", marginTop: "2px" }}>
                    12px Compact label for antibodies, cells & receptors
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 4. UPLOADS TAB (Functional Drag-and-Drop Zone)       */}
          {/* ==================================================== */}
          {activeTab === "uploads" && (
            <div
              style={{
                padding: "1.125rem 1.125rem 5rem 1.125rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Upload size={17} style={{ color: "#2563eb" }} />
                    My Uploads
                  </h2>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginTop: "2px",
                      margin: 0,
                    }}
                  >
                    Workspace-owned images & SVG models
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleCollapsed}
                  title="Collapse panel"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "transparent",
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleFileUpload(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: "1.5rem 1rem",
                  borderRadius: "10px",
                  border: "2px dashed #cbd5e1",
                  backgroundColor: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  gap: "0.625rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2563eb";
                  e.currentTarget.style.backgroundColor = "#eff6ff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.backgroundColor = "#f8fafc";
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileUpload(e.target.files)}
                />

                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#2563eb",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <FileUp size={22} />
                </div>

                <div>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0f172a" }}>
                    Click to browse or drag file here
                  </span>
                  <p
                    style={{
                      fontSize: "0.6875rem",
                      color: "#64748b",
                      marginTop: "2px",
                      margin: 0,
                    }}
                  >
                    SVG, PNG, JPG, or WebP (up to 15 MB)
                  </p>
                </div>
              </div>

              {uploadError && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    fontSize: "11px",
                  }}
                >
                  {uploadError}
                </div>
              )}

              {/* Uploaded List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#64748b",
                    }}
                  >
                    Recent Uploads ({uploadedAssets.length})
                  </span>
                </div>

                {uploadedAssets.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "0.5rem",
                    }}
                  >
                    {uploadedAssets.map((asset) => (
                      <div
                        key={asset.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/json", JSON.stringify(asset));
                        }}
                        onClick={() => handleAssetInsert(asset)}
                        style={{
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "0.5rem",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "4px",
                          cursor: "pointer",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {asset.type === "svg" ? (
                            <div
                              style={{ width: "100%", height: "100%" }}
                              dangerouslySetInnerHTML={{ __html: asset.source }}
                            />
                          ) : (
                            <img
                              src={asset.url || asset.source}
                              alt={asset.name}
                              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                            />
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 500,
                            color: "#0f172a",
                            textAlign: "center",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            width: "100%",
                          }}
                        >
                          {asset.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "1rem",
                      textAlign: "center",
                      backgroundColor: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px dashed #e2e8f0",
                      fontSize: "11px",
                      color: "#94a3b8",
                    }}
                  >
                    No uploaded assets yet. Drag and drop custom SVGs or images above.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 5. LAYERS TAB (Active Page Element Stack)            */}
          {/* ==================================================== */}
          {activeTab === "layers" && (
            <div
              style={{
                padding: "1.125rem 1.125rem 5rem 1.125rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Layers size={17} style={{ color: "#2563eb" }} />
                    Page Layers
                  </h2>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginTop: "2px",
                      margin: 0,
                    }}
                  >
                    {pageElements.length} {pageElements.length === 1 ? "layer" : "layers"} on active page
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleCollapsed}
                  title="Collapse panel"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "transparent",
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
              </div>

              {/* Elements List */}
              {pageElements.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {[...pageElements].reverse().map((el) => {
                    const isSelected = selectedElement?.id === el.id;
                    const elTitle = formatAssetName(el.name || el.type);

                    return (
                      <div
                        key={el.id}
                        onClick={() => onSelectElement?.(el.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: `1px solid ${isSelected ? "#2563eb" : "#e2e8f0"}`,
                          backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.12s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = "#ffffff";
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <span
                            style={{
                              color: isSelected ? "#2563eb" : "#64748b",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {el.type === "svg" ? (
                              <LibraryBig size={15} />
                            ) : el.type === "text" ? (
                              <Type size={15} />
                            ) : el.type === "shape" ? (
                              <Shapes size={15} />
                            ) : (
                              <FileImage size={15} />
                            )}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: isSelected ? 600 : 500,
                              color: isSelected ? "#1d4ed8" : "#1e293b",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={elTitle}
                          >
                            {elTitle}
                          </span>
                        </div>

                        {/* Layer Actions */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "2px",
                            flexShrink: 0,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onBringForward?.(el.id)}
                            title="Bring Forward"
                            style={{
                              background: "none",
                              border: "none",
                              padding: "3px 4px",
                              color: "#64748b",
                              cursor: "pointer",
                              borderRadius: "4px",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onSendBackward?.(el.id)}
                            title="Send Backward"
                            style={{
                              background: "none",
                              border: "none",
                              padding: "3px 4px",
                              color: "#64748b",
                              cursor: "pointer",
                              borderRadius: "4px",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateElement?.(el.id)}
                            title="Duplicate"
                            style={{
                              background: "none",
                              border: "none",
                              padding: "3px 4px",
                              color: "#64748b",
                              cursor: "pointer",
                              borderRadius: "4px",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#2563eb")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteElement?.(el.id)}
                            title="Delete"
                            style={{
                              background: "none",
                              border: "none",
                              padding: "3px 4px",
                              color: "#dc2626",
                              cursor: "pointer",
                              borderRadius: "4px",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = "#fee2e2")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = "transparent")
                            }
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    padding: "2rem 1rem",
                    textAlign: "center",
                    backgroundColor: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px dashed #e2e8f0",
                    fontSize: "12px",
                    color: "#94a3b8",
                  }}
                >
                  No elements on this page. Add an illustration, shape, or text.
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* 6. CONTEXTUAL PROPERTIES & CANVAS SETTINGS           */}
          {/* ==================================================== */}
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
              onResetSvgColors={onResetSvgColors}
              onSetCanvasBackground={onSetCanvasBackground || (() => {})}
              embedded
              onBackToLibrary={() => handleTabClick("assets")}
            />
          )}

          {activeTab === "properties" && (!document || !onUpdateElement) && (
            <div
              style={{
                padding: "2rem 1rem",
                color: "#64748b",
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

"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { SAMPLE_ASSETS } from "@design-platform/editor";
import { Asset, AssetCategory } from "@design-platform/types";
import { Sparkles, Square, Type, Upload, Search, Circle, Minus, Info } from "lucide-react";

export type LeftPanelTab = "assets" | "elements" | "text" | "uploads";

export interface EditorLeftPanelProps {
  onAddAsset: (asset: Asset) => void;
  onAddShape: (shapeType: "rectangle" | "circle" | "line") => void;
  onAddText: (variant: "heading" | "subheading" | "body") => void;
}

export const EditorLeftPanel: React.FC<EditorLeftPanelProps> = ({
  onAddAsset,
  onAddShape,
  onAddText,
}) => {
  const isDraggingRef = useRef(false);
  const [activeTab, setActiveTab] = useState<LeftPanelTab>("assets");
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [remoteAssets, setRemoteAssets] = useState<Asset[]>([]);
  const [remoteCategories, setRemoteCategories] = useState<string[]>([]);

  // Fetch dynamic assets from Supabase (Cloudflare R2 stored)
  useEffect(() => {
    let mounted = true;
    async function loadAssets() {
      try {
        const res = await fetch("/api/assets");
        const json = await res.json();
        if (mounted && json.success && Array.isArray(json.data)) {
          setRemoteAssets(json.data);
          if (Array.isArray(json.categories)) {
            setRemoteCategories(json.categories);
          }
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

  const tabs = [
    { id: "assets" as LeftPanelTab, label: "Assets", icon: <Sparkles size={18} /> },
    { id: "elements" as LeftPanelTab, label: "Elements", icon: <Square size={18} /> },
    { id: "text" as LeftPanelTab, label: "Text", icon: <Type size={18} /> },
    { id: "uploads" as LeftPanelTab, label: "Uploads", icon: <Upload size={18} /> },
  ];

  // Combined assets (remote assets take precedence)
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

  // Combined categories
  const categoryChips = useMemo(() => {
    const defaultChips = [
      { id: "all", label: "All" },
      { id: "science", label: "Science & Bio" },
      { id: "shapes", label: "Shapes" },
      { id: "icons", label: "Icons" },
    ];
    const knownIds = new Set(defaultChips.map((c) => c.id));
    const customChips = remoteCategories
      .filter((cat) => !knownIds.has(cat))
      .map((cat) => ({
        id: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
      }));
    return [...defaultChips, ...customChips];
  }, [remoteCategories]);

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return combinedAssets.filter((asset) => {
      // Category filter
      if (selectedCategory !== "all" && asset.category !== selectedCategory) {
        return false;
      }
      // Search filter
      if (assetSearch.trim()) {
        const q = assetSearch.toLowerCase();
        const matchesName = asset.name.toLowerCase().includes(q);
        const matchesTag = asset.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesCategory = asset.category.toLowerCase().includes(q);
        return matchesName || matchesTag || matchesCategory;
      }
      return true;
    });
  }, [combinedAssets, assetSearch, selectedCategory]);

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 56px)",
        backgroundColor: "#0d0d10",
        zIndex: 40,
      }}
    >
      {/* Icon Rail */}
      <nav
        style={{
          width: "64px",
          borderRight: "1px solid #27272a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "0.75rem 0",
          gap: "0.5rem",
          backgroundColor: "#09090b",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: "50px",
                height: "50px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: isActive ? "#27272a" : "transparent",
                color: isActive ? "#3b82f6" : "#71717a",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = "#d4d4d8";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = "#71717a";
              }}
            >
              <span>{tab.icon}</span>
              <span style={{ fontSize: "10px", fontWeight: isActive ? 600 : 500 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Drawer Content */}
      <div
        style={{
          width: "290px",
          borderRight: "1px solid #27272a",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#121215",
          overflowY: "auto",
        }}
      >
        {/* ASSETS TAB */}
        {activeTab === "assets" && (
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#f4f4f5", margin: 0 }}>
                Asset Library
              </h2>
              <p style={{ fontSize: "0.75rem", color: "#a1a1aa", marginTop: "2px", margin: 0 }}>
                Drag onto canvas or click to add
              </p>
            </div>

            {/* Search Input */}
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "0.625rem",
                  color: "#71717a",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                placeholder="Search assets..."
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                style={{
                  width: "100%",
                  height: "32px",
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "6px",
                  padding: "0 0.5rem 0 2rem",
                  fontSize: "0.75rem",
                  color: "#f4f4f5",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Category Chips */}
            <div style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "2px" }}>
              {categoryChips.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: isSelected ? 600 : 500,
                      backgroundColor: isSelected ? "#3b82f6" : "#18181b",
                      color: isSelected ? "#ffffff" : "#a1a1aa",
                      border: `1px solid ${isSelected ? "#2563eb" : "#27272a"}`,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Assets Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "0.5rem",
              }}
            >
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => {
                    isDraggingRef.current = true;
                    e.dataTransfer.setData("application/json", JSON.stringify(asset));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onDragEnd={() => {
                    setTimeout(() => {
                      isDraggingRef.current = false;
                    }, 120);
                  }}
                  onClick={() => {
                    if (isDraggingRef.current) return;
                    onAddAsset(asset);
                  }}
                  style={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    padding: "0.75rem 0.5rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "grab",
                    transition: "all 0.15s ease",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.backgroundColor = "#222226";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#27272a";
                    e.currentTarget.style.backgroundColor = "#18181b";
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {asset.source && asset.source.startsWith("<svg") && !asset.source.startsWith("http") ? (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        dangerouslySetInnerHTML={{ __html: asset.source }}
                      />
                    ) : asset.url || asset.thumbnail || (asset.source && (asset.source.startsWith("http") || asset.source.startsWith("/"))) ? (
                      <img
                        src={asset.url || asset.thumbnail || asset.source}
                        alt={asset.name}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        dangerouslySetInnerHTML={{ __html: asset.source || "" }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#d4d4d8",
                      textAlign: "center",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%",
                    }}
                    title={asset.name}
                  >
                    {asset.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ELEMENTS TAB */}
        {activeTab === "elements" && (
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#f4f4f5", margin: 0 }}>
                Basic Elements
              </h2>
              <p style={{ fontSize: "0.75rem", color: "#a1a1aa", marginTop: "2px", margin: 0 }}>
                Click to add geometry to canvas
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => onAddShape("rectangle")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  color: "#f4f4f5",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#27272a")}
              >
                <div
                  style={{
                    width: "32px",
                    height: "22px",
                    backgroundColor: "#3b82f6",
                    borderRadius: "4px",
                  }}
                />
                <div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Rectangle</div>
                  <div style={{ fontSize: "0.6875rem", color: "#71717a" }}>Box / Card shape</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddShape("circle")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  color: "#f4f4f5",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#27272a")}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    backgroundColor: "#10b981",
                    borderRadius: "50%",
                  }}
                />
                <div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Circle</div>
                  <div style={{ fontSize: "0.6875rem", color: "#71717a" }}>
                    Ellipse / Round node
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddShape("line")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  color: "#f4f4f5",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#27272a")}
              >
                <div
                  style={{
                    width: "32px",
                    height: "4px",
                    backgroundColor: "#f59e0b",
                    borderRadius: "2px",
                  }}
                />
                <div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Line / Connector</div>
                  <div style={{ fontSize: "0.6875rem", color: "#71717a" }}>Connecting line</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* TEXT TAB */}
        {activeTab === "text" && (
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#f4f4f5", margin: 0 }}>
                Text Elements
              </h2>
              <p style={{ fontSize: "0.75rem", color: "#a1a1aa", marginTop: "2px", margin: 0 }}>
                Click to add text boxes
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <button
                type="button"
                onClick={() => onAddText("heading")}
                style={{
                  padding: "1rem",
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "#f4f4f5",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#27272a")}
              >
                <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>Add a heading</div>
                <div style={{ fontSize: "0.6875rem", color: "#71717a", marginTop: "2px" }}>
                  32px Bold
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddText("subheading")}
                style={{
                  padding: "0.875rem 1rem",
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "#f4f4f5",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#27272a")}
              >
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>Add a subheading</div>
                <div style={{ fontSize: "0.6875rem", color: "#71717a", marginTop: "2px" }}>
                  20px Semi-bold
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddText("body")}
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "#f4f4f5",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#27272a")}
              >
                <div style={{ fontSize: "0.875rem", fontWeight: 400 }}>Add body text</div>
                <div style={{ fontSize: "0.6875rem", color: "#71717a", marginTop: "2px" }}>
                  15px Regular description
                </div>
              </button>
            </div>
          </div>
        )}

        {/* UPLOADS TAB */}
        {activeTab === "uploads" && (
          <div
            style={{
              padding: "1.5rem 1rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: "0.75rem",
              height: "100%",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#71717a",
              }}
            >
              <Upload size={22} />
            </div>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f4f4f5", margin: 0 }}>
              Custom Uploads
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#71717a", margin: 0, lineHeight: 1.5 }}>
              Upload custom SVG icons, microscope images, and molecular plots. Coming in Phase 2.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

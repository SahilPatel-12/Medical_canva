"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  SAMPLE_ASSETS,
  CANONICAL_TAXONOMY,
  getCategoryBySlug,
  getSubcategory,
} from "@design-platform/editor";
import { Asset, AssetCategoryItem, AssetSubcategoryItem } from "@design-platform/types";
import {
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Star,
  Plus,
  Check,
  RefreshCw,
  LibraryBig,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import { CategoryThumbnail, getCategoryTheme } from "./categoryThumbnails";
import { formatAssetName } from "./EditorLeftPanel";

export type AssetNavLevel = "root" | "category" | "subcategory" | "search" | "favorites" | "all";

export interface ScientificAssetsPanelProps {
  onAddAsset: (asset: Asset) => void;
  onToggleCollapse?: () => void;
  initialNavLevel?: AssetNavLevel;
  initialCategorySlug?: string | null;
  initialSubcategorySlug?: string | null;
  onNavStateChange?: (state: {
    level: AssetNavLevel;
    categorySlug: string | null;
    subcategorySlug: string | null;
  }) => void;
}

export const ScientificAssetsPanel: React.FC<ScientificAssetsPanelProps> = ({
  onAddAsset,
  onToggleCollapse,
  initialNavLevel = "root",
  initialCategorySlug = null,
  initialSubcategorySlug = null,
  onNavStateChange,
}) => {
  const isDraggingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Navigation State
  const [navLevel, setNavLevel] = useState<AssetNavLevel>(initialNavLevel);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(initialCategorySlug);
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState<string | null>(initialSubcategorySlug);

  // Search queries at each level
  const [globalSearch, setGlobalSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");

  // Sort State
  const [sortBy, setSortBy] = useState<"name" | "recent">("name");

  // Favorites (persisted in localStorage)
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("medical_canvas_favorite_assets");
        if (stored) return new Set(JSON.parse(stored));
      } catch {
        // Ignore JSON parsing errors
      }
    }
    return new Set<string>();
  });

  // Assets Data Loading State
  const [remoteAssets, setRemoteAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Feedback State
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Pagination for dedicated illustration grid
  const [displayCount, setDisplayCount] = useState(24);

  // Sync nav state with parent if requested
  useEffect(() => {
    onNavStateChange?.({
      level: navLevel,
      categorySlug: selectedCategorySlug,
      subcategorySlug: selectedSubcategorySlug,
    });
  }, [navLevel, selectedCategorySlug, selectedSubcategorySlug, onNavStateChange]);

  // Persist favorites
  const toggleFavorite = (assetId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      try {
        localStorage.setItem("medical_canvas_favorite_assets", JSON.stringify(Array.from(next)));
      } catch {
        // Ignore quota errors
      }
      return next;
    });
  };

  // Fetch dynamic assets from real repository via /api/assets
  const fetchRemoteAssets = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/assets");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setRemoteAssets(json.data);
      } else {
        setLoadError(json.error || "Failed to load dynamic assets");
      }
    } catch (err) {
      console.warn("Could not load dynamic assets:", err);
      setLoadError("Offline or database connection unavailable. Loaded built-in canonical library.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRemoteAssets();
  }, []);

  // Merge canonical library with real repository assets (deduping by ID)
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

  // Accurate asset counts per category (computed strictly from confirmed repository assets)
  const categoryAssetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const asset of combinedAssets) {
      const slug =
        asset.categorySlug ||
        CANONICAL_TAXONOMY.find(
          (c) =>
            c.slug === asset.category ||
            c.name.toLowerCase() === asset.category.toLowerCase()
        )?.slug;
      if (slug) {
        counts[slug] = (counts[slug] || 0) + 1;
      }
    }
    return counts;
  }, [combinedAssets]);

  // Accurate asset counts per subcategory
  const subcategoryAssetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const asset of combinedAssets) {
      if (asset.subcategorySlug) {
        counts[asset.subcategorySlug] = (counts[asset.subcategorySlug] || 0) + 1;
      }
    }
    return counts;
  }, [combinedAssets]);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Active Category & Subcategory Objects
  const activeCategory = useMemo(() => {
    if (!selectedCategorySlug) return null;
    return getCategoryBySlug(selectedCategorySlug) || null;
  }, [selectedCategorySlug]);

  const activeSubcategory = useMemo(() => {
    if (!selectedCategorySlug || !selectedSubcategorySlug) return null;
    return getSubcategory(selectedCategorySlug, selectedSubcategorySlug) || null;
  }, [selectedCategorySlug, selectedSubcategorySlug]);

  // Handlers for Navigation
  const navigateToRoot = () => {
    setNavLevel("root");
    setSelectedCategorySlug(null);
    setSelectedSubcategorySlug(null);
    setGlobalSearch("");
    setCategorySearch("");
    setSubcategorySearch("");
    setDisplayCount(24);
  };

  const navigateToCategory = (catSlug: string) => {
    setSelectedCategorySlug(catSlug);
    setSelectedSubcategorySlug(null);
    setNavLevel("category");
    setCategorySearch("");
    setSubcategorySearch("");
    setDisplayCount(24);
  };

  const navigateToSubcategory = (subSlug: string) => {
    setSelectedSubcategorySlug(subSlug);
    setNavLevel("subcategory");
    setSubcategorySearch("");
    setDisplayCount(24);
  };

  const navigateToFavorites = () => {
    setNavLevel("favorites");
    setDisplayCount(24);
  };

  const navigateToAllAssets = () => {
    setNavLevel("all");
    setDisplayCount(24);
  };

  // Insertion Handler
  const handleAssetInsert = (asset: Asset) => {
    onAddAsset(asset);
    setJustAddedId(asset.id);
    setTimeout(() => setJustAddedId(null), 600);
  };

  // Global Search results
  const globalSearchResults = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.toLowerCase().trim();
    return combinedAssets.filter((asset) => {
      const cleanName = formatAssetName(asset.name).toLowerCase();
      const matchesName = cleanName.includes(q) || asset.name.toLowerCase().includes(q);
      const matchesTag = asset.tags?.some((t) => t.toLowerCase().includes(q));
      const matchesCategory =
        asset.category.toLowerCase().includes(q) ||
        (asset.categorySlug && asset.categorySlug.toLowerCase().includes(q));
      const matchesSubcategory =
        (asset.subcategorySlug && asset.subcategorySlug.toLowerCase().includes(q)) ||
        (asset.subcategoryName && asset.subcategoryName.toLowerCase().includes(q));
      return matchesName || matchesTag || matchesCategory || matchesSubcategory;
    });
  }, [combinedAssets, globalSearch]);

  // Scoped Category illustrations
  const categoryAssets = useMemo(() => {
    if (!selectedCategorySlug) return [];
    const cat = activeCategory;
    let list = combinedAssets.filter((asset) => {
      const matchSlug =
        asset.categorySlug === selectedCategorySlug ||
        asset.category === selectedCategorySlug ||
        (cat && asset.category.toLowerCase() === cat.name.toLowerCase());
      return matchSlug;
    });

    if (categorySearch.trim()) {
      const q = categorySearch.toLowerCase().trim();
      list = list.filter((asset) => {
        const cleanName = formatAssetName(asset.name).toLowerCase();
        const matchesName = cleanName.includes(q) || asset.name.toLowerCase().includes(q);
        const matchesTag = asset.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesSub =
          (asset.subcategorySlug && asset.subcategorySlug.toLowerCase().includes(q)) ||
          (asset.subcategoryName && asset.subcategoryName.toLowerCase().includes(q));
        return matchesName || matchesTag || matchesSub;
      });
    }

    return list;
  }, [combinedAssets, selectedCategorySlug, activeCategory, categorySearch]);

  // Scoped Subcategory illustrations
  const subcategoryAssets = useMemo(() => {
    if (!selectedCategorySlug || !selectedSubcategorySlug) return [];
    let list = combinedAssets.filter((asset) => {
      return (
        asset.subcategorySlug === selectedSubcategorySlug ||
        (asset.tags && asset.tags.includes(selectedSubcategorySlug))
      );
    });

    if (subcategorySearch.trim()) {
      const q = subcategorySearch.toLowerCase().trim();
      list = list.filter((asset) => {
        const cleanName = formatAssetName(asset.name).toLowerCase();
        const matchesName = cleanName.includes(q) || asset.name.toLowerCase().includes(q);
        const matchesTag = asset.tags?.some((t) => t.toLowerCase().includes(q));
        return matchesName || matchesTag;
      });
    }

    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "recent") {
      list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }

    return list;
  }, [combinedAssets, selectedCategorySlug, selectedSubcategorySlug, subcategorySearch, sortBy]);

  // Favorite Assets list
  const favoriteAssets = useMemo(() => {
    return combinedAssets.filter((asset) => favorites.has(asset.id));
  }, [combinedAssets, favorites]);

  // All Assets list
  const allAssetsList = useMemo(() => {
    let list = [...combinedAssets];
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      list = list.filter((a) => {
        const cleanName = formatAssetName(a.name).toLowerCase();
        return cleanName.includes(q) || a.tags?.some((t) => t.toLowerCase().includes(q));
      });
    }
    if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [combinedAssets, globalSearch, sortBy]);

  // Handle Global Search change
  const handleGlobalSearchChange = (val: string) => {
    setGlobalSearch(val);
    if (val.trim()) {
      if (navLevel !== "search") setNavLevel("search");
    } else if (navLevel === "search") {
      setNavLevel("root");
    }
  };

  // Render an individual illustration card for dedicated grid
  const renderIllustrationCard = (asset: Asset) => {
    const formattedTitle = formatAssetName(asset.name);
    const isJustAdded = justAddedId === asset.id;
    const isFav = favorites.has(asset.id);

    return (
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
          handleAssetInsert(asset);
        }}
        title={`Click to insert "${formattedTitle}" into canvas (or drag & drop)`}
        style={{
          backgroundColor: isJustAdded ? "#eff6ff" : "#ffffff",
          border: `1px solid ${isJustAdded ? "#2563eb" : "#e2e8f0"}`,
          borderRadius: "10px",
          padding: "0.625rem 0.5rem 0.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          cursor: "pointer",
          transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
          userSelect: "none",
          position: "relative",
          boxShadow: isJustAdded
            ? "0 0 0 2px rgba(37, 99, 235, 0.2)"
            : "0 1px 2px rgba(0,0,0,0.03)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#2563eb";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow =
            "0 6px 14px -2px rgba(37, 99, 235, 0.1), 0 2px 4px -1px rgba(0,0,0,0.04)";
        }}
        onMouseLeave={(e) => {
          if (!isJustAdded) {
            e.currentTarget.style.borderColor = "#e2e8f0";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)";
          }
        }}
      >
        {/* Favorite Star Button */}
        <button
          type="button"
          onClick={(e) => toggleFavorite(asset.id, e)}
          title={isFav ? "Remove from favorites" : "Save to favorites"}
          style={{
            position: "absolute",
            top: "5px",
            left: "5px",
            width: "22px",
            height: "22px",
            borderRadius: "5px",
            backgroundColor: isFav ? "#fef3c7" : "rgba(255, 255, 255, 0.9)",
            border: `1px solid ${isFav ? "#fde68a" : "#e2e8f0"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isFav ? "#d97706" : "#94a3b8",
            cursor: "pointer",
            transition: "all 0.15s ease",
            padding: 0,
            zIndex: 2,
          }}
        >
          <Star size={11} fill={isFav ? "#f59e0b" : "none"} />
        </button>

        {/* Quick Insert Corner Badge */}
        <div
          title="Click to insert into canvas"
          style={{
            position: "absolute",
            top: "5px",
            right: "5px",
            width: "22px",
            height: "22px",
            borderRadius: "5px",
            backgroundColor: isJustAdded ? "#2563eb" : "rgba(255, 255, 255, 0.9)",
            border: `1px solid ${isJustAdded ? "#2563eb" : "#e2e8f0"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isJustAdded ? "#ffffff" : "#64748b",
            transition: "all 0.15s ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            zIndex: 2,
          }}
        >
          {isJustAdded ? <Check size={12} /> : <Plus size={12} />}
        </div>

        {/* Graphic Preview (Lazy Loaded & Centered) */}
        <div
          style={{
            width: "72px",
            height: "72px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            padding: "4px",
          }}
        >
          {asset.source &&
          asset.source.startsWith("<svg") &&
          !asset.source.startsWith("http") ? (
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
          ) : asset.url ||
            asset.thumbnail ||
            (asset.source &&
              (asset.source.startsWith("http") || asset.source.startsWith("/"))) ? (
            <img
              src={asset.url || asset.thumbnail || asset.source}
              alt={formattedTitle}
              loading="lazy"
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

        {/* Clean Formatted Name with Tooltip */}
        <span
          style={{
            fontSize: "11px",
            color: "#1e293b",
            textAlign: "center",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: "100%",
            padding: "0 4px",
          }}
          title={formattedTitle}
        >
          {formattedTitle}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        padding: "1rem 1.125rem 5rem 1.125rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.875rem",
        minHeight: "100%",
      }}
    >
      {/* ==================================================== */}
      {/* 1. TOP HEADER & COLLAPSE CONTROL                     */}
      {/* ==================================================== */}
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
              gap: "7px",
            }}
          >
            <LibraryBig size={17} style={{ color: "#2563eb" }} />
            Scientific Assets
          </h2>
          <p
            style={{
              fontSize: "0.75rem",
              color: "#64748b",
              marginTop: "2px",
              margin: 0,
            }}
          >
            BioRender-inspired scientific illustration library
          </p>
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
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
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f1f5f9";
              e.currentTarget.style.color = "#0f172a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#64748b";
            }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* ==================================================== */}
      {/* 2. ROOT VIEW OR GLOBAL SEARCH / SHORTCUTS            */}
      {/* ==================================================== */}
      {(navLevel === "root" || navLevel === "search" || navLevel === "favorites" || navLevel === "all") && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {/* Global Search Field */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "0.75rem",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search 102+ categories & illustrations... (/)"
              value={globalSearch}
              onChange={(e) => handleGlobalSearchChange(e.target.value)}
              style={{
                width: "100%",
                height: "38px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0 2rem 0 2.25rem",
                fontSize: "0.8125rem",
                color: "#0f172a",
                outline: "none",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563eb";
                e.target.style.backgroundColor = "#ffffff";
                e.target.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#e2e8f0";
                e.target.style.backgroundColor = "#f8fafc";
                e.target.style.boxShadow = "none";
              }}
            />
            {globalSearch.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setGlobalSearch("");
                  setNavLevel("root");
                }}
                title="Clear search"
                style={{
                  position: "absolute",
                  right: "0.625rem",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Shortcuts: Browse Categories / Favorites / All Assets */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              onClick={navigateToRoot}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: "6px",
                border: `1px solid ${navLevel === "root" ? "#2563eb" : "#e2e8f0"}`,
                backgroundColor: navLevel === "root" ? "#eff6ff" : "#ffffff",
                color: navLevel === "root" ? "#1d4ed8" : "#64748b",
                fontSize: "11px",
                fontWeight: navLevel === "root" ? 600 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <span>Categories</span>
              <span
                style={{
                  fontSize: "10px",
                  backgroundColor: navLevel === "root" ? "#dbeafe" : "#f1f5f9",
                  padding: "1px 5px",
                  borderRadius: "10px",
                }}
              >
                15
              </span>
            </button>

            <button
              type="button"
              onClick={navigateToFavorites}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: "6px",
                border: `1px solid ${navLevel === "favorites" ? "#d97706" : "#e2e8f0"}`,
                backgroundColor: navLevel === "favorites" ? "#fffbeb" : "#ffffff",
                color: navLevel === "favorites" ? "#b45309" : "#64748b",
                fontSize: "11px",
                fontWeight: navLevel === "favorites" ? 600 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <Star size={11} fill={favorites.size > 0 ? "#f59e0b" : "none"} color="#d97706" />
              <span>Favorites</span>
              <span
                style={{
                  fontSize: "10px",
                  backgroundColor: navLevel === "favorites" ? "#fef3c7" : "#f1f5f9",
                  padding: "1px 5px",
                  borderRadius: "10px",
                }}
              >
                {favorites.size}
              </span>
            </button>

            <button
              type="button"
              onClick={navigateToAllAssets}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: "6px",
                border: `1px solid ${navLevel === "all" ? "#2563eb" : "#e2e8f0"}`,
                backgroundColor: navLevel === "all" ? "#eff6ff" : "#ffffff",
                color: navLevel === "all" ? "#1d4ed8" : "#64748b",
                fontSize: "11px",
                fontWeight: navLevel === "all" ? 600 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <Layers size={11} />
              <span>All Assets</span>
            </button>
          </div>
        </div>
      )}

      {/* Network / Loading / Retry Banner */}
      {loadError && (
        <div
          style={{
            padding: "6px 10px",
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "6px",
            fontSize: "11px",
            color: "#92400e",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Info size={13} style={{ color: "#d97706", flexShrink: 0 }} />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={fetchRemoteAssets}
            disabled={isLoading}
            style={{
              background: "none",
              border: "none",
              color: "#b45309",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* ====================================================================== */}
      {/* SCREEN A: ASSET LIBRARY HOME (CATEGORY-FIRST BROWSING LIST)             */}
      {/* ====================================================================== */}
      {navLevel === "root" && !globalSearch.trim() && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Section Heading */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "2px 2px",
            }}
          >
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#64748b",
              }}
            >
              Browse categories
            </span>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>
              15 categories
            </span>
          </div>

          {/* Full-width Category Navigation Rows (No competing illustration grid!) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              paddingRight: "2px",
            }}
          >
            {CANONICAL_TAXONOMY.map((cat) => {
              const theme = getCategoryTheme(cat.slug);
              const accurateCount = categoryAssetCounts[cat.slug] || 0;

              return (
                <div
                  key={cat.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToCategory(cat.slug)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigateToCategory(cat.slug);
                    }
                  }}
                  style={{
                    minHeight: "66px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #f1f5f9",
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f8fafc";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.boxShadow =
                      "0 3px 8px -1px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.borderColor = "#f1f5f9";
                    e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.02)";
                  }}
                >
                  {/* Left: Scientific Thumbnail Badge & Category Info */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <CategoryThumbnail slug={cat.slug} size={42} />

                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: "0.84375rem",
                          fontWeight: 600,
                          color: "#0f172a",
                          lineHeight: 1.3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cat.name}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          color: "#64748b",
                          marginTop: "2px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cat.subcategories.length} subcategories
                        {accurateCount > 0 ? ` • ${accurateCount} ${accurateCount === 1 ? "asset" : "assets"}` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Right: Accurate Count Badge & Chevron */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {accurateCount > 0 && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: "10px",
                          backgroundColor: theme.background,
                          color: theme.accent,
                          border: `1px solid ${theme.border}`,
                        }}
                      >
                        {accurateCount}
                      </span>
                    )}
                    <ChevronRight size={16} style={{ color: "#94a3b8" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* SCREEN B: MAIN CATEGORY VIEW (SUB-CATEGORIES LISTING)                  */}
      {/* ====================================================================== */}
      {navLevel === "category" && activeCategory && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Back Navigation Button */}
          <button
            type="button"
            onClick={navigateToRoot}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "none",
              border: "none",
              color: "#2563eb",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              padding: "2px 0",
              alignSelf: "flex-start",
            }}
          >
            <ArrowLeft size={14} />
            <span>Back to Categories</span>
          </button>

          {/* Category Banner Card */}
          <div
            style={{
              padding: "12px 14px",
              backgroundColor: getCategoryTheme(activeCategory.slug).background,
              border: `1px solid ${getCategoryTheme(activeCategory.slug).border}`,
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <CategoryThumbnail slug={activeCategory.slug} size={46} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: 0,
                  lineHeight: 1.25,
                }}
              >
                {activeCategory.name}
              </h3>
              {activeCategory.description && (
                <p
                  style={{
                    fontSize: "0.6875rem",
                    color: "#475569",
                    margin: "3px 0 0 0",
                    lineHeight: 1.35,
                  }}
                >
                  {activeCategory.description}
                </p>
              )}
            </div>
          </div>

          {/* Scoped Category Search Field */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: "0.75rem",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder={`Search in ${activeCategory.name}...`}
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              style={{
                width: "100%",
                height: "36px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0 2rem 0 2.25rem",
                fontSize: "0.8125rem",
                color: "#0f172a",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            {categorySearch.length > 0 && (
              <button
                type="button"
                onClick={() => setCategorySearch("")}
                style={{
                  position: "absolute",
                  right: "0.625rem",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* If Category Search has input: show dedicated category search results */}
          {categorySearch.trim() ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 2px",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Matching Illustrations
                </span>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                  {categoryAssets.length} found
                </span>
              </div>

              {categoryAssets.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "0.625rem",
                  }}
                >
                  {categoryAssets.slice(0, displayCount).map(renderIllustrationCard)}
                </div>
              ) : (
                <div
                  style={{
                    padding: "2rem 1rem",
                    textAlign: "center",
                    backgroundColor: "#f8fafc",
                    borderRadius: "10px",
                    border: "1px dashed #cbd5e1",
                    color: "#64748b",
                    fontSize: "0.8125rem",
                  }}
                >
                  No illustrations found in &ldquo;{activeCategory.name}&rdquo; for &ldquo;{categorySearch}&rdquo;
                </div>
              )}
            </div>
          ) : (
            /* Subcategories Listing as compact visual rows */
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "2px 2px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#64748b",
                  }}
                >
                  Subcategories ({activeCategory.subcategories.length})
                </span>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Select to browse</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {activeCategory.subcategories.map((sub) => {
                  const subCount = subcategoryAssetCounts[sub.slug] || 0;

                  return (
                    <div
                      key={sub.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigateToSubcategory(sub.slug)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigateToSubcategory(sub.slug);
                        }
                      }}
                      style={{
                        padding: "10px 14px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #f1f5f9",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#eff6ff";
                        e.currentTarget.style.borderColor = "#bfdbfe";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#ffffff";
                        e.currentTarget.style.borderColor = "#f1f5f9";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <span
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            backgroundColor: getCategoryTheme(activeCategory.slug).accent,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 500,
                            color: "#1e293b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {sub.name}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {subCount > 0 && (
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#64748b",
                              backgroundColor: "#f1f5f9",
                              padding: "2px 6px",
                              borderRadius: "10px",
                              fontWeight: 500,
                            }}
                          >
                            {subCount}
                          </span>
                        )}
                        <ChevronRight size={14} style={{ color: "#94a3b8" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================== */}
      {/* SCREEN C: SUBCATEGORY ILLUSTRATION VIEW (DEDICATED ILLUSTRATION GRID)   */}
      {/* ====================================================================== */}
      {navLevel === "subcategory" && activeCategory && activeSubcategory && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Breadcrumb Navigation: Assets / Category / Subcategory */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              color: "#64748b",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={navigateToRoot}
              style={{
                background: "none",
                border: "none",
                color: "#2563eb",
                cursor: "pointer",
                padding: 0,
                fontWeight: 600,
                fontSize: "11px",
              }}
            >
              Assets
            </button>
            <ChevronRight size={11} style={{ color: "#cbd5e1" }} />
            <button
              type="button"
              onClick={() => navigateToCategory(activeCategory.slug)}
              style={{
                background: "none",
                border: "none",
                color: "#2563eb",
                cursor: "pointer",
                padding: 0,
                fontWeight: 600,
                fontSize: "11px",
              }}
            >
              {activeCategory.name}
            </button>
            <ChevronRight size={11} style={{ color: "#cbd5e1" }} />
            <span style={{ fontWeight: 600, color: "#0f172a" }}>
              {activeSubcategory.name}
            </span>
          </div>

          {/* Subcategory Header & Back Button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: 0,
                }}
              >
                {activeSubcategory.name}
              </h3>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "2px 0 0 0" }}>
                {subcategoryAssets.length}{" "}
                {subcategoryAssets.length === 1 ? "illustration" : "illustrations"} in {activeCategory.name}
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigateToCategory(activeCategory.slug)}
              title="Return to parent category"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#475569",
                fontSize: "11px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <ArrowLeft size={12} />
              <span>Category</span>
            </button>
          </div>

          {/* Subcategory Scoped Search Input */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: "0.75rem",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder={`Search in ${activeSubcategory.name}...`}
              value={subcategorySearch}
              onChange={(e) => setSubcategorySearch(e.target.value)}
              style={{
                width: "100%",
                height: "36px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "0 2rem 0 2.25rem",
                fontSize: "0.8125rem",
                color: "#0f172a",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            {subcategorySearch.length > 0 && (
              <button
                type="button"
                onClick={() => setSubcategorySearch("")}
                style={{
                  position: "absolute",
                  right: "0.625rem",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Controls: Sorting */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 2px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Illustrations ({subcategoryAssets.length})
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "recent")}
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="name">Name (A-Z)</option>
                <option value="recent">Recent</option>
              </select>
            </div>
          </div>

          {/* Dedicated Illustration Grid (Takes full panel area) */}
          {subcategoryAssets.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "0.625rem",
                }}
              >
                {subcategoryAssets.slice(0, displayCount).map(renderIllustrationCard)}
              </div>

              {/* Incremental Loading / Load More */}
              {subcategoryAssets.length > displayCount && (
                <button
                  type="button"
                  onClick={() => setDisplayCount((prev) => prev + 24)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#f8fafc",
                    color: "#2563eb",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#eff6ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                >
                  Load More ({subcategoryAssets.length - displayCount} remaining)
                </button>
              )}
            </div>
          ) : (
            /* Subcategory Empty State */
            <div
              style={{
                padding: "2.5rem 1rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
                backgroundColor: "#f8fafc",
                borderRadius: "10px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <CategoryThumbnail slug={activeCategory.slug} size={48} />
              <div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0f172a", margin: 0 }}>
                  No illustrations uploaded yet
                </h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "4px 0 0 0", maxWidth: "220px" }}>
                  Illustrations assigned to &ldquo;{activeSubcategory.name}&rdquo; will appear here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateToCategory(activeCategory.slug)}
                style={{
                  fontSize: "11px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  backgroundColor: "#ffffff",
                  color: "#2563eb",
                  border: "1px solid #bfdbfe",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Browse other {activeCategory.name}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================== */}
      {/* GLOBAL SEARCH RESULTS VIEW                                             */}
      {/* ====================================================================== */}
      {navLevel === "search" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Back to Categories Button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              type="button"
              onClick={navigateToRoot}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "none",
                border: "none",
                color: "#2563eb",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <ArrowLeft size={13} />
              <span>Back to Categories</span>
            </button>

            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
              {globalSearchResults.length} {globalSearchResults.length === 1 ? "result" : "results"}
            </span>
          </div>

          {/* Results Grid */}
          {globalSearchResults.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "0.625rem",
                }}
              >
                {globalSearchResults.slice(0, displayCount).map(renderIllustrationCard)}
              </div>

              {globalSearchResults.length > displayCount && (
                <button
                  type="button"
                  onClick={() => setDisplayCount((prev) => prev + 24)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#f8fafc",
                    color: "#2563eb",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Load More ({globalSearchResults.length - displayCount} remaining)
                </button>
              )}
            </div>
          ) : (
            /* Empty Global Search State with Clickable Suggestions */
            <div
              style={{
                padding: "2rem 1rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
                backgroundColor: "#f8fafc",
                borderRadius: "10px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <Search size={24} style={{ color: "#94a3b8" }} />
              <div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0f172a", margin: 0 }}>
                  No illustrations found
                </h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "4px 0 0 0" }}>
                  No matches for &ldquo;{globalSearch}&rdquo; across the library.
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center" }}>
                {["antibody", "dna", "neuron", "mitochondria", "membrane", "pipette", "virus", "heart"].map(
                  (tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleGlobalSearchChange(tag)}
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        backgroundColor: "#ffffff",
                        color: "#2563eb",
                        border: "1px solid #e2e8f0",
                        cursor: "pointer",
                      }}
                    >
                      {tag}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================== */}
      {/* FAVORITES VIEW                                                         */}
      {/* ====================================================================== */}
      {navLevel === "favorites" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              type="button"
              onClick={navigateToRoot}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "none",
                border: "none",
                color: "#2563eb",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <ArrowLeft size={13} />
              <span>Back to Categories</span>
            </button>

            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
              {favoriteAssets.length} saved
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                backgroundColor: "#fef3c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#d97706",
              }}
            >
              <Star size={14} fill="#f59e0b" />
            </div>
            <div>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                Favorite Illustrations
              </h3>
              <p style={{ fontSize: "0.6875rem", color: "#64748b", margin: "2px 0 0 0" }}>
                Quick access to your starred scientific figures
              </p>
            </div>
          </div>

          {favoriteAssets.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "0.625rem",
              }}
            >
              {favoriteAssets.map(renderIllustrationCard)}
            </div>
          ) : (
            <div
              style={{
                padding: "2.5rem 1rem",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
                backgroundColor: "#f8fafc",
                borderRadius: "10px",
                border: "1px dashed #cbd5e1",
              }}
            >
              <Star size={24} style={{ color: "#f59e0b" }} />
              <div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0f172a", margin: 0 }}>
                  No favorites yet
                </h4>
                <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "4px 0 0 0", maxWidth: "220px" }}>
                  Click the star icon in the top left corner of any illustration to save it here.
                </p>
              </div>
              <button
                type="button"
                onClick={navigateToRoot}
                style={{
                  fontSize: "11px",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  backgroundColor: "#ffffff",
                  color: "#2563eb",
                  border: "1px solid #bfdbfe",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Browse categories
              </button>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================== */}
      {/* ALL ASSETS VIEW                                                        */}
      {/* ====================================================================== */}
      {navLevel === "all" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              type="button"
              onClick={navigateToRoot}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "none",
                border: "none",
                color: "#2563eb",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <ArrowLeft size={13} />
              <span>Back to Categories</span>
            </button>

            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
              {allAssetsList.length} total
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 2px",
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              All Platform Illustrations
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "recent")}
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#475569",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="name">Sort A-Z</option>
              <option value="recent">Sort Recent</option>
            </select>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "0.625rem",
            }}
          >
            {allAssetsList.slice(0, displayCount).map(renderIllustrationCard)}
          </div>

          {allAssetsList.length > displayCount && (
            <button
              type="button"
              onClick={() => setDisplayCount((prev) => prev + 24)}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
                color: "#2563eb",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Load More ({allAssetsList.length - displayCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
};

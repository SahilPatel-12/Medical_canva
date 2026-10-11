"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Upload,
  Search,
  Trash2,
  Copy,
  Check,
  Cloud,
  Database,
  Plus,
  RefreshCw,
  Image as ImageIcon,
  AlertCircle,
  X,
} from "lucide-react";
import { Asset } from "@design-platform/types";
import { CANONICAL_TAXONOMY } from "@design-platform/editor";

export default function AdminAssetManagementPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<string[]>([
    "science",
    "shapes",
    "icons",
    "illustrations",
  ]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(
    null
  );

  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [assetName, setAssetName] = useState("");
  const [formCategorySlug, setFormCategorySlug] = useState("cell-types");
  const [formSubcategorySlug, setFormSubcategorySlug] = useState("generic-cells");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [assetWidth, setAssetWidth] = useState(120);
  const [assetHeight, setAssetHeight] = useState(120);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Assets
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/assets");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAssets(json.data);
        if (json.categories && Array.isArray(json.categories)) {
          const mergedCats = Array.from(
            new Set(["science", "shapes", "icons", "illustrations", ...json.categories])
          );
          setCategories(mergedCats);
        }
      }
    } catch (err) {
      console.error("Failed to load assets:", err);
      showToast("Could not load assets from Supabase", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function loadInitial() {
      try {
        const res = await fetch("/api/assets");
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setAssets(json.data);
          if (Array.isArray(json.categories)) {
            setCategories(json.categories);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // Auto-set name from filename
      const cleanName = selectedFile.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setAssetName(cleanName);

      // Create preview
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
    }
  };

  // Submit asset upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast("Please choose a file to upload", "error");
      return;
    }

    try {
      setIsUploading(true);
      const catObj = CANONICAL_TAXONOMY.find((c) => c.slug === formCategorySlug);
      const subObj = catObj?.subcategories.find((s) => s.slug === formSubcategorySlug);

      const finalCategory = isAddingNewCat && newCategoryName.trim()
        ? newCategoryName.trim().toLowerCase()
        : catObj?.name || "Cell Types";

      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", assetName.trim() || file.name);
      formData.append("category", finalCategory);
      if (catObj) {
        formData.append("categorySlug", catObj.slug);
      }
      if (subObj) {
        formData.append("subcategorySlug", subObj.slug);
        formData.append("subcategoryId", subObj.id);
        formData.append("subcategoryName", subObj.name);
      }
      formData.append("tags", tagsInput);
      formData.append("width", String(assetWidth));
      formData.append("height", String(assetHeight));

      const res = await fetch("/api/assets", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        showToast(json.message || "Asset uploaded to Cloudflare R2 & Supabase!");
        setIsModalOpen(false);
        resetForm();
        await fetchAssets();
      } else {
        showToast(json.error || "Failed to upload asset", "error");
      }
    } catch (err) {
      console.error("Upload error:", err);
      showToast("Upload failed. Check Cloudflare R2 credentials.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setAssetName("");
    setFormCategorySlug("cell-types");
    setFormSubcategorySlug("generic-cells");
    setTagsInput("");
    setIsAddingNewCat(false);
    setNewCategoryName("");
    setAssetWidth(120);
    setAssetHeight(120);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Delete Asset
  const handleDeleteAsset = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from Cloudflare R2 and Supabase?`)) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/assets/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        showToast(`"${name}" removed from Cloudflare R2 and database.`);
        setAssets((prev) => prev.filter((a) => a.id !== id));
      } else {
        showToast(json.error || "Failed to delete asset", "error");
      }
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  };

  // Seed Built-in Icons to Cloudflare R2
  const handleSeedBuiltin = async () => {
    if (
      !confirm(
        "Upload all built-in medical & science icons (DNA, cells, flask, microscope, virus, etc.) directly into your Cloudflare R2 bucket and register in Supabase?"
      )
    ) {
      return;
    }

    try {
      setIsSeeding(true);
      const res = await fetch("/api/assets/seed", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || "Built-in assets synchronized to Cloudflare R2!");
        await fetchAssets();
      } else {
        showToast(json.error || "Sync failed", "error");
      }
    } catch (err) {
      console.error("Seed error:", err);
      showToast("Failed to sync built-in assets", "error");
    } finally {
      setIsSeeding(false);
    }
  };

  // Copy public URL
  const copyPublicUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast("Cloudflare R2 Public URL copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (selectedCategory !== "all" && asset.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = asset.name.toLowerCase().includes(q);
        const matchesTag = asset.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesCategory = asset.category.toLowerCase().includes(q);
        return matchesName || matchesTag || matchesCategory;
      }
      return true;
    });
  }, [assets, selectedCategory, searchQuery]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "#f4f4f5" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            backgroundColor: toastMessage.type === "success" ? "#10b981" : "#ef4444",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            fontSize: "14px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          {toastMessage.type === "success" ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <header
        style={{
          borderBottom: "1px solid #27272a",
          backgroundColor: "#121215",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: "18px",
            }}
          >
            MC
          </div>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              Medical Canva <span style={{ color: "#3b82f6" }}>Admin Studio</span>
            </h1>
            <p style={{ fontSize: "0.8125rem", color: "#a1a1aa", margin: 0 }}>
              Cloudflare R2 Bucket & Supabase Asset Manager
            </p>
          </div>
        </div>

        {/* Integration Status Pills & Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Cloudflare R2 Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              color: "#d4d4d8",
            }}
          >
            <Cloud size={14} color="#f97316" />
            <span>R2: <strong>medicalcanvas</strong></span>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#10b981",
                boxShadow: "0 0 8px #10b981",
              }}
            />
          </div>

          {/* Supabase Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              color: "#d4d4d8",
            }}
          >
            <Database size={14} color="#10b981" />
            <span>Supabase: <strong>Live</strong></span>
          </div>

          {/* Seed Button */}
          <button
            type="button"
            onClick={handleSeedBuiltin}
            disabled={isSeeding}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#27272a",
              border: "1px solid #3f3f46",
              color: "#f4f4f5",
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isSeeding ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={14} className={isSeeding ? "animate-spin" : ""} />
            <span>{isSeeding ? "Syncing..." : "Sync Built-in Icons to R2"}</span>
          </button>

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "#3b82f6",
              border: "none",
              color: "#ffffff",
              padding: "7px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(59, 130, 246, 0.3)",
              transition: "all 0.15s ease",
            }}
          >
            <Plus size={16} />
            <span>Upload Asset</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem" }}>
        {/* Metric Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#121215",
              border: "1px solid #27272a",
              borderRadius: "12px",
              padding: "1.25rem",
            }}
          >
            <div style={{ color: "#a1a1aa", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
              Total Assets in R2
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#f4f4f5" }}>
              {assets.length}
            </div>
            <div style={{ fontSize: "12px", color: "#10b981", marginTop: "4px" }}>
              Managed across Cloudflare CDN
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#121215",
              border: "1px solid #27272a",
              borderRadius: "12px",
              padding: "1.25rem",
            }}
          >
            <div style={{ color: "#a1a1aa", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
              Asset Categories
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#3b82f6" }}>
              {categories.length}
            </div>
            <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "4px" }}>
              Science, Bio, Shapes, Icons, etc.
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#121215",
              border: "1px solid #27272a",
              borderRadius: "12px",
              padding: "1.25rem",
            }}
          >
            <div style={{ color: "#a1a1aa", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
              Cloudflare Public CDN
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#f97316",
                marginTop: "6px",
                wordBreak: "break-all",
              }}
            >
              pub-229e7b7a2671434a8fb7224ae9b93260.r2.dev
            </div>
            <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "6px" }}>
              High-speed worldwide distribution
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {/* Category Tabs */}
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: selectedCategory === "all" ? 600 : 500,
                backgroundColor: selectedCategory === "all" ? "#3b82f6" : "#18181b",
                color: selectedCategory === "all" ? "#ffffff" : "#a1a1aa",
                border: `1px solid ${selectedCategory === "all" ? "#2563eb" : "#27272a"}`,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              All Assets ({assets.length})
            </button>
            {categories.map((cat) => {
              const count = assets.filter((a) => a.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: isSelected ? 600 : 500,
                    backgroundColor: isSelected ? "#3b82f6" : "#18181b",
                    color: isSelected ? "#ffffff" : "#a1a1aa",
                    border: `1px solid ${isSelected ? "#2563eb" : "#27272a"}`,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div style={{ position: "relative", minWidth: "280px" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#71717a",
              }}
            />
            <input
              type="text"
              placeholder="Search assets by name or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                backgroundColor: "#121215",
                border: "1px solid #27272a",
                borderRadius: "8px",
                color: "#f4f4f5",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Assets Grid */}
        {loading ? (
          <div
            style={{
              padding: "4rem",
              textAlign: "center",
              color: "#a1a1aa",
              backgroundColor: "#121215",
              borderRadius: "12px",
              border: "1px solid #27272a",
            }}
          >
            <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <p>Loading assets from Supabase & Cloudflare R2...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div
            style={{
              padding: "4rem 2rem",
              textAlign: "center",
              backgroundColor: "#121215",
              borderRadius: "12px",
              border: "1px solid #27272a",
            }}
          >
            <ImageIcon size={48} color="#71717a" style={{ margin: "0 auto 1rem" }} />
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              No assets found
            </h3>
            <p style={{ color: "#a1a1aa", fontSize: "13px", maxWidth: "450px", margin: "0 auto 1.5rem" }}>
              {assets.length === 0
                ? "You haven't added any assets yet. You can click 'Sync Built-in Icons to R2' to automatically upload all science & cell icons, or upload your own files."
                : "No assets match your search and category filter."}
            </p>
            {assets.length === 0 && (
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={handleSeedBuiltin}
                  disabled={isSeeding}
                  style={{
                    backgroundColor: "#27272a",
                    border: "1px solid #3f3f46",
                    color: "#f4f4f5",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Sync Built-in Icons</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  style={{
                    backgroundColor: "#3b82f6",
                    border: "none",
                    color: "#fff",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Plus size={16} />
                  <span>Upload Asset</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {filteredAssets.map((asset) => {
              const isSvgSource =
                asset.source &&
                asset.source.startsWith("<svg") &&
                !asset.source.startsWith("http");

              return (
                <div
                  key={asset.id}
                  style={{
                    backgroundColor: "#121215",
                    border: "1px solid #27272a",
                    borderRadius: "10px",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    transition: "transform 0.15s ease, border-color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#27272a";
                  }}
                >
                  {/* Preview Container */}
                  <div
                    style={{
                      height: "140px",
                      backgroundColor: "#18181b",
                      borderBottom: "1px solid #27272a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1rem",
                      position: "relative",
                    }}
                  >
                    {isSvgSource ? (
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        dangerouslySetInnerHTML={{ __html: asset.source }}
                      />
                    ) : asset.url || asset.thumbnail ? (
                      <img
                        src={asset.url || asset.thumbnail}
                        alt={asset.name}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <ImageIcon size={32} color="#52525b" />
                    )}

                    {/* Category Tag Badge */}
                    <span
                      style={{
                        position: "absolute",
                        top: "8px",
                        left: "8px",
                        backgroundColor: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(4px)",
                        border: "1px solid #3f3f46",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        color: "#93c5fd",
                      }}
                    >
                      {asset.subcategoryName ? `${asset.category} • ${asset.subcategoryName}` : asset.category}
                    </span>

                    {/* Type Badge */}
                    <span
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        backgroundColor: "#27272a",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        fontSize: "10px",
                        fontWeight: 500,
                        color: "#a1a1aa",
                      }}
                    >
                      {asset.type.toUpperCase()}
                    </span>
                  </div>

                  {/* Info Details */}
                  <div style={{ padding: "1rem", flex: 1, display: "flex", flexDirection: "column" }}>
                    <h4
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#f4f4f5",
                        margin: "0 0 6px 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={asset.name}
                    >
                      {asset.name}
                    </h4>

                    {/* Tags */}
                    {asset.tags && asset.tags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          flexWrap: "wrap",
                          marginBottom: "12px",
                        }}
                      >
                        {asset.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: "10px",
                              backgroundColor: "#18181b",
                              border: "1px solid #27272a",
                              color: "#a1a1aa",
                              padding: "1px 5px",
                              borderRadius: "4px",
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div
                      style={{
                        marginTop: "auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "8px",
                        borderTop: "1px solid #1f1f23",
                      }}
                    >
                      {/* Copy URL */}
                      {asset.url ? (
                        <button
                          type="button"
                          onClick={() => copyPublicUrl(asset.id, asset.url!)}
                          title="Copy Cloudflare R2 Public URL"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: copiedId === asset.id ? "#10b981" : "#a1a1aa",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            padding: "4px",
                          }}
                        >
                          {copiedId === asset.id ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedId === asset.id ? "Copied" : "Copy R2 URL"}</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#52525b" }}>Inline SVG</span>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(asset.id, asset.name)}
                        disabled={deletingId === asset.id}
                        title="Delete from R2 and Supabase"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          padding: "4px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Upload Asset Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: "#121215",
              border: "1px solid #27272a",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "540px",
              padding: "1.75rem",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Cloud size={20} color="#3b82f6" />
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
                  Upload Asset to Cloudflare R2
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#a1a1aa",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* File Dropzone */}
              <div
                style={{
                  border: "2px dashed #27272a",
                  borderRadius: "10px",
                  padding: "1.5rem",
                  textAlign: "center",
                  backgroundColor: "#18181b",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease",
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const droppedFile = e.dataTransfer.files[0];
                    setFile(droppedFile);
                    setAssetName(
                      droppedFile.name
                        .replace(/\.[^/.]+$/, "")
                        .replace(/[-_]+/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())
                    );
                    setPreviewUrl(URL.createObjectURL(droppedFile));
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg,.webp,.gif"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />

                {previewUrl ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "80px",
                        height: "80px",
                        borderRadius: "8px",
                        backgroundColor: "#121215",
                        border: "1px solid #3f3f46",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        padding: "4px",
                      }}
                    >
                      <img
                        src={previewUrl}
                        alt="Preview"
                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                      />
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#93c5fd" }}>
                      {file?.name}
                    </span>
                    <span style={{ fontSize: "11px", color: "#a1a1aa" }}>
                      {((file?.size || 0) / 1024).toFixed(1)} KB • Click or drop to replace
                    </span>
                  </div>
                ) : (
                  <div>
                    <Upload size={32} color="#71717a" style={{ margin: "0 auto 8px" }} />
                    <p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 4px" }}>
                      Click to browse or drag & drop asset
                    </p>
                    <p style={{ fontSize: "11px", color: "#71717a", margin: 0 }}>
                      Supports SVG, PNG, JPG, WebP, GIF (Max 15MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Asset Name */}
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
                  Asset Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Red Blood Cell, Microscope Icon"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                    color: "#f4f4f5",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Category & Subcategory Selectors */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
                    Canonical Category (15)
                  </label>
                  <select
                    value={formCategorySlug}
                    onChange={(e) => {
                      const newCatSlug = e.target.value;
                      setFormCategorySlug(newCatSlug);
                      const cat = CANONICAL_TAXONOMY.find((c) => c.slug === newCatSlug);
                      if (cat && cat.subcategories.length > 0) {
                        setFormSubcategorySlug(cat.subcategories[0].slug);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "6px",
                      color: "#f4f4f5",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  >
                    {CANONICAL_TAXONOMY.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
                    Subcategory (87)
                  </label>
                  <select
                    value={formSubcategorySlug}
                    onChange={(e) => setFormSubcategorySlug(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "6px",
                      color: "#f4f4f5",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  >
                    {(
                      CANONICAL_TAXONOMY.find((c) => c.slug === formCategorySlug)?.subcategories || []
                    ).map((sub) => (
                      <option key={sub.id} value={sub.slug}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
                  Search Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="biology, cell, membrane, lab"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                    color: "#f4f4f5",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Default Canvas Dimensions */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
                    Default Width (px)
                  </label>
                  <input
                    type="number"
                    value={assetWidth}
                    onChange={(e) => setAssetWidth(Number(e.target.value))}
                    min={20}
                    max={2000}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "6px",
                      color: "#f4f4f5",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
                    Default Height (px)
                  </label>
                  <input
                    type="number"
                    value={assetHeight}
                    onChange={(e) => setAssetHeight(Number(e.target.value))}
                    min={20}
                    max={2000}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "6px",
                      color: "#f4f4f5",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: "9px 16px",
                    backgroundColor: "#27272a",
                    border: "none",
                    borderRadius: "8px",
                    color: "#d4d4d8",
                    fontSize: "13px",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !file}
                  style={{
                    flex: 2,
                    padding: "9px 16px",
                    backgroundColor: "#3b82f6",
                    border: "none",
                    borderRadius: "8px",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: isUploading || !file ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 10px rgba(59, 130, 246, 0.3)",
                  }}
                >
                  {isUploading ? "Uploading to Cloudflare R2..." : "Upload & Save Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

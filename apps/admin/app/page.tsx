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
  Archive,
  ArchiveRestore,
  ShieldCheck,
  Key,
  FileUp,
  AlertTriangle,
} from "lucide-react";
import { Asset, AssetStatus } from "@design-platform/types";
import { CANONICAL_TAXONOMY, getCategoryBySlug } from "@design-platform/editor";
import { ThemeToggle } from "@design-platform/ui";

interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  status: "pending" | "validating" | "uploading" | "success" | "duplicate" | "error";
  error?: string;
  duplicateInfo?: { message: string; existingAsset?: Asset };
  progress?: number;
}

export default function AdminAssetManagementPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminKey, setAdminKey] = useState<string>("mc_admin_dev_secret_2026");
  const [isEditingKey, setIsEditingKey] = useState(false);

  // Filters
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("all");
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | AssetStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // UI state
  const [isSeeding, setIsSeeding] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [replaceTargetAsset, setReplaceTargetAsset] = useState<Asset | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  // Delete & Confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [conflictAsset, setConflictAsset] = useState<{
    id: string;
    name: string;
    designCount: number;
    designNames: string[];
    message: string;
  } | null>(null);

  // Toast & Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "warning" } | null>(
    null
  );

  // Upload Batch Form state
  const [uploadCategorySlug, setUploadCategorySlug] = useState("cell-types");
  const [uploadSubcategorySlug, setUploadSubcategorySlug] = useState("generic-cells");
  const [uploadStatus, setUploadStatus] = useState<AssetStatus>("published");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: "success" | "error" | "warning" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Load Admin Key from localStorage if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("mc_admin_api_key");
      if (savedKey) {
        setAdminKey(savedKey);
      }
    }
  }, []);

  const handleSaveAdminKey = (newKey: string) => {
    setAdminKey(newKey);
    if (typeof window !== "undefined") {
      localStorage.setItem("mc_admin_api_key", newKey);
    }
    setIsEditingKey(false);
    showToast("Admin credentials updated");
  };

  const getAuthHeaders = (): Record<string, string> => {
    return {
      "x-admin-key": adminKey,
    };
  };

  // Fetch Assets from Admin API
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("status", "all");
      const res = await fetch(`/api/assets?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAssets(json.data);
      } else {
        showToast(json.error || "Failed to load assets", "error");
      }
    } catch (err) {
      console.error("Failed to load assets:", err);
      showToast("Could not load assets from backend", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [adminKey]);

  // Derived available subcategories for filtering
  const currentCategoryObj = useMemo(() => {
    if (selectedCategorySlug === "all") return null;
    return getCategoryBySlug(selectedCategorySlug);
  }, [selectedCategorySlug]);

  const uploadCategoryObj = useMemo(() => {
    return getCategoryBySlug(uploadCategorySlug) || CANONICAL_TAXONOMY[0];
  }, [uploadCategorySlug]);

  // Filtered Assets list
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      // Status filter
      if (selectedStatus !== "all") {
        const assetStat = asset.status || "published";
        if (assetStat !== selectedStatus) return false;
      }

      // Category filter
      if (selectedCategorySlug !== "all") {
        const catMatch =
          asset.categorySlug === selectedCategorySlug ||
          asset.category?.toLowerCase() === selectedCategorySlug.toLowerCase() ||
          asset.tags?.includes(`cat:${selectedCategorySlug}`);
        if (!catMatch) return false;
      }

      // Subcategory filter
      if (selectedSubcategorySlug !== "all") {
        const subMatch =
          asset.subcategorySlug === selectedSubcategorySlug ||
          asset.subcategoryId === selectedSubcategorySlug ||
          asset.tags?.includes(`subcat:${selectedSubcategorySlug}`);
        if (!subMatch) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = asset.name.toLowerCase().includes(q);
        const matchesTag = asset.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesCat = asset.category?.toLowerCase().includes(q);
        const matchesSub = asset.subcategoryName?.toLowerCase().includes(q);
        return matchesName || matchesTag || matchesCat || matchesSub;
      }

      return true;
    });
  }, [assets, selectedCategorySlug, selectedSubcategorySlug, selectedStatus, searchQuery]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = assets.length;
    let published = 0;
    let draft = 0;
    let archived = 0;

    for (const a of assets) {
      const s = a.status || "published";
      if (s === "published") published++;
      else if (s === "draft") draft++;
      else if (s === "archived") archived++;
    }

    return { total, published, draft, archived };
  }, [assets]);

  // Copy Public URL
  const copyPublicUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast("Cloudflare R2 Public URL copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Toggle Archive / Restore
  const handleToggleStatus = async (asset: Asset, newStatus: AssetStatus) => {
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(
          `Asset '${asset.name}' is now ${newStatus.toUpperCase()}`,
          newStatus === "published" ? "success" : "warning"
        );
        setAssets((prev) =>
          prev.map((a) => (a.id === asset.id ? { ...a, status: newStatus } : a))
        );
      } else {
        showToast(json.error || `Failed to update status to ${newStatus}`, "error");
      }
    } catch (err) {
      console.error("Status update error:", err);
      showToast("Error updating asset status", "error");
    }
  };

  // Delete Asset handler with Design Conflict support
  const handleDeleteAsset = async (id: string, name: string, force: boolean = false) => {
    try {
      setDeletingId(id);
      const url = `/api/assets/${id}${force ? "?force=true" : ""}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const json = await res.json();

      if (res.status === 409 && json.referenced) {
        // Design conflict
        setConflictAsset({
          id,
          name,
          designCount: json.designCount || 1,
          designNames: json.designNames || [],
          message: json.message,
        });
        return;
      }

      if (json.success) {
        showToast(`"${name}" successfully deleted from Cloudflare R2 and Supabase.`);
        setAssets((prev) => prev.filter((a) => a.id !== id));
        setConflictAsset(null);
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

  // Replace Asset handler
  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replaceTargetAsset || !replaceFile) {
      showToast("Please choose a replacement file", "error");
      return;
    }

    try {
      setIsReplacing(true);
      const formData = new FormData();
      formData.append("file", replaceFile);

      const res = await fetch(`/api/assets/${replaceTargetAsset.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        showToast(json.message || `Asset '${replaceTargetAsset.name}' replaced successfully!`);
        setIsReplaceModalOpen(false);
        setReplaceTargetAsset(null);
        setReplaceFile(null);
        await fetchAssets();
      } else {
        showToast(json.error || "Failed to replace asset", "error");
      }
    } catch (err) {
      console.error("Replace error:", err);
      showToast("Asset replacement failed", "error");
    } finally {
      setIsReplacing(false);
    }
  };

  // Multi-file Queue Selection
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newItems: UploadQueueItem[] = files.map((f) => ({
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        file: f,
        name: f.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        status: "pending",
      }));
      setUploadQueue((prev) => [...prev, ...newItems]);
    }
  };

  // Upload Batch Queue
  const processUploadItem = async (item: UploadQueueItem, allowDuplicate: boolean = false) => {
    setUploadQueue((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: "uploading", error: undefined } : i))
    );

    try {
      const catObj = CANONICAL_TAXONOMY.find((c) => c.slug === uploadCategorySlug);
      const subObj = catObj?.subcategories.find((s) => s.slug === uploadSubcategorySlug);

      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("name", item.name);
      formData.append("category", catObj?.name || "Cell Types");
      formData.append("categorySlug", uploadCategorySlug);
      if (subObj) {
        formData.append("subcategorySlug", subObj.slug);
        formData.append("subcategoryId", subObj.id);
        formData.append("subcategoryName", subObj.name);
      }
      formData.append("status", uploadStatus);
      formData.append("tags", uploadTags);
      if (allowDuplicate) {
        formData.append("allowDuplicate", "true");
      }

      const res = await fetch("/api/assets", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      const json = await res.json();
      if (res.status === 409 && json.duplicate) {
        setUploadQueue((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: "duplicate",
                  duplicateInfo: {
                    message: json.message,
                    existingAsset: json.existingAsset,
                  },
                }
              : i
          )
        );
        return false;
      }

      if (json.success) {
        setUploadQueue((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "success" } : i))
        );
        return true;
      } else {
        setUploadQueue((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "error", error: json.error } : i))
        );
        return false;
      }
    } catch (err) {
      setUploadQueue((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: "error", error: (err as Error).message || "Upload network failure" }
            : i
        )
      );
      return false;
    }
  };

  const handleStartBatchUpload = async () => {
    setIsProcessingQueue(true);
    let successCount = 0;

    for (const item of uploadQueue) {
      if (item.status === "pending" || item.status === "error") {
        const ok = await processUploadItem(item);
        if (ok) successCount++;
      }
    }

    setIsProcessingQueue(false);
    if (successCount > 0) {
      showToast(`Successfully uploaded ${successCount} asset(s) to R2 and Supabase!`);
      await fetchAssets();
    }
  };

  // Seed Built-in Icons to Cloudflare R2
  const handleSeedBuiltin = async () => {
    if (
      !confirm(
        "Upload all built-in scientific illustrations (DNA, cells, flask, microscope, virus, etc.) directly into Cloudflare R2 bucket and register in Supabase?"
      )
    ) {
      return;
    }

    try {
      setIsSeeding(true);
      const res = await fetch("/api/assets/seed", {
        method: "POST",
        headers: getAuthHeaders(),
      });
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

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#09090b", color: "#f4f4f5", fontFamily: "sans-serif" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            backgroundColor:
              toastMessage.type === "success"
                ? "#10b981"
                : toastMessage.type === "warning"
                ? "#f59e0b"
                : "#ef4444",
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
          {toastMessage.type === "success" ? (
            <Check size={18} />
          ) : toastMessage.type === "warning" ? (
            <AlertTriangle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border, #27272a)",
          backgroundColor: "var(--surface, #121215)",
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
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em", color: "var(--foreground, #ffffff)" }}>
              Medical Canva <span style={{ color: "#3b82f6" }}>Admin Asset Studio</span>
            </h1>
            <p style={{ fontSize: "0.8125rem", color: "var(--foreground-muted, #a1a1aa)", margin: 0 }}>
              Cloudflare R2 Binary Storage & Supabase Production Metadata Manager
            </p>
          </div>
        </div>

        {/* Integration Status Pills & Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Admin Auth Status */}
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
            <ShieldCheck size={14} color="#10b981" />
            <span>Admin Guard: <strong>Active</strong></span>
            <button
              type="button"
              onClick={() => setIsEditingKey(!isEditingKey)}
              title="Edit Admin API Key"
              style={{
                background: "transparent",
                border: "none",
                color: "#71717a",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
              }}
            >
              <Key size={12} />
            </button>
          </div>

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

          {/* Light / Dark Mode Toggle */}
          <ThemeToggle size="sm" />

          {/* Seed Button */}
          <button
            type="button"
            onClick={handleSeedBuiltin}
            disabled={isSeeding}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backgroundColor: "var(--surface-muted, #27272a)",
              border: "1px solid var(--border-strong, #3f3f46)",
              color: "var(--foreground, #f4f4f5)",
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isSeeding ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={14} className={isSeeding ? "animate-spin" : ""} />
            <span>{isSeeding ? "Syncing..." : "Sync Built-in"}</span>
          </button>

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
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
            <span>Upload Assets</span>
          </button>
        </div>
      </header>

      {/* Admin Key Editor Bar */}
      {isEditingKey && (
        <div
          style={{
            backgroundColor: "#18181b",
            borderBottom: "1px solid #27272a",
            padding: "8px 2rem",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "13px",
          }}
        >
          <span style={{ color: "#a1a1aa" }}>Admin API Secret Key:</span>
          <input
            type="password"
            defaultValue={adminKey}
            placeholder="Enter ADMIN_API_SECRET..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveAdminKey((e.target as HTMLInputElement).value);
              }
            }}
            id="admin-secret-input"
            style={{
              backgroundColor: "#09090b",
              border: "1px solid #3f3f46",
              color: "#f4f4f5",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              width: "260px",
            }}
          />
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("admin-secret-input") as HTMLInputElement;
              if (el) handleSaveAdminKey(el.value);
            }}
            style={{
              backgroundColor: "#3b82f6",
              color: "#fff",
              border: "none",
              padding: "4px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Save Key
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem" }}>
        {/* Metric Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--surface, #121215)",
              border: "1px solid var(--border, #27272a)",
              borderRadius: "12px",
              padding: "1.25rem",
            }}
          >
            <div style={{ color: "var(--foreground-muted, #a1a1aa)", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
              Total Assets in R2
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--foreground, #f4f4f5)" }}>
              {metrics.total}
            </div>
            <div style={{ fontSize: "12px", color: "#10b981", marginTop: "4px" }}>
              Across 15 Canonical Categories
            </div>
          </div>

          <div
            style={{
              backgroundColor: "var(--surface, #121215)",
              border: "1px solid var(--border, #27272a)",
              borderRadius: "12px",
              padding: "1.25rem",
            }}
          >
            <div style={{ color: "#a1a1aa", fontSize: "12px", fontWeight: 500, marginBottom: "4px" }}>
              Published (Customer Visible)
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#10b981" }}>
              {metrics.published}
            </div>
            <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "4px" }}>
              Live in Editor Asset Library
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
              Drafts (In Review)
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#f59e0b" }}>
              {metrics.draft}
            </div>
            <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "4px" }}>
              Hidden from Customer Discovery
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
              Archived (Preserved)
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: "#8b5cf6" }}>
              {metrics.archived}
            </div>
            <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "4px" }}>
              Preserves Legacy Canvas Renders
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            backgroundColor: "var(--surface, #121215)",
            border: "1px solid var(--border, #27272a)",
            borderRadius: "12px",
            padding: "1rem",
            marginBottom: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            {/* Status Tabs */}
            <div style={{ display: "flex", gap: "6px" }}>
              {(["all", "published", "draft", "archived"] as const).map((stat) => (
                <button
                  key={stat}
                  type="button"
                  onClick={() => setSelectedStatus(stat)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: selectedStatus === stat ? 600 : 500,
                    backgroundColor: selectedStatus === stat ? "#3b82f6" : "#18181b",
                    color: selectedStatus === stat ? "#ffffff" : "#a1a1aa",
                    border: `1px solid ${selectedStatus === stat ? "#2563eb" : "#27272a"}`,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {stat === "all" ? `All (${assets.length})` : stat}
                </button>
              ))}
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
                  backgroundColor: "var(--input-bg, var(--surface, #09090b))",
                  border: "1px solid var(--border, #27272a)",
                  borderRadius: "8px",
                  color: "var(--foreground, #f4f4f5)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Canonical Category Selector Pills */}
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
            <button
              type="button"
              onClick={() => {
                setSelectedCategorySlug("all");
                setSelectedSubcategorySlug("all");
              }}
              style={{
                padding: "5px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: selectedCategorySlug === "all" ? 600 : 500,
                backgroundColor: selectedCategorySlug === "all" ? "#2563eb" : "#18181b",
                color: selectedCategorySlug === "all" ? "#ffffff" : "#a1a1aa",
                border: `1px solid ${selectedCategorySlug === "all" ? "#1d4ed8" : "#27272a"}`,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              All Categories
            </button>
            {CANONICAL_TAXONOMY.map((cat) => {
              const isSelected = selectedCategorySlug === cat.slug;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategorySlug(cat.slug);
                    setSelectedSubcategorySlug("all");
                  }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: isSelected ? 600 : 500,
                    backgroundColor: isSelected ? "#2563eb" : "#18181b",
                    color: isSelected ? "#ffffff" : "#a1a1aa",
                    border: `1px solid ${isSelected ? "#1d4ed8" : "#27272a"}`,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Subcategory Pills (if a category is selected) */}
          {currentCategoryObj && (
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", borderTop: "1px solid #1f1f23", paddingTop: "8px" }}>
              <span style={{ fontSize: "11px", color: "#71717a", alignSelf: "center", marginRight: "4px" }}>
                Subcategories:
              </span>
              <button
                type="button"
                onClick={() => setSelectedSubcategorySlug("all")}
                style={{
                  padding: "3px 10px",
                  borderRadius: "14px",
                  fontSize: "11px",
                  backgroundColor: selectedSubcategorySlug === "all" ? "#3b82f6" : "transparent",
                  color: selectedSubcategorySlug === "all" ? "#fff" : "#a1a1aa",
                  border: "1px solid #27272a",
                  cursor: "pointer",
                }}
              >
                All
              </button>
              {currentCategoryObj.subcategories.map((sub) => {
                const isSelected = selectedSubcategorySlug === sub.slug;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubcategorySlug(sub.slug)}
                    style={{
                      padding: "3px 10px",
                      borderRadius: "14px",
                      fontSize: "11px",
                      backgroundColor: isSelected ? "#3b82f6" : "transparent",
                      color: isSelected ? "#fff" : "#a1a1aa",
                      border: "1px solid #27272a",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Conflict Warning Modal */}
        {conflictAsset && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid #ef4444",
              borderRadius: "10px",
              padding: "1rem 1.5rem",
              marginBottom: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f87171", fontWeight: 600, fontSize: "14px" }}>
                <AlertTriangle size={18} />
                <span>Active Design Dependency Conflict</span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#d4d4d8" }}>
                Asset &ldquo;{conflictAsset.name}&rdquo; is referenced in {conflictAsset.designCount} active design(s):{" "}
                <strong>{conflictAsset.designNames.join(", ")}</strong>. Permanent deletion would break these canvas renders.
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  const target = assets.find((a) => a.id === conflictAsset.id);
                  if (target) handleToggleStatus(target, "archived");
                  setConflictAsset(null);
                }}
                style={{
                  backgroundColor: "#8b5cf6",
                  color: "#fff",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Archive Instead (Safe)
              </button>
              <button
                type="button"
                onClick={() => handleDeleteAsset(conflictAsset.id, conflictAsset.name, true)}
                style={{
                  backgroundColor: "#ef4444",
                  color: "#fff",
                  border: "none",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Force Delete Permanently
              </button>
              <button
                type="button"
                onClick={() => setConflictAsset(null)}
                style={{
                  backgroundColor: "transparent",
                  color: "#a1a1aa",
                  border: "1px solid #3f3f46",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Asset Cards Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "#71717a" }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <p>Loading assets from Supabase PostgreSQL & Cloudflare R2...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              backgroundColor: "#121215",
              borderRadius: "12px",
              border: "1px solid #27272a",
            }}
          >
            <ImageIcon size={48} color="#3f3f46" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 6px 0" }}>
              No assets match the current filters
            </h3>
            <p style={{ color: "#a1a1aa", fontSize: "14px", margin: 0 }}>
              Adjust your status, category, or search filters, or click &ldquo;Upload Assets&rdquo; above.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {filteredAssets.map((asset) => {
              const assetStatus = asset.status || "published";
              return (
                <div
                  key={asset.id}
                  style={{
                    backgroundColor: "var(--card-bg, var(--surface, #121215))",
                    border: "1px solid var(--border, #27272a)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    transition: "transform 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  {/* Preview Container */}
                  <div
                    style={{
                      height: "160px",
                      backgroundColor: "var(--surface-muted, #18181b)",
                      borderBottom: "1px solid var(--border, #27272a)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "16px",
                      position: "relative",
                    }}
                  >
                    {/* Status Badge */}
                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        fontSize: "10px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "2px 7px",
                        borderRadius: "4px",
                        backgroundColor:
                          assetStatus === "published"
                            ? "rgba(16, 185, 129, 0.2)"
                            : assetStatus === "draft"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(139, 92, 246, 0.2)",
                        color:
                          assetStatus === "published"
                            ? "#10b981"
                            : assetStatus === "draft"
                            ? "#f59e0b"
                            : "#a78bfa",
                        border: `1px solid ${
                          assetStatus === "published"
                            ? "rgba(16, 185, 129, 0.4)"
                            : assetStatus === "draft"
                            ? "rgba(245, 158, 11, 0.4)"
                            : "rgba(139, 92, 246, 0.4)"
                        }`,
                      }}
                    >
                      {assetStatus}
                    </div>

                    {/* Version Badge */}
                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        fontSize: "10px",
                        fontWeight: 600,
                        backgroundColor: "#27272a",
                        color: "#a1a1aa",
                        padding: "2px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      v{asset.version || 1}
                    </div>

                    {/* Render Image or SVG */}
                    {asset.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={asset.url}
                        alt={asset.name}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon size={40} color="#52525b" />
                    )}
                  </div>

                  {/* Asset Info */}
                  <div style={{ padding: "1rem", display: "flex", flexDirection: "column", flexGrow: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#3b82f6",
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {asset.subcategoryName || asset.category}
                      </span>
                      <span style={{ fontSize: "11px", color: "#71717a" }}>
                        {asset.sizeBytes ? `${(asset.sizeBytes / 1024).toFixed(1)} KB` : "SVG"}
                      </span>
                    </div>

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

                    {/* Taxonomy badges */}
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
                      {asset.categorySlug && (
                        <span style={{ fontSize: "10px", backgroundColor: "#18181b", border: "1px solid #27272a", color: "#a1a1aa", padding: "1px 5px", borderRadius: "4px" }}>
                          cat:{asset.categorySlug}
                        </span>
                      )}
                      {asset.subcategorySlug && (
                        <span style={{ fontSize: "10px", backgroundColor: "#18181b", border: "1px solid #27272a", color: "#a1a1aa", padding: "1px 5px", borderRadius: "4px" }}>
                          sub:{asset.subcategorySlug}
                        </span>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div
                      style={{
                        marginTop: "auto",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "8px",
                        borderTop: "1px solid #1f1f23",
                        gap: "6px",
                      }}
                    >
                      {/* Copy URL */}
                      <button
                        type="button"
                        onClick={() => copyPublicUrl(asset.id, asset.url!)}
                        title="Copy Cloudflare R2 Public CDN URL"
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
                        <span>{copiedId === asset.id ? "Copied" : "Copy"}</span>
                      </button>

                      {/* Replace Asset */}
                      <button
                        type="button"
                        onClick={() => {
                          setReplaceTargetAsset(asset);
                          setReplaceFile(null);
                          setIsReplaceModalOpen(true);
                        }}
                        title="Replace file (preserves ID, bumps version)"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#3b82f6",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          padding: "4px",
                        }}
                      >
                        <RefreshCw size={13} />
                        <span>Replace</span>
                      </button>

                      {/* Archive / Restore Button */}
                      {assetStatus === "archived" ? (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(asset, "published")}
                          title="Restore to Published"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#10b981",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "11px",
                            padding: "4px",
                          }}
                        >
                          <ArchiveRestore size={13} />
                          <span>Restore</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(asset, "archived")}
                          title="Archive asset (removes from customer discovery but keeps designs intact)"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#a78bfa",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "11px",
                            padding: "4px",
                          }}
                        >
                          <Archive size={13} />
                          <span>Archive</span>
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(asset.id, asset.name)}
                        disabled={deletingId === asset.id}
                        title="Delete permanently (verifies design dependencies)"
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
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Multi-File Upload Modal */}
      {isUploadModalOpen && (
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
            if (e.target === e.currentTarget && !isProcessingQueue) setIsUploadModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: "#121215",
              border: "1px solid #27272a",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.75rem",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Cloud size={20} color="#3b82f6" />
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
                  Upload Scientific Assets to R2 & Supabase
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isProcessingQueue}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#71717a",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Taxonomy Assignment */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
                  Canonical Category *
                </label>
                <select
                  value={uploadCategorySlug}
                  onChange={(e) => {
                    setUploadCategorySlug(e.target.value);
                    const cat = getCategoryBySlug(e.target.value);
                    if (cat && cat.subcategories.length > 0) {
                      setUploadSubcategorySlug(cat.subcategories[0].slug);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                    color: "#f4f4f5",
                    fontSize: "12px",
                  }}
                >
                  {CANONICAL_TAXONOMY.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
                  Subcategory *
                </label>
                <select
                  value={uploadSubcategorySlug}
                  onChange={(e) => setUploadSubcategorySlug(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                    color: "#f4f4f5",
                    fontSize: "12px",
                  }}
                >
                  {uploadCategoryObj.subcategories.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lifecycle Status & Tags */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
                  Initial Status
                </label>
                <select
                  value={uploadStatus}
                  onChange={(e) => setUploadStatus(e.target.value as AssetStatus)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                    color: "#f4f4f5",
                    fontSize: "12px",
                  }}
                >
                  <option value="published">Published (Live to Customers)</option>
                  <option value="draft">Draft (Admin Only)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#a1a1aa", marginBottom: "4px" }}>
                  Additional Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. membrane, nucleus"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                    color: "#f4f4f5",
                    fontSize: "12px",
                  }}
                />
              </div>
            </div>

            {/* File Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed #3f3f46",
                borderRadius: "10px",
                padding: "1.5rem",
                textAlign: "center",
                backgroundColor: "#18181b",
                cursor: "pointer",
              }}
            >
              <Upload size={28} color="#3b82f6" style={{ margin: "0 auto 8px" }} />
              <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#f4f4f5" }}>
                Click to browse files or drag & drop here
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#71717a" }}>
                SVG, PNG, JPEG, WebP (Max 25 MB each). Magic bytes and server-side SVG sanitizer enforced.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".svg,.png,.jpg,.jpeg,.webp"
                onChange={handleFilesSelected}
                style={{ display: "none" }}
              />
            </div>

            {/* Queue List */}
            {uploadQueue.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#a1a1aa" }}>
                  <span>Files in batch ({uploadQueue.length}):</span>
                  <button
                    type="button"
                    onClick={() => setUploadQueue([])}
                    disabled={isProcessingQueue}
                    style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "11px" }}
                  >
                    Clear All
                  </button>
                </div>

                {uploadQueue.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "#f4f4f5" }}>{item.file.name}</div>
                      <div style={{ fontSize: "11px", color: "#71717a" }}>
                        {(item.file.size / 1024).toFixed(1)} KB • {item.file.type || "binary"}
                      </div>
                      {item.error && (
                        <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "2px" }}>
                          Error: {item.error}
                        </div>
                      )}
                      {item.duplicateInfo && (
                        <div style={{ color: "#f59e0b", fontSize: "11px", marginTop: "2px" }}>
                          {item.duplicateInfo.message}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {item.status === "uploading" && (
                        <RefreshCw size={14} className="animate-spin" color="#3b82f6" />
                      )}
                      {item.status === "success" && <Check size={16} color="#10b981" />}
                      {item.status === "error" && <AlertCircle size={16} color="#ef4444" />}
                      {item.status === "duplicate" && (
                        <button
                          type="button"
                          onClick={() => processUploadItem(item, true)}
                          style={{
                            backgroundColor: "#f59e0b",
                            color: "#000",
                            border: "none",
                            borderRadius: "4px",
                            padding: "3px 8px",
                            fontSize: "10px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Upload Anyway
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isProcessingQueue}
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid #3f3f46",
                  color: "#d4d4d8",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleStartBatchUpload}
                disabled={isProcessingQueue || uploadQueue.length === 0}
                style={{
                  backgroundColor: "#3b82f6",
                  border: "none",
                  color: "#fff",
                  padding: "8px 18px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isProcessingQueue || uploadQueue.length === 0 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <FileUp size={14} />
                <span>{isProcessingQueue ? "Uploading..." : `Upload ${uploadQueue.length} File(s)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Asset Modal */}
      {isReplaceModalOpen && replaceTargetAsset && (
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
            if (e.target === e.currentTarget && !isReplacing) setIsReplaceModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: "#121215",
              border: "1px solid #27272a",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "480px",
              padding: "1.75rem",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <RefreshCw size={18} color="#3b82f6" />
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
                  Replace Asset File
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReplaceModalOpen(false)}
                disabled={isReplacing}
                style={{ background: "transparent", border: "none", color: "#71717a", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ backgroundColor: "#18181b", padding: "12px", borderRadius: "8px", fontSize: "13px" }}>
              <div style={{ color: "#a1a1aa", fontSize: "11px" }}>Current Target:</div>
              <div style={{ fontWeight: 600, color: "#f4f4f5" }}>{replaceTargetAsset.name}</div>
              <div style={{ color: "#71717a", fontSize: "11px" }}>
                ID: {replaceTargetAsset.id} • Current Version: v{replaceTargetAsset.version || 1}
              </div>
            </div>

            <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa", lineHeight: 1.5 }}>
              Uploading a replacement will preserve the stable asset ID while incrementing the version to{" "}
              <strong>v{(replaceTargetAsset.version || 1) + 1}</strong>. The replacement is verified before making it active.
            </p>

            <form onSubmit={handleReplaceSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                onClick={() => replaceFileInputRef.current?.click()}
                style={{
                  border: "2px dashed #3f3f46",
                  borderRadius: "8px",
                  padding: "1.5rem",
                  textAlign: "center",
                  backgroundColor: "#18181b",
                  cursor: "pointer",
                }}
              >
                <Upload size={24} color="#3b82f6" style={{ margin: "0 auto 8px" }} />
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
                  {replaceFile ? replaceFile.name : "Choose new replacement file"}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#71717a" }}>
                  SVG, PNG, JPEG, WebP (up to 25 MB)
                </p>
                <input
                  ref={replaceFileInputRef}
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setReplaceFile(e.target.files[0]);
                    }
                  }}
                  style={{ display: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setIsReplaceModalOpen(false)}
                  disabled={isReplacing}
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid #3f3f46",
                    color: "#d4d4d8",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReplacing || !replaceFile}
                  style={{
                    backgroundColor: "#3b82f6",
                    border: "none",
                    color: "#fff",
                    padding: "8px 18px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: isReplacing || !replaceFile ? "not-allowed" : "pointer",
                  }}
                >
                  {isReplacing ? "Uploading & Bumping..." : "Confirm Replacement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

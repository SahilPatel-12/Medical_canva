"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DesignDocument, CreateDesignInput } from "@design-platform/types";
import { getDesignRepository } from "../../lib/repository";
import { FilesTopNav } from "./FilesTopNav";
import { FilesSidebar, FileFilter } from "./FilesSidebar";
import { DesignCard } from "./DesignCard";
import { CreateDesignDialog } from "./CreateDesignDialog";
import { Dialog, Button, Input } from "@design-platform/ui";
import { Plus, Search, Layers, RefreshCw } from "lucide-react";

export const FilesDashboard: React.FC = () => {
  const router = useRouter();
  const repository = useMemo(() => getDesignRepository(), []);

  const [designs, setDesigns] = useState<DesignDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FileFilter>("all");

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const loadDesigns = async () => {
    try {
      setIsLoading(true);
      const list = await repository.list();
      setDesigns(list);
    } catch (err) {
      console.error("Failed to load designs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDesigns();
  }, []);

  // Filtered designs
  const filteredDesigns = useMemo(() => {
    let result = [...designs];

    // Filter by tab
    if (activeFilter === "favorites") {
      result = result.filter((d) => d.favorite);
    } else if (activeFilter === "recent") {
      // Last 7 days
      const sevenDaysAgo = Date.now() - 7 * 86400 * 1000;
      result = result.filter((d) => new Date(d.updatedAt || d.createdAt).getTime() > sevenDaysAgo);
    } else if (activeFilter === "shared") {
      result = []; // Phase 1 restriction: no collaboration
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q));
    }

    return result;
  }, [designs, activeFilter, searchQuery]);

  // Actions
  const handleCreate = async (input: CreateDesignInput) => {
    const created = await repository.create(input);
    await loadDesigns();
    router.push(`/editor/${created.id}`);
  };

  const handleDuplicate = async (id: string) => {
    await repository.duplicate(id);
    await loadDesigns();
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    await repository.delete(deleteTargetId);
    setDeleteTargetId(null);
    await loadDesigns();
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;

    await repository.update(renameTarget.id, { name: renameValue.trim() });
    setRenameTarget(null);
    await loadDesigns();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "#09090b",
      }}
    >
      {/* Top Nav */}
      <FilesTopNav
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCreateNew={() => setIsCreateOpen(true)}
      />

      <div style={{ display: "flex", flex: 1 }}>
        {/* Left Sidebar */}
        <FilesSidebar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          allCount={designs.length}
        />

        {/* Main Content Area */}
        <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
          {/* Header Title & Summary */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.75rem",
            }}
          >
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f4f4f5", margin: 0 }}>
                {activeFilter === "all"
                  ? "All Designs"
                  : activeFilter === "recent"
                    ? "Recent Designs"
                    : activeFilter === "favorites"
                      ? "Favorite Designs"
                      : "Shared with Me"}
              </h1>
              <p
                style={{ fontSize: "0.875rem", color: "#a1a1aa", marginTop: "0.25rem", margin: 0 }}
              >
                {filteredDesigns.length} {filteredDesigns.length === 1 ? "design" : "designs"} found
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadDesigns}
              icon={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
          </div>

          {/* Cards Grid */}
          {isLoading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "300px",
                color: "#71717a",
                fontSize: "0.875rem",
              }}
            >
              Loading your designs...
            </div>
          ) : filteredDesigns.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "360px",
                backgroundColor: "#121215",
                borderRadius: "16px",
                border: "1px dashed #27272a",
                padding: "3rem",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "14px",
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#71717a",
                  marginBottom: "1rem",
                }}
              >
                {searchQuery ? <Search size={24} /> : <Layers size={24} />}
              </div>
              <h3
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "#f4f4f5",
                  marginBottom: "0.5rem",
                }}
              >
                {searchQuery ? `No designs matching "${searchQuery}"` : "No designs yet"}
              </h3>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#a1a1aa",
                  maxWidth: "380px",
                  marginBottom: "1.5rem",
                }}
              >
                {searchQuery
                  ? "Try searching for a different keyword or reset your filters."
                  : "Start creating visual diagrams, molecular figures, or scientific posters."}
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsCreateOpen(true)}
                icon={<Plus size={16} />}
              >
                Create New Design
              </Button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "1.25rem",
              }}
            >
              {filteredDesigns.map((design) => (
                <DesignCard
                  key={design.id}
                  design={design}
                  onRename={(id, currentName) => {
                    setRenameTarget({ id, name: currentName });
                    setRenameValue(currentName);
                  }}
                  onDuplicate={handleDuplicate}
                  onDelete={(id) => setDeleteTargetId(id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Design Dialog */}
      <CreateDesignDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Rename Dialog */}
      <Dialog
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename Design"
        maxWidth="420px"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRenameSubmit}
              disabled={!renameValue.trim()}
            >
              Save Name
            </Button>
          </>
        }
      >
        <form onSubmit={handleRenameSubmit}>
          <Input
            label="Design Title"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            required
          />
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        title="Delete Design"
        description="Are you sure you want to delete this design? This action cannot be undone."
        maxWidth="400px"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete Design
            </Button>
          </>
        }
      >
        <p style={{ fontSize: "0.875rem", color: "#a1a1aa", margin: 0 }}>
          This will permanently remove the design and its vector contents from your files.
        </p>
      </Dialog>
    </div>
  );
};

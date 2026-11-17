"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DesignDocument, CreateDesignInput } from "@design-platform/types";
import { useAuth } from "@design-platform/auth";
import { getDesignRepository } from "../../lib/repository";
import { FilesTopNav } from "./FilesTopNav";
import { FilesSidebar, FileFilter } from "./FilesSidebar";
import { DesignCard } from "./DesignCard";
import { CreateDesignDialog } from "./CreateDesignDialog";
import { Dialog, Button, Input } from "@design-platform/ui";
import { Plus, RefreshCw, Copy, Trash2, X } from "lucide-react";
import { AntibodyIllustration, CellIllustration, DnaIllustration, VirionIllustration } from "../marketing/illustrations";
import styles from "./files.module.css";

/** One-click formats for the most common medical & research outputs */
const QUICK_FORMATS = [
  { label: "Presentation", defaultName: "Untitled presentation", width: 1920, height: 1080 },
  { label: "Paper figure", defaultName: "Untitled figure", width: 1200, height: 800 },
  { label: "Research poster", defaultName: "Untitled poster", width: 2400, height: 1600 },
  { label: "Patient handout", defaultName: "Untitled handout", width: 1240, height: 1754 },
  { label: "Square", defaultName: "Untitled design", width: 1080, height: 1080 },
];

export const FilesDashboard: React.FC = () => {
  const router = useRouter();
  const { user, profile, currentWorkspace, isLoading: isAuthLoading } = useAuth();
  const repository = useMemo(
    () => getDesignRepository({ workspaceId: currentWorkspace?.id, userId: user?.id }),
    [currentWorkspace?.id, user?.id]
  );

  const [designs, setDesigns] = useState<DesignDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FileFilter>("all");

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);
  const [selectedDesignIds, setSelectedDesignIds] = useState<string[]>([]);
  const [lastToggledId, setLastToggledId] = useState<string | null>(null);
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const loadDesigns = async () => {
    if (!currentWorkspace?.id) {
      setDesigns([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const list = await repository.list(currentWorkspace.id);
      setDesigns(list);
    } catch (err) {
      console.error("Failed to load designs:", err);
      setDesigns([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace("/login?redirectTo=/files");
      return;
    }
    if (!currentWorkspace) {
      setDesigns([]);
      setIsLoading(false);
      return;
    }
    loadDesigns();
  }, [currentWorkspace?.id, isAuthLoading, user, router]);

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

  const isViewer = currentWorkspace?.role === "viewer";

  // Actions
  const handleCreate = async (input: CreateDesignInput) => {
    if (!currentWorkspace?.id || isViewer) return;
    const created = await repository.create({
      ...input,
      workspaceId: currentWorkspace.id,
    });
    await loadDesigns();
    router.push(`/editor/${created.id}`);
  };

  const handleDuplicate = async (id: string) => {
    if (!currentWorkspace?.id || isViewer) return;
    await repository.duplicate(id, currentWorkspace.id);
    await loadDesigns();
  };

  const handleDelete = async () => {
    if (deleteTargets.length === 0 || !currentWorkspace?.id) return;
    setIsBulkWorking(true);
    try {
      for (const id of deleteTargets) await repository.delete(id, currentWorkspace.id);
    } finally {
      setIsBulkWorking(false);
    }
    setSelectedDesignIds((prev) => prev.filter((id) => !deleteTargets.includes(id)));
    setDeleteTargets([]);
    await loadDesigns();
  };

  // ---------- Multi-select ----------
  const toggleDesign = (id: string, range: boolean) => {
    setSelectedDesignIds((prev) => {
      if (range && lastToggledId) {
        const order = filteredDesigns.map((d) => d.id);
        const a = order.indexOf(lastToggledId);
        const b = order.indexOf(id);
        if (a !== -1 && b !== -1) {
          const span = order.slice(Math.min(a, b), Math.max(a, b) + 1);
          return [...new Set([...prev, ...span])];
        }
      }
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
    setLastToggledId(id);
  };
  const visibleSelected = selectedDesignIds.filter((id) => filteredDesigns.some((d) => d.id === id));
  const allVisibleSelected = filteredDesigns.length > 0 && visibleSelected.length === filteredDesigns.length;

  const handleBulkDuplicate = async () => {
    if (!currentWorkspace?.id || isViewer) return;
    setIsBulkWorking(true);
    try {
      for (const id of visibleSelected) await repository.duplicate(id, currentWorkspace.id);
    } finally {
      setIsBulkWorking(false);
    }
    setSelectedDesignIds([]);
    await loadDesigns();
  };

  useEffect(() => {
    if (selectedDesignIds.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedDesignIds([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDesignIds.length]);

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim() || !currentWorkspace?.id) return;

    await repository.update(renameTarget.id, { name: renameValue.trim() }, currentWorkspace.id);
    setRenameTarget(null);
    await loadDesigns();
  };

  if (isAuthLoading || !user) {
    return <div className={styles.loading}>Loading your workspace…</div>;
  }

  const firstName =
    (profile?.displayName || (user.user_metadata?.display_name as string) || user.email?.split("@")[0] || "")
      .split(/\s+/)
      .filter((w) => !/^(dr|prof)\.?$/i.test(w))[0] || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const sectionTitle =
    activeFilter === "all" ? "Your designs" : activeFilter === "recent" ? "Edited this week" : activeFilter === "favorites" ? "Favorites" : "Shared with you";

  return (
    <div className={styles.app}>
      <FilesTopNav searchQuery={searchQuery} onSearchChange={setSearchQuery} onCreateNew={() => setIsCreateOpen(true)} />

      <div className={styles.body}>
        <FilesSidebar activeFilter={activeFilter} onFilterChange={setActiveFilter} allCount={designs.length} />

        <main className={styles.main}>
          {!searchQuery && activeFilter === "all" && (
            <>
              <section className={styles.hero}>
                <div className={styles.heroText}>
                  <p className={styles.greeting}>
                    {greeting}
                    {firstName ? `, ${firstName}` : ""}
                  </p>
                  <h1 className={styles.heroTitle}>What will you create today?</h1>
                  <p className={styles.heroLead}>
                    {isViewer
                      ? "You have view access in this workspace. Open any design below to review it."
                      : "Pick a format to start instantly, or open one of your designs below."}
                  </p>
                </div>
                <div className={styles.heroArt} aria-hidden>
                  <div style={{ left: 0, top: 6, width: 120, height: 120 }}>
                    <CellIllustration />
                  </div>
                  <div style={{ left: 110, top: -6, width: 82, height: 82 }}>
                    <VirionIllustration />
                  </div>
                  <div style={{ left: 176, top: 40, width: 84, height: 84 }}>
                    <AntibodyIllustration />
                  </div>
                </div>
              </section>

              {!isViewer && (
                <div className={styles.quick} aria-label="Start a new design">
                  {QUICK_FORMATS.map((f) => {
                    const k = 46 / Math.max(f.width, f.height);
                    return (
                      <button
                        key={f.label}
                        type="button"
                        className={styles.quickTile}
                        onClick={() => handleCreate({ name: f.defaultName, width: f.width, height: f.height })}
                        title={`New ${f.label.toLowerCase()} (${f.width} × ${f.height})`}
                      >
                        <span className={styles.quickShape}>
                          <span style={{ width: Math.round(f.width * k), height: Math.round(f.height * k) }} />
                        </span>
                        <span className={styles.quickLabel}>{f.label}</span>
                        <span className={styles.quickMeta}>
                          {f.width} × {f.height}
                        </span>
                      </button>
                    );
                  })}
                  <button type="button" className={`${styles.quickTile} ${styles.quickCustom}`} onClick={() => setIsCreateOpen(true)}>
                    <span className={styles.quickShape}>
                      <span style={{ width: 46, height: 46 }}>
                        <Plus size={20} />
                      </span>
                    </span>
                    <span className={styles.quickLabel}>Custom size</span>
                    <span className={styles.quickMeta}>Any dimensions</span>
                  </button>
                </div>
              )}
            </>
          )}

          <div className={styles.sectionHead} style={searchQuery || activeFilter !== "all" ? { marginTop: 0 } : undefined}>
            <h2>{searchQuery ? `Results for “${searchQuery}”` : sectionTitle}</h2>
            {!isLoading && <span className={styles.count}>{filteredDesigns.length}</span>}
            <span className={styles.spacer} />
            <button type="button" className={styles.iconBtn} onClick={loadDesigns} title="Refresh" aria-label="Refresh designs">
              <RefreshCw size={17} />
            </button>
          </div>

          {isLoading ? (
            <div className={styles.grid} aria-busy="true" aria-label="Loading designs">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={styles.skeleton}>
                  <div style={{ aspectRatio: "16 / 10" }} />
                  <div style={{ height: 14, margin: "14px 16px 8px", borderRadius: 6, width: "60%" }} />
                  <div style={{ height: 10, margin: "0 16px 16px", borderRadius: 6, width: "35%" }} />
                </div>
              ))}
            </div>
          ) : filteredDesigns.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyArt}>
                {searchQuery ? <DnaIllustration /> : <CellIllustration />}
              </div>
              <h3>
                {searchQuery
                  ? "No designs match your search"
                  : activeFilter === "shared"
                    ? "Nothing shared with you yet"
                    : activeFilter === "favorites"
                      ? "No favorites yet"
                      : activeFilter === "recent"
                        ? "Nothing edited this week"
                        : "Create your first design"}
              </h3>
              <p>
                {searchQuery
                  ? "Try a different word, or clear the search to see all designs."
                  : activeFilter === "shared"
                    ? "When teammates share a design with you, it will appear here."
                    : "Start from a format above, or create a design with any size."}
              </p>
              {searchQuery ? (
                <button type="button" className={styles.createBtn} onClick={() => setSearchQuery("")}>
                  Clear search
                </button>
              ) : (
                !isViewer && (
                  <button type="button" className={styles.createBtn} onClick={() => setIsCreateOpen(true)}>
                    <Plus size={17} strokeWidth={2.5} /> <span>Create design</span>
                  </button>
                )
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredDesigns.map((design) => (
                <DesignCard
                  key={design.id}
                  design={design}
                  onRename={(id, currentName) => {
                    setRenameTarget({ id, name: currentName });
                    setRenameValue(currentName);
                  }}
                  onDuplicate={handleDuplicate}
                  onDelete={(id) => setDeleteTargets([id])}
                  isViewer={isViewer}
                  isSelected={visibleSelected.includes(design.id)}
                  selectionMode={visibleSelected.length > 0}
                  onToggleSelect={isViewer ? undefined : toggleDesign}
                />
              ))}
            </div>
          )}

          {visibleSelected.length > 0 && (
            <div className={styles.bulkBar} role="toolbar" aria-label="Selected designs">
              <span className={styles.bulkCount}>{visibleSelected.length} selected</span>
              <button
                type="button"
                className={styles.bulkBtn}
                onClick={() => setSelectedDesignIds(allVisibleSelected ? [] : filteredDesigns.map((d) => d.id))}
              >
                {allVisibleSelected ? "Deselect all" : `Select all (${filteredDesigns.length})`}
              </button>
              <span className={styles.bulkSep} />
              <button type="button" className={styles.bulkBtn} onClick={handleBulkDuplicate} disabled={isBulkWorking}>
                <Copy size={16} /> Duplicate
              </button>
              <button
                type="button"
                className={`${styles.bulkBtn} ${styles.bulkDanger}`}
                onClick={() => setDeleteTargets(visibleSelected)}
                disabled={isBulkWorking}
              >
                <Trash2 size={16} /> Delete
              </button>
              <button type="button" className={styles.bulkClose} onClick={() => setSelectedDesignIds([])} aria-label="Clear selection" title="Clear selection (Esc)">
                <X size={16} />
              </button>
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
        isOpen={deleteTargets.length > 0}
        onClose={() => setDeleteTargets([])}
        title={deleteTargets.length > 1 ? `Delete ${deleteTargets.length} designs` : "Delete design"}
        description={
          deleteTargets.length > 1
            ? `Are you sure you want to delete these ${deleteTargets.length} designs? This can’t be undone.`
            : "Are you sure you want to delete this design? This can’t be undone."
        }
        maxWidth="400px"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTargets([])}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={isBulkWorking}>
              {deleteTargets.length > 1 ? `Delete ${deleteTargets.length} designs` : "Delete design"}
            </Button>
          </>
        }
      >
        <p style={{ fontSize: "0.875rem", color: "var(--foreground-muted, #64748b)", margin: 0 }}>
          {deleteTargets.length > 1
            ? "They will be permanently removed from your files, along with all their pages."
            : "It will be permanently removed from your files, along with all its pages."}
        </p>
      </Dialog>
    </div>
  );
};

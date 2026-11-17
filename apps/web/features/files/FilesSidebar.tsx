"use client";

import React from "react";
import { Clock, Star, Users, LayoutGrid, Sparkles } from "lucide-react";
import styles from "./files.module.css";
import { VirionIllustration } from "../marketing/illustrations";

export type FileFilter = "all" | "recent" | "favorites" | "shared";

export interface FilesSidebarProps {
  activeFilter: FileFilter;
  onFilterChange: (filter: FileFilter) => void;
  allCount: number;
}

const ITEMS: Array<{ id: FileFilter; label: string; icon: React.ReactNode }> = [
  { id: "all", label: "All designs", icon: <LayoutGrid size={18} /> },
  { id: "recent", label: "Recent", icon: <Clock size={18} /> },
  { id: "favorites", label: "Favorites", icon: <Star size={18} /> },
  { id: "shared", label: "Shared with me", icon: <Users size={18} /> },
];

export const FilesSidebar: React.FC<FilesSidebarProps> = ({ activeFilter, onFilterChange, allCount }) => (
  <aside className={styles.sidebar} aria-label="Files navigation">
    <div>
      <div className={styles.navLabel}>Your files</div>
      <nav className={styles.nav}>
        {ITEMS.map((item) => {
          const active = activeFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => onFilterChange(item.id)}
            >
              {item.icon}
              {item.label}
              {item.id === "all" && <span className={styles.navCount}>{allCount}</span>}
            </button>
          );
        })}
      </nav>
    </div>

    <div className={styles.tipCard}>
      <div className={styles.tipArt}>
        <VirionIllustration />
      </div>
      <strong>
        <Sparkles size={15} /> Tip
      </strong>
      Double-click any illustration in the editor to select and recolor its individual parts.
    </div>
  </aside>
);

"use client";

import React from "react";
import { Folder, Clock, Star, Users, FolderPlus, Layers } from "lucide-react";

export type FileFilter = "all" | "recent" | "favorites" | "shared";

export interface FilesSidebarProps {
  activeFilter: FileFilter;
  onFilterChange: (filter: FileFilter) => void;
  allCount: number;
}

export const FilesSidebar: React.FC<FilesSidebarProps> = ({
  activeFilter,
  onFilterChange,
  allCount,
}) => {
  const navItems = [
    {
      id: "all" as FileFilter,
      label: "All designs",
      icon: <Layers size={16} />,
      count: allCount,
    },
    {
      id: "recent" as FileFilter,
      label: "Recent",
      icon: <Clock size={16} />,
    },
    {
      id: "favorites" as FileFilter,
      label: "Favorites",
      icon: <Star size={16} />,
    },
  ];

  return (
    <aside
      style={{
        width: "240px",
        flexShrink: 0,
        borderRight: "1px solid #27272a",
        backgroundColor: "#0d0d10",
        padding: "1.25rem 0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* Section: Created by me */}
      <div>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#71717a",
            padding: "0 0.75rem 0.5rem",
          }}
        >
          My Files
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map((item) => {
            const isActive = activeFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilterChange(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#ffffff" : "#a1a1aa",
                  backgroundColor: isActive ? "#27272a" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.1s ease",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "#18181b";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <span style={{ color: isActive ? "#3b82f6" : "#71717a" }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      padding: "2px 6px",
                      borderRadius: "9999px",
                      backgroundColor: isActive ? "#3f3f46" : "#1f1f23",
                      color: isActive ? "#f4f4f5" : "#71717a",
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Section: Folders */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 0.75rem 0.5rem",
          }}
        >
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#71717a",
            }}
          >
            Folders
          </span>
          <span style={{ color: "#52525b", cursor: "default" }}>
            <FolderPlus size={14} />
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
              fontSize: "0.8125rem",
              color: "#71717a",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#18181b")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Folder size={16} />
            <span>Research Projects</span>
          </button>
        </div>
      </div>

      {/* Section: Shared */}
      <div>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#71717a",
            padding: "0 0.75rem 0.5rem",
          }}
        >
          Shared
        </div>
        <button
          type="button"
          onClick={() => onFilterChange("shared")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "8px",
            fontSize: "0.8125rem",
            fontWeight: activeFilter === "shared" ? 600 : 500,
            color: activeFilter === "shared" ? "#ffffff" : "#a1a1aa",
            backgroundColor: activeFilter === "shared" ? "#27272a" : "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "inherit",
          }}
        >
          <Users size={16} style={{ color: activeFilter === "shared" ? "#3b82f6" : "#71717a" }} />
          <span>Shared with me</span>
        </button>
      </div>
    </aside>
  );
};

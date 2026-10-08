"use client";

import React from "react";
import Link from "next/link";
import { Search, Plus, Sparkles, Settings } from "lucide-react";
import { Button, Badge } from "@design-platform/ui";

export interface FilesTopNavProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateNew: () => void;
}

export const FilesTopNav: React.FC<FilesTopNavProps> = ({
  searchQuery,
  onSearchChange,
  onCreateNew,
}) => {
  return (
    <header
      style={{
        height: "60px",
        borderBottom: "1px solid #27272a",
        backgroundColor: "#09090b",
        padding: "0 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1.5rem",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Brand & Main Nav Links */}
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <Link
          href="/files"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.4)",
            }}
          >
            <Sparkles size={18} />
          </div>
          <span
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#f4f4f5",
            }}
          >
            BioCanvas
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link
            href="/files"
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#ffffff",
              textDecoration: "none",
              padding: "4px 8px",
            }}
          >
            My Files
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontSize: "0.875rem",
                color: "#71717a",
                cursor: "not-allowed",
                padding: "4px 8px",
              }}
            >
              Templates
            </span>
            <Badge variant="outline" size="sm">
              Coming Soon
            </Badge>
          </div>
        </nav>
      </div>

      {/* Search Input */}
      <div style={{ flex: 1, maxWidth: "420px" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: "0.75rem",
              color: "#71717a",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search your designs..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: "100%",
              height: "36px",
              backgroundColor: "#141417",
              border: "1px solid #27272a",
              borderRadius: "8px",
              padding: "0 0.75rem 0 2.25rem",
              fontSize: "0.8125rem",
              color: "#f4f4f5",
              outline: "none",
              fontFamily: "inherit",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.target.style.borderColor = "#27272a")}
          />
        </div>
      </div>

      {/* Actions & Profile */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <Button variant="primary" size="sm" onClick={onCreateNew} icon={<Plus size={16} />}>
          Create New
        </Button>

        <button
          type="button"
          aria-label="Settings"
          style={{
            background: "transparent",
            border: "none",
            color: "#71717a",
            padding: "8px",
            borderRadius: "6px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f4f4f5")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#71717a")}
        >
          <Settings size={18} />
        </button>

        {/* User Avatar */}
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "#27272a",
            border: "1px solid #3f3f46",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#e4e4e7",
          }}
          title="Researcher Account"
        >
          SP
        </div>
      </div>
    </header>
  );
};

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Sparkles,
  LogOut,
  User as UserIcon,
  Settings,
  Building2,
  ChevronDown,
  Check,
  UserPlus,
} from "lucide-react";
import { Button, Badge, Dropdown, DropdownItem } from "@design-platform/ui";
import { useAuth } from "@design-platform/auth";
import { resetDesignRepository } from "../../lib/repository";
import { WorkspaceSettingsDialog } from "../workspaces/WorkspaceSettingsDialog";

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
  const router = useRouter();
  const {
    user,
    profile,
    currentWorkspace,
    workspaces,
    switchWorkspace,
    refreshWorkspace,
    signOut,
  } = useAuth();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLogout = async () => {
    resetDesignRepository();
    await signOut();
    router.push("/login");
  };

  const displayName =
    profile?.displayName ||
    (user?.user_metadata?.display_name as string) ||
    user?.email?.split("@")[0] ||
    "User";
  const initials = displayName.substring(0, 2).toUpperCase();

  // Workspace Switcher Dropdown Items
  const workspaceMenuItems: DropdownItem[] = [
    ...(workspaces.length > 0
      ? workspaces.map((ws) => ({
          id: `ws-${ws.id}`,
          label: `${ws.name} (${ws.role})`,
          icon: ws.id === currentWorkspace?.id ? <Check size={14} style={{ color: "#3b82f6" }} /> : <Building2 size={14} />,
          onClick: () => switchWorkspace(ws.id),
        }))
      : currentWorkspace
      ? [
          {
            id: `ws-${currentWorkspace.id}`,
            label: `${currentWorkspace.name} (${currentWorkspace.role})`,
            icon: <Check size={14} style={{ color: "#3b82f6" }} />,
            onClick: () => {},
          },
        ]
      : []),
    {
      id: "manage-workspace",
      label: "Workspace Members & Settings",
      icon: <Settings size={14} />,
      onClick: () => setIsSettingsOpen(true),
    },
  ];

  const userMenuItems: DropdownItem[] = user
    ? [
        {
          id: "user-identity",
          label: user.email || displayName,
          icon: <UserIcon size={14} />,
          disabled: true,
          onClick: () => {},
        },
        ...(currentWorkspace
          ? [
              {
                id: "workspace-settings-action",
                label: `${currentWorkspace.name} Settings`,
                icon: <Settings size={14} />,
                onClick: () => setIsSettingsOpen(true),
              },
            ]
          : []),
        {
          id: "logout",
          label: "Sign Out",
          icon: <LogOut size={14} />,
          danger: true,
          onClick: handleLogout,
        },
      ]
    : [];

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

          {/* Workspace Selector Dropdown */}
          {user && currentWorkspace && (
            <Dropdown
              align="left"
              items={workspaceMenuItems}
              trigger={
                <button
                  type="button"
                  id="workspace-selector-dropdown-btn"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    padding: "4px 10px",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "#f4f4f5",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#27272a")}
                >
                  <Building2 size={14} style={{ color: "#3b82f6" }} />
                  <span
                    style={{
                      maxWidth: "150px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {currentWorkspace.name}
                  </span>
                  <Badge
                    variant={
                      currentWorkspace.role === "owner"
                        ? "primary"
                        : currentWorkspace.role === "admin"
                        ? "warning"
                        : currentWorkspace.role === "editor"
                        ? "success"
                        : "outline"
                    }
                    size="sm"
                  >
                    {currentWorkspace.role.toUpperCase()}
                  </Badge>
                  <ChevronDown size={12} style={{ color: "#71717a" }} />
                </button>
              }
            />
          )}
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

        {currentWorkspace && (
          <button
            type="button"
            aria-label="Workspace Settings"
            id="workspace-settings-gear-btn"
            onClick={() => setIsSettingsOpen(true)}
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
            title="Workspace Settings & Members"
          >
            <Settings size={18} />
          </button>
        )}

        {/* User Account / Auth */}
        {user ? (
          <Dropdown
            align="right"
            items={userMenuItems}
            trigger={
              <button
                type="button"
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
                  cursor: "pointer",
                  padding: 0,
                }}
                title={user.email || displayName}
                aria-label="User account menu"
              >
                {initials}
              </button>
            }
          />
        ) : (
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 14px",
              borderRadius: "6px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              fontSize: "0.85rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Sign In
          </Link>
        )}
      </div>

      {/* Workspace Settings Dialog */}
      {currentWorkspace && (
        <WorkspaceSettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          workspace={currentWorkspace}
          onWorkspaceUpdated={refreshWorkspace}
        />
      )}
    </header>
  );
};

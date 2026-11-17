"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, LogOut, User as UserIcon, Settings, Building2, ChevronDown, Check } from "lucide-react";
import { Dropdown, DropdownItem, ThemeToggle } from "@design-platform/ui";
import { BrandMark } from "../marketing/illustrations";
import styles from "./files.module.css";
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
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "U";

  // Workspace Switcher Dropdown Items
  const workspaceMenuItems: DropdownItem[] = [
    ...(workspaces.length > 0
      ? workspaces.map((ws) => ({
          id: `ws-${ws.id}`,
          label: `${ws.name} (${ws.role})`,
          icon: ws.id === currentWorkspace?.id ? <Check size={14} style={{ color: "#10b981" }} /> : <Building2 size={14} />,
          onClick: () => switchWorkspace(ws.id),
        }))
      : currentWorkspace
      ? [
          {
            id: `ws-${currentWorkspace.id}`,
            label: `${currentWorkspace.name} (${currentWorkspace.role})`,
            icon: <Check size={14} style={{ color: "#10b981" }} />,
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
    <header className={styles.topbar}>
      <Link href="/files" className={styles.brand} aria-label="BioCanvas — your designs">
        <BrandMark size={30} />
        <span>BioCanvas</span>
      </Link>

      {user && currentWorkspace && (
        <Dropdown
          align="left"
          items={workspaceMenuItems}
          trigger={
            <button type="button" id="workspace-selector-dropdown-btn" className={styles.workspaceBtn} title="Switch workspace">
              <span className={styles.wsAvatar}>{currentWorkspace.name.substring(0, 1).toUpperCase()}</span>
              <span className={styles.wsName}>{currentWorkspace.name}</span>
              <span className={styles.wsRole}>{currentWorkspace.role}</span>
              <ChevronDown size={15} />
            </button>
          }
        />
      )}

      <label className={styles.search}>
        <Search size={17} />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search your designs"
          aria-label="Search your designs"
        />
      </label>

      <div className={styles.actions}>
        <span className={styles.hideSm}>
          <ThemeToggle size="sm" />
        </span>
        {currentWorkspace && (
          <button
            type="button"
            aria-label="Workspace settings and members"
            id="workspace-settings-gear-btn"
            className={`${styles.iconBtn} ${styles.hideSm}`}
            onClick={() => setIsSettingsOpen(true)}
            title="Workspace settings & members"
          >
            <Settings size={19} />
          </button>
        )}
        <button type="button" className={styles.createBtn} onClick={onCreateNew}>
          <Plus size={17} strokeWidth={2.5} />
          <span>Create design</span>
        </button>

        {user ? (
          <Dropdown
            align="right"
            items={userMenuItems}
            trigger={
              <button type="button" className={styles.avatarBtn} title={user.email || displayName} aria-label="Account menu">
                {initials}
              </button>
            }
          />
        ) : (
          <Link href="/login" className={styles.createBtn}>
            Sign in
          </Link>
        )}
      </div>

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

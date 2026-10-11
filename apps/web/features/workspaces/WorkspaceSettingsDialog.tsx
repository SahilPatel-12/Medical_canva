"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  Button,
  Input,
  Badge,
} from "@design-platform/ui";
import {
  WorkspaceWithRole,
  WorkspaceMember,
  WorkspaceInvitation,
  WorkspaceRole,
} from "@design-platform/types";
import {
  SupabaseWorkspaceRepository,
  createUserScopedClient,
} from "@design-platform/database";
import { useAuth, getBrowserSupabaseClient } from "@design-platform/auth";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Trash2,
  XCircle,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  Lock,
} from "lucide-react";

export interface WorkspaceSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: WorkspaceWithRole;
  onWorkspaceUpdated?: () => void;
}

export const WorkspaceSettingsDialog: React.FC<WorkspaceSettingsDialogProps> = ({
  isOpen,
  onClose,
  workspace,
  onWorkspaceUpdated,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"members" | "invite">("members");

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Action loading states
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  const canManageMembers = workspace.role === "owner" || workspace.role === "admin";

  const getRepo = useCallback(() => {
    const client = getBrowserSupabaseClient();
    return new SupabaseWorkspaceRepository({ client });
  }, []);

  const loadData = useCallback(async () => {
    if (!isOpen || !workspace.id) return;
    setIsLoadingData(true);
    setErrorMessage(null);

    try {
      const repo = getRepo();
      const [membersList, invitesList] = await Promise.all([
        repo.getWorkspaceMembers(workspace.id),
        canManageMembers ? repo.listInvitations(workspace.id) : Promise.resolve([]),
      ]);

      setMembers(membersList);
      setInvitations(invitesList.filter((inv) => inv.status === "pending"));
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to load workspace members");
    } finally {
      setIsLoadingData(false);
    }
  }, [isOpen, workspace.id, canManageMembers, getRepo]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setGeneratedInviteLink(null);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen, loadData]);

  // Handle Send Invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSendingInvite(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setGeneratedInviteLink(null);

    try {
      const repo = getRepo();
      const newInv = await repo.createInvitation({
        workspaceId: workspace.id,
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const inviteUrl = `${origin}/invite/${newInv.token}`;
      setGeneratedInviteLink(inviteUrl);
      setSuccessMessage(`Invitation created for ${inviteEmail.trim()}!`);
      setInviteEmail("");
      loadData();
      if (onWorkspaceUpdated) onWorkspaceUpdated();
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to send invitation.");
    } finally {
      setIsSendingInvite(false);
    }
  };

  // Handle Revoke Invitation
  const handleRevokeInvite = async (invitationId: string) => {
    setRevokingInviteId(invitationId);
    setErrorMessage(null);
    try {
      const repo = getRepo();
      await repo.revokeInvitation(invitationId);
      setSuccessMessage("Invitation revoked.");
      loadData();
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to revoke invitation.");
    } finally {
      setRevokingInviteId(null);
    }
  };

  // Handle Update Member Role
  const handleUpdateRole = async (targetUserId: string, newRole: "admin" | "editor" | "viewer") => {
    setUpdatingMemberId(targetUserId);
    setErrorMessage(null);
    try {
      const repo = getRepo();
      await repo.updateMemberRole(workspace.id, targetUserId, newRole);
      setSuccessMessage("Member role updated.");
      loadData();
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to update member role.");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  // Handle Remove Member
  const handleRemoveMember = async (targetUserId: string, targetName: string) => {
    const isSelf = targetUserId === user?.id;
    const confirmPrompt = isSelf
      ? "Are you sure you want to leave this workspace?"
      : `Are you sure you want to remove ${targetName} from this workspace?`;

    if (!window.confirm(confirmPrompt)) return;

    setRemovingMemberId(targetUserId);
    setErrorMessage(null);
    try {
      const repo = getRepo();
      await repo.removeMember(workspace.id, targetUserId);
      setSuccessMessage(isSelf ? "You have left the workspace." : "Member removed.");
      loadData();
      if (onWorkspaceUpdated) onWorkspaceUpdated();
      if (isSelf) {
        onClose();
      }
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to remove member.");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleCopyLink = () => {
    if (!generatedInviteLink) return;
    navigator.clipboard.writeText(generatedInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const getRoleBadgeVariant = (role: string): "default" | "primary" | "success" | "warning" | "outline" => {
    switch (role) {
      case "owner":
        return "primary";
      case "admin":
        return "warning";
      case "editor":
        return "success";
      case "viewer":
      default:
        return "outline";
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${workspace.name} — Workspace Settings`}
      description={`Manage team collaborators and role permissions for this ${workspace.type} workspace.`}
      maxWidth="680px"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "#71717a" }}>
            Your role: <strong style={{ color: "#e4e4e7", textTransform: "capitalize" }}>{workspace.role}</strong>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} id="close-workspace-dialog-btn">
            Done
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            borderBottom: "1px solid #27272a",
            paddingBottom: "0.75rem",
          }}
        >
          <button
            type="button"
            id="tab-members-btn"
            onClick={() => setActiveTab("members")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: activeTab === "members" ? "#27272a" : "transparent",
              color: activeTab === "members" ? "#ffffff" : "#a1a1aa",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Users size={15} />
            Members ({members.length})
          </button>

          {canManageMembers && (
            <button
              type="button"
              id="tab-invite-btn"
              onClick={() => setActiveTab("invite")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: activeTab === "invite" ? "#27272a" : "transparent",
                color: activeTab === "invite" ? "#ffffff" : "#a1a1aa",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <UserPlus size={15} />
              Invite Collaborators
            </button>
          )}
        </div>

        {/* Feedback Banners */}
        {errorMessage && (
          <div
            id="workspace-error-banner"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#f87171",
              fontSize: "0.8125rem",
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            id="workspace-success-banner"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: "8px",
              color: "#4ade80",
              fontSize: "0.8125rem",
            }}
          >
            <Check size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Tab 1: Members List */}
        {activeTab === "members" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Viewer / Editor Note */}
            {!canManageMembers && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.75rem 1rem",
                  backgroundColor: "#141417",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  color: "#a1a1aa",
                }}
              >
                <Lock size={15} style={{ color: "#71717a" }} />
                <span>
                  You have <strong>{workspace.role}</strong> access. Only workspace owners and admins can invite members or change roles.
                </span>
              </div>
            )}

            {/* Members Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Active Members
                </span>
                {canManageMembers && (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setActiveTab("invite")}
                    icon={<UserPlus size={13} />}
                  >
                    Invite
                  </Button>
                )}
              </div>

              {isLoadingData ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#71717a", fontSize: "0.8125rem" }}>
                  Loading workspace members...
                </div>
              ) : members.length === 0 ? (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "#71717a", fontSize: "0.8125rem" }}>
                  No members found.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {members.map((member) => {
                    const isOwner = member.role === "owner";
                    const isSelf = member.userId === user?.id;
                    const displayName = member.user?.displayName || "Workspace Member";
                    const initials = displayName.substring(0, 2).toUpperCase();
                    const canEditThisMember =
                      canManageMembers &&
                      !isOwner &&
                      (workspace.role === "owner" || member.role !== "admin");

                    return (
                      <div
                        key={member.userId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.75rem 1rem",
                          backgroundColor: "#141417",
                          border: "1px solid #27272a",
                          borderRadius: "8px",
                          gap: "1rem",
                        }}
                      >
                        {/* Member Identity */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              backgroundColor: "#27272a",
                              border: "1px solid #3f3f46",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: "#e4e4e7",
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span
                                style={{
                                  fontSize: "0.875rem",
                                  fontWeight: 500,
                                  color: "#f4f4f5",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {displayName}
                              </span>
                              {isSelf && (
                                <span style={{ fontSize: "0.6875rem", color: "#71717a" }}>(You)</span>
                              )}
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "#71717a" }}>
                              Joined {new Date(member.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Role Selector / Badge & Removal */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          {canEditThisMember ? (
                            <select
                              value={member.role}
                              disabled={updatingMemberId === member.userId}
                              onChange={(e) =>
                                handleUpdateRole(
                                  member.userId,
                                  e.target.value as "admin" | "editor" | "viewer"
                                )
                              }
                              style={{
                                backgroundColor: "#1f1f23",
                                border: "1px solid #3f3f46",
                                color: "#f4f4f5",
                                borderRadius: "6px",
                                padding: "4px 8px",
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                outline: "none",
                                cursor: "pointer",
                              }}
                            >
                              <option value="admin">Admin</option>
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <Badge variant={getRoleBadgeVariant(member.role)} size="sm">
                              {member.role.toUpperCase()}
                            </Badge>
                          )}

                          {/* Removal or Leave Button */}
                          {!isOwner && (canEditThisMember || isSelf) && (
                            <Button
                              variant="ghost"
                              size="xs"
                              disabled={removingMemberId === member.userId}
                              onClick={() => handleRemoveMember(member.userId, displayName)}
                              style={{ color: "#ef4444", padding: "4px 8px" }}
                              title={isSelf ? "Leave Workspace" : "Remove Member"}
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending Invitations Section (Owners/Admins only) */}
            {canManageMembers && invitations.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Pending Invitations ({invitations.length})
                </span>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.75rem 1rem",
                        backgroundColor: "#141417",
                        border: "1px dashed #3f3f46",
                        borderRadius: "8px",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#e4e4e7" }}>
                          {inv.email}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "2px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#a1a1aa", display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={12} />
                            Expires in {Math.max(0, Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <Badge variant="outline" size="sm">
                          {inv.role.toUpperCase()}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={revokingInviteId === inv.id}
                          onClick={() => handleRevokeInvite(inv.id)}
                          style={{ color: "#ef4444" }}
                          title="Revoke Invitation"
                        >
                          <XCircle size={15} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Invite Collaborators */}
        {activeTab === "invite" && canManageMembers && (
          <form onSubmit={handleSendInvite} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#f4f4f5" }}>
                Email Address
              </label>
              <Input
                type="email"
                placeholder="colleague@institution.edu"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                id="invite-email-input"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#f4f4f5" }}>
                Select Role & Permissions
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem" }}>
                {/* Editor Option */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.875rem",
                    backgroundColor: inviteRole === "editor" ? "rgba(59, 130, 246, 0.08)" : "#141417",
                    border: `1px solid ${inviteRole === "editor" ? "#3b82f6" : "#27272a"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value="editor"
                    checked={inviteRole === "editor"}
                    onChange={() => setInviteRole("editor")}
                    style={{ marginTop: "3px" }}
                  />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <strong style={{ fontSize: "0.875rem", color: "#f4f4f5" }}>Editor</strong>
                      <Badge variant="success" size="sm">Recommended</Badge>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#a1a1aa", margin: "2px 0 0" }}>
                      Can create, edit, save, and duplicate designs in this workspace.
                    </p>
                  </div>
                </label>

                {/* Viewer Option */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.875rem",
                    backgroundColor: inviteRole === "viewer" ? "rgba(59, 130, 246, 0.08)" : "#141417",
                    border: `1px solid ${inviteRole === "viewer" ? "#3b82f6" : "#27272a"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value="viewer"
                    checked={inviteRole === "viewer"}
                    onChange={() => setInviteRole("viewer")}
                    style={{ marginTop: "3px" }}
                  />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <strong style={{ fontSize: "0.875rem", color: "#f4f4f5" }}>Viewer</strong>
                      <Badge variant="outline" size="sm">Read-Only</Badge>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#a1a1aa", margin: "2px 0 0" }}>
                      Can view designs. Cannot create, edit, modify, or delete any designs.
                    </p>
                  </div>
                </label>

                {/* Admin Option */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    padding: "0.875rem",
                    backgroundColor: inviteRole === "admin" ? "rgba(59, 130, 246, 0.08)" : "#141417",
                    border: `1px solid ${inviteRole === "admin" ? "#3b82f6" : "#27272a"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value="admin"
                    checked={inviteRole === "admin"}
                    onChange={() => setInviteRole("admin")}
                    style={{ marginTop: "3px" }}
                  />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <strong style={{ fontSize: "0.875rem", color: "#f4f4f5" }}>Admin</strong>
                      <Badge variant="warning" size="sm">Management</Badge>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#a1a1aa", margin: "2px 0 0" }}>
                      Full editing privileges plus ability to invite and manage members.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={isSendingInvite}
              id="send-invitation-submit-btn"
              icon={<Mail size={16} />}
            >
              {isSendingInvite ? "Generating Invitation..." : "Send Invitation"}
            </Button>

            {/* Generated Invite Link Box */}
            {generatedInviteLink && (
              <div
                id="generated-invite-link-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.625rem",
                  padding: "1rem",
                  backgroundColor: "#18181b",
                  border: "1px solid #3b82f6",
                  borderRadius: "8px",
                  marginTop: "0.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Sparkles size={16} style={{ color: "#3b82f6" }} />
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#f4f4f5" }}>
                    Invitation Link Ready
                  </span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#a1a1aa", margin: 0 }}>
                  Share this secure single-use invitation link with the recipient. They will need to log in with their matching email to accept.
                </p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    style={{
                      flex: 1,
                      backgroundColor: "#09090b",
                      border: "1px solid #27272a",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      fontSize: "0.75rem",
                      color: "#93c5fd",
                      fontFamily: "monospace",
                    }}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={handleCopyLink}
                    id="copy-invite-link-btn"
                    icon={copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  >
                    {copiedLink ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </Dialog>
  );
};

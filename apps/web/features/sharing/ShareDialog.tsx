"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Dialog, Button, Badge } from "@design-platform/ui";
import { DesignShareLink, SharePermission } from "@design-platform/types";
import { SupabaseShareRepository } from "@design-platform/database";
import { getBrowserSupabaseClient } from "@design-platform/auth";
import {
  Link2,
  Check,
  Globe,
  Lock,
  Eye,
  Edit3,
  RotateCcw,
  Loader2,
  AlertCircle,
  Copy,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";

export interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  designId: string;
  designName?: string;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  designId,
  designName = "Untitled Design",
}) => {
  const [shareLink, setShareLink] = useState<DesignShareLink | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState<boolean>(false);

  const getShareUrl = useCallback(
    (token: string): string => {
      if (typeof window === "undefined") return `/share/${token}`;
      return `${window.location.origin}/share/${token}`;
    },
    []
  );

  const loadShareLink = useCallback(async () => {
    if (!designId) return;
    setIsLoading(true);
    setError(null);

    try {
      const client = getBrowserSupabaseClient();
      const repo = new SupabaseShareRepository({ client });
      const link = await repo.getOrCreateShareLink(designId);
      setShareLink(link);
    } catch (err) {
      console.error("[ShareDialog] Error loading share link:", err);
      setError((err as Error).message || "Failed to load sharing settings.");
    } finally {
      setIsLoading(false);
    }
  }, [designId]);

  useEffect(() => {
    if (isOpen) {
      loadShareLink();
      setShowRegenerateConfirm(false);
      setIsCopied(false);
    }
  }, [isOpen, loadShareLink]);

  const handleUpdate = async (
    isEnabled: boolean,
    permission: SharePermission,
    regenerateToken = false
  ) => {
    if (!shareLink) return;
    setIsUpdating(true);
    setError(null);

    try {
      const client = getBrowserSupabaseClient();
      const repo = new SupabaseShareRepository({ client });
      const updated = await repo.updateShareLink({
        designId,
        isEnabled,
        permission,
        regenerateToken,
      });

      setShareLink(updated);
      if (regenerateToken) {
        setShowRegenerateConfirm(false);
      }
    } catch (err) {
      console.error("[ShareDialog] Error updating share link:", err);
      setError((err as Error).message || "Failed to update sharing settings.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      const url = getShareUrl(shareLink.token);
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error("[ShareDialog] Failed to copy link:", err);
    }
  };

  const isLinkEnabled = Boolean(shareLink?.isEnabled);
  const currentPermission = shareLink?.permission || "view";

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Share this design"
      description={`Manage link sharing and collaborator access for "${designName}"`}
      maxWidth="520px"
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <ShieldCheck size={14} style={{ color: "#10b981" }} />
            <span style={{ fontSize: "12px", color: "#a1a1aa" }}>Private workspace isolation enabled</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.75rem 1rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#f87171",
              fontSize: "0.8125rem",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "2.5rem 0",
              gap: "0.75rem",
              color: "#a1a1aa",
            }}
          >
            <Loader2 size={24} className="animate-spin" style={{ color: "#3b82f6" }} />
            <span style={{ fontSize: "0.8125rem" }}>Loading sharing preferences...</span>
          </div>
        ) : error && !shareLink ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem 1rem",
              gap: "1rem",
              textAlign: "center",
            }}
          >
            <div style={{ color: "#a1a1aa", fontSize: "0.875rem" }}>
              Unable to load sharing settings for this design.
            </div>
            <Button variant="secondary" size="sm" onClick={loadShareLink}>
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* General Access Box */}
            <div
              style={{
                backgroundColor: "#111114",
                border: "1px solid #27272a",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  General Access
                </span>
                {isUpdating && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#3b82f6" }}>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Updating...</span>
                  </div>
                )}
              </div>

              {/* Mode Selectors */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Restricted Option */}
                <div
                  onClick={() => !isUpdating && isLinkEnabled && handleUpdate(false, currentPermission)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 0.875rem",
                    borderRadius: "8px",
                    border: `1px solid ${!isLinkEnabled ? "#3b82f6" : "#27272a"}`,
                    backgroundColor: !isLinkEnabled ? "rgba(59, 130, 246, 0.08)" : "#18181b",
                    cursor: isUpdating ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        backgroundColor: !isLinkEnabled ? "rgba(59, 130, 246, 0.2)" : "#27272a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: !isLinkEnabled ? "#3b82f6" : "#a1a1aa",
                      }}
                    >
                      <Lock size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#f4f4f5" }}>
                        Restricted
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#a1a1aa" }}>
                        Only workspace members can open this design
                      </div>
                    </div>
                  </div>
                  {!isLinkEnabled && (
                    <Badge variant="primary" size="sm">
                      Active
                    </Badge>
                  )}
                </div>

                {/* Anyone with the link Option */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    padding: "0.75rem 0.875rem",
                    borderRadius: "8px",
                    border: `1px solid ${isLinkEnabled ? "#3b82f6" : "#27272a"}`,
                    backgroundColor: isLinkEnabled ? "rgba(59, 130, 246, 0.08)" : "#18181b",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    onClick={() => !isUpdating && !isLinkEnabled && handleUpdate(true, currentPermission)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: isUpdating ? "not-allowed" : "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          backgroundColor: isLinkEnabled ? "rgba(59, 130, 246, 0.2)" : "#27272a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isLinkEnabled ? "#3b82f6" : "#a1a1aa",
                        }}
                      >
                        <Globe size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#f4f4f5" }}>
                          Anyone with the link
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#a1a1aa" }}>
                          Anyone with this enabled link can access
                        </div>
                      </div>
                    </div>
                    {isLinkEnabled && (
                      <Badge variant="success" size="sm">
                        Enabled
                      </Badge>
                    )}
                  </div>

                  {/* Sub-controls when Anyone with the link is selected */}
                  {isLinkEnabled && (
                    <div
                      style={{
                        paddingTop: "0.625rem",
                        borderTop: "1px solid rgba(39, 39, 42, 0.8)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "0.8125rem", color: "#d4d4d8" }}>
                        Link Permission:
                      </span>

                      {/* Permission Switcher */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          backgroundColor: "#0d0d10",
                          borderRadius: "8px",
                          border: "1px solid #27272a",
                          padding: "2px",
                        }}
                      >
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleUpdate(true, "view")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: currentPermission === "view" ? 600 : 400,
                            color: currentPermission === "view" ? "#ffffff" : "#a1a1aa",
                            backgroundColor: currentPermission === "view" ? "#3b82f6" : "transparent",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <Eye size={13} />
                          <span>Viewer</span>
                        </button>

                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleUpdate(true, "edit")}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: currentPermission === "edit" ? 600 : 400,
                            color: currentPermission === "edit" ? "#ffffff" : "#a1a1aa",
                            backgroundColor: currentPermission === "edit" ? "#3b82f6" : "transparent",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <Edit3 size={13} />
                          <span>Editor</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Link Details and Actions (Only visible when link sharing is enabled) */}
            {isLinkEnabled && shareLink && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  backgroundColor: "#111114",
                  border: "1px solid #27272a",
                  borderRadius: "10px",
                  padding: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Shareable Link
                  </span>
                  <span style={{ fontSize: "11px", color: currentPermission === "edit" ? "#60a5fa" : "#34d399" }}>
                    {currentPermission === "edit" ? "Recipients must log in to edit" : "No sign-in required to view"}
                  </span>
                </div>

                {/* Link Bar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    backgroundColor: "#0d0d10",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    padding: "6px 8px",
                  }}
                >
                  <Link2 size={16} style={{ color: "#71717a", flexShrink: 0 }} />
                  <input
                    type="text"
                    readOnly
                    value={getShareUrl(shareLink.token)}
                    style={{
                      flex: 1,
                      backgroundColor: "transparent",
                      border: "none",
                      color: "#e4e4e7",
                      fontSize: "12px",
                      outline: "none",
                      fontFamily: "monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  />
                  <Button
                    variant={isCopied ? "outline" : "primary"}
                    size="xs"
                    onClick={handleCopyLink}
                    icon={isCopied ? <Check size={14} style={{ color: "#10b981" }} /> : <Copy size={14} />}
                  >
                    <span style={{ color: isCopied ? "#10b981" : undefined }}>
                      {isCopied ? "Copied!" : "Copy link"}
                    </span>
                  </Button>

                </div>

                {/* Rotate / Regenerate Token */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.25rem" }}>
                  {!showRegenerateConfirm ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => setShowRegenerateConfirm(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#a1a1aa",
                        fontSize: "11px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: 0,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#f4f4f5")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
                    >
                      <RotateCcw size={12} />
                      <span>Rotate or regenerate link</span>
                    </button>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        width: "100%",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: "11px", color: "#f87171" }}>
                        Regenerating revokes old link immediately.
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Button
                          variant="danger"
                          size="xs"
                          disabled={isUpdating}
                          onClick={() => handleUpdate(true, currentPermission, true)}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => setShowRegenerateConfirm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
};

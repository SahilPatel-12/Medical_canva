"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, getBrowserSupabaseClient } from "@design-platform/auth";
import { SupabaseWorkspaceRepository } from "@design-platform/database";
import { InvitationDetails } from "@design-platform/types";
import { Button, Badge } from "@design-platform/ui";
import {
  Sparkles,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ShieldCheck,
  LogOut,
  Mail,
} from "lucide-react";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default function InviteAcceptancePage({ params }: InvitePageProps) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;

  const router = useRouter();
  const { user, switchWorkspace, refreshWorkspace, signOut, isLoading: isAuthLoading } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(true);
  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successAccepted, setSuccessAccepted] = useState<boolean>(false);

  useEffect(() => {
    async function fetchInvite() {
      if (!token) return;
      setIsLoadingDetails(true);
      setErrorMessage(null);

      try {
        const client = getBrowserSupabaseClient();
        const repo = new SupabaseWorkspaceRepository({ client });
        const details = await repo.getInvitationDetails(token);

        if (!details) {
          setErrorMessage("This invitation could not be found or has already been revoked.");
        } else {
          setInvitation(details);
        }
      } catch (err) {
        setErrorMessage((err as Error).message || "Failed to load invitation.");
      } finally {
        setIsLoadingDetails(false);
      }
    }

    fetchInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setIsAccepting(true);
    setErrorMessage(null);

    try {
      const client = getBrowserSupabaseClient();
      const repo = new SupabaseWorkspaceRepository({ client });
      const acceptedWorkspaceId = await repo.acceptInvitation(token);

      setSuccessAccepted(true);
      await refreshWorkspace();
      await switchWorkspace(acceptedWorkspaceId);

      setTimeout(() => {
        router.push("/files");
      }, 1200);
    } catch (err) {
      setErrorMessage((err as Error).message || "Failed to accept invitation.");
      setIsAccepting(false);
    }
  };

  const handleSignOutAndSwitch = async () => {
    await signOut();
    router.push(`/login?redirect=/invite/${token}`);
  };

  const userEmail = user?.email?.toLowerCase().trim();
  const invitedEmail = invitation?.email?.toLowerCase().trim();
  const isEmailMatch = userEmail && invitedEmail && userEmail === invitedEmail;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#09090b",
        color: "#f4f4f5",
        padding: "1.5rem",
        fontFamily: "inherit",
      }}
    >
      {/* Brand Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "2rem" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: "0 2px 10px rgba(59, 130, 246, 0.4)",
          }}
        >
          <Sparkles size={20} />
        </div>
        <span style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#f4f4f5" }}>
          BioCanvas
        </span>
      </div>

      {/* Main Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#141417",
          border: "1px solid #27272a",
          borderRadius: "16px",
          padding: "2rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Loading State */}
        {(isLoadingDetails || isAuthLoading) && (
          <div style={{ textAlign: "center", padding: "2rem 0", color: "#71717a" }}>
            <p style={{ margin: 0, fontSize: "0.875rem" }}>Verifying invitation details...</p>
          </div>
        )}

        {/* Error / Invalid State */}
        {!isLoadingDetails && errorMessage && !invitation && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1rem" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <XCircle size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
                Invitation Invalid
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#a1a1aa", margin: 0 }}>
                {errorMessage}
              </p>
            </div>
            <Link href="/files" style={{ textDecoration: "none", width: "100%" }}>
              <Button variant="secondary" size="md" style={{ width: "100%" }}>
                Return to My Files
              </Button>
            </Link>
          </div>
        )}

        {/* Expired State */}
        {!isLoadingDetails && invitation && invitation.status === "expired" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1rem" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "rgba(234, 179, 8, 0.1)",
                color: "#eab308",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
                Invitation Expired
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#a1a1aa", margin: 0 }}>
                This invitation to join <strong>{invitation.workspaceName}</strong> expired on {new Date(invitation.expiresAt).toLocaleDateString()}. Please request a new invitation from the workspace administrator.
              </p>
            </div>
            <Link href="/files" style={{ textDecoration: "none", width: "100%" }}>
              <Button variant="secondary" size="md" style={{ width: "100%" }}>
                Return to My Files
              </Button>
            </Link>
          </div>
        )}

        {/* Success Accepted State */}
        {successAccepted && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "1rem" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                color: "#22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
                Welcome to {invitation?.workspaceName}!
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "#a1a1aa", margin: 0 }}>
                You have successfully joined as an <strong>{invitation?.role}</strong>. Redirecting to workspace designs...
              </p>
            </div>
          </div>
        )}

        {/* Valid Pending Invitation View */}
        {!isLoadingDetails && invitation && invitation.status === "pending" && !successAccepted && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Header info */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#27272a",
                  color: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1rem",
                }}
              >
                <Users size={24} />
              </div>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#f4f4f5" }}>
                Join {invitation.workspaceName}
              </h1>
              <p style={{ fontSize: "0.8125rem", color: "#a1a1aa", margin: 0 }}>
                You have been invited to collaborate with the role of:
              </p>
              <div style={{ marginTop: "0.75rem" }}>
                <Badge
                  variant={
                    invitation.role === "admin"
                      ? "warning"
                      : invitation.role === "editor"
                      ? "success"
                      : "outline"
                  }
                  size="md"
                >
                  {invitation.role.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Error Message inside Card */}
            {errorMessage && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  color: "#f87171",
                  fontSize: "0.8125rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <AlertTriangle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Scenario A: User Not Signed In */}
            {!user && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    padding: "0.875rem",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    fontSize: "0.8125rem",
                    color: "#a1a1aa",
                  }}
                >
                  This invitation was sent to <strong style={{ color: "#f4f4f5" }}>{invitation.email}</strong>. Please sign in with this email to accept.
                </div>
                <Link
                  href={`/login?redirect=/invite/${token}`}
                  style={{ textDecoration: "none", width: "100%" }}
                >
                  <Button variant="primary" size="md" style={{ width: "100%" }} icon={<Mail size={16} />}>
                    Sign In to Accept
                  </Button>
                </Link>
                <Link
                  href={`/signup?redirect=/invite/${token}`}
                  style={{ textDecoration: "none", width: "100%" }}
                >
                  <Button variant="secondary" size="md" style={{ width: "100%" }}>
                    Create Account
                  </Button>
                </Link>
              </div>
            )}

            {/* Scenario B: User Signed In with Matching Email */}
            {user && isEmailMatch && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    padding: "0.875rem",
                    backgroundColor: "rgba(34, 197, 94, 0.08)",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.625rem",
                  }}
                >
                  <ShieldCheck size={18} style={{ color: "#22c55e", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.8125rem", color: "#dcfce7" }}>
                    Verified as <strong>{user.email}</strong>. Ready to accept!
                  </span>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  id="accept-invitation-btn"
                  disabled={isAccepting}
                  onClick={handleAccept}
                  style={{ width: "100%" }}
                  icon={<ArrowRight size={16} />}
                >
                  {isAccepting ? "Joining Workspace..." : "Accept Invitation & Join Workspace"}
                </Button>
              </div>
            )}

            {/* Scenario C: User Signed In with Different Email (Mismatch) */}
            {user && !isEmailMatch && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    padding: "0.875rem",
                    backgroundColor: "rgba(234, 179, 8, 0.08)",
                    border: "1px solid rgba(234, 179, 8, 0.25)",
                    borderRadius: "8px",
                    fontSize: "0.8125rem",
                    color: "#fef08a",
                    lineHeight: 1.4,
                  }}
                >
                  This invitation is for <strong style={{ color: "#ffffff" }}>{invitation.email}</strong>, but you are currently signed in as <strong style={{ color: "#ffffff" }}>{user.email}</strong>.
                </div>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleSignOutAndSwitch}
                  id="switch-account-btn"
                  style={{ width: "100%" }}
                  icon={<LogOut size={16} />}
                >
                  Sign Out & Switch Account
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

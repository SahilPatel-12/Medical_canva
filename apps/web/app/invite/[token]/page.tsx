"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, getBrowserSupabaseClient } from "@design-platform/auth";
import { SupabaseWorkspaceRepository } from "@design-platform/database";
import { InvitationDetails } from "@design-platform/types";
import { AuthShell, authStyles as styles } from "../../../features/auth/AuthShell";
import {
  Loader2,
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
    router.push(`/login?redirectTo=${encodeURIComponent(`/invite/${token}`)}`);
  };

  const userEmail = user?.email?.toLowerCase().trim();
  const invitedEmail = invitation?.email?.toLowerCase().trim();
  const isEmailMatch = userEmail && invitedEmail && userEmail === invitedEmail;

  const loginHref = `/login?redirectTo=${encodeURIComponent(`/invite/${token}`)}`;
  const signupHref = `/signup?redirectTo=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <AuthShell
      brandTitle={
        <>
          Your team is <span>waiting for you</span>
        </>
      }
      brandLead="Join a shared BioCanvas workspace to design figures, slides and patient materials together."
      benefits={["See and edit your team’s designs", "Real-time editing with your team", "Roles keep unpublished work private"]}
    >
      {(isLoadingDetails || isAuthLoading) && (
        <div className={styles.loadingRow} role="status">
          <Loader2 size={20} className={styles.spin} /> Checking your invitation…
        </div>
      )}

      {/* Invalid / not found */}
      {!isLoadingDetails && errorMessage && !invitation && (
        <>
          <div className={`${styles.stateIcon} ${styles.stateError}`}>
            <XCircle size={28} />
          </div>
          <h1 className={styles.title}>Invitation not valid</h1>
          <p className={styles.subtitle}>{errorMessage}</p>
          <div className={styles.stack}>
            <Link href="/files" className={styles.secondary}>
              Go to my designs
            </Link>
          </div>
        </>
      )}

      {/* Expired */}
      {!isLoadingDetails && invitation && invitation.status === "expired" && (
        <>
          <div className={`${styles.stateIcon} ${styles.stateWarn}`}>
            <AlertTriangle size={28} />
          </div>
          <h1 className={styles.title}>This invitation has expired</h1>
          <p className={styles.subtitle}>
            The invitation to join <strong>{invitation.workspaceName}</strong> expired on{" "}
            {new Date(invitation.expiresAt).toLocaleDateString()}. Ask a workspace admin to send you a new one.
          </p>
          <div className={styles.stack}>
            <Link href="/files" className={styles.secondary}>
              Go to my designs
            </Link>
          </div>
        </>
      )}

      {/* Accepted */}
      {successAccepted && (
        <>
          <div className={`${styles.stateIcon} ${styles.stateNeutral}`}>
            <CheckCircle2 size={28} />
          </div>
          <h1 className={styles.title}>Welcome to {invitation?.workspaceName}!</h1>
          <p className={styles.subtitle}>
            You joined as <strong>{invitation?.role}</strong>. Taking you to the workspace designs…
          </p>
        </>
      )}

      {/* Pending invitation */}
      {!isLoadingDetails && !isAuthLoading && invitation && invitation.status === "pending" && !successAccepted && (
        <>
          <div className={`${styles.stateIcon} ${styles.stateNeutral}`}>
            <Users size={28} />
          </div>
          <h1 className={styles.title}>Join {invitation.workspaceName}</h1>
          <p className={styles.subtitle}>You’ve been invited to collaborate in this BioCanvas workspace.</p>
          <span className={styles.roleBadge}>
            <ShieldCheck size={15} /> {invitation.role}
          </span>

          {errorMessage && (
            <div className={`${styles.alert} ${styles.alertError}`} role="alert" style={{ marginTop: 22 }}>
              <AlertTriangle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {!user && (
            <>
              <div className={styles.note}>
                This invitation was sent to <strong>{invitation.email}</strong>. Log in or create an account with that email to accept it.
              </div>
              <div className={styles.stack}>
                <Link href={loginHref} className={styles.submitLink}>
                  <Mail size={18} /> Log in to accept
                </Link>
                <Link href={signupHref} className={styles.secondary}>
                  Create an account
                </Link>
              </div>
            </>
          )}

          {user && isEmailMatch && (
            <>
              <div className={styles.note}>
                Signed in as <strong>{user.email}</strong> — you’re all set.
              </div>
              <div className={styles.stack}>
                <button
                  type="button"
                  id="accept-invitation-btn"
                  className={styles.submit}
                  style={{ marginTop: 0 }}
                  disabled={isAccepting}
                  onClick={handleAccept}
                >
                  {isAccepting ? (
                    <>
                      <Loader2 size={18} className={styles.spin} /> Joining…
                    </>
                  ) : (
                    <>
                      Accept & join workspace <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {user && !isEmailMatch && (
            <>
              <div className={styles.note}>
                This invitation is for <strong>{invitation.email}</strong>, but you’re signed in as <strong>{user.email}</strong>.
              </div>
              <div className={styles.stack}>
                <button type="button" id="switch-account-btn" className={styles.secondary} onClick={handleSignOutAndSwitch}>
                  <LogOut size={18} /> Sign out & switch account
                </button>
              </div>
            </>
          )}
        </>
      )}
    </AuthShell>
  );
}

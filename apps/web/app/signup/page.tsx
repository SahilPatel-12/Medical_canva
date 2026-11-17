"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@design-platform/auth";
import { Mail, Lock, User as UserIcon, ArrowRight, AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { AuthShell, AuthField, authStyles as styles, passwordStrength } from "../../features/auth/AuthShell";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/files";

  const { user, signUp, isLoading: authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo);
    }
  }, [user, authLoading, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setConfirmationNotice(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signUp({
        email: cleanEmail,
        password,
        displayName: displayName.trim() || undefined,
      });

      if (res.error) {
        setErrorMessage(res.error.message);
      } else if (res.data) {
        // If session was created, user is automatically logged in
        if (res.data.session) {
          router.push(redirectTo);
        } else {
          // If no session, Supabase email confirmation is enabled on the project
          setConfirmationNotice(
            `Account successfully created! Please check your inbox at ${cleanEmail} to confirm your email before signing in.`
          );
        }
      }
    } catch (err) {
      setErrorMessage((err as Error)?.message || "Failed to create account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const strength = passwordStrength(password);
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const loginHref = redirectTo !== "/files" ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : "/login";

  return (
    <AuthShell
      brandTitle={
        <>
          Make figures your <span>patients and peers</span> understand
        </>
      }
      brandLead="Create your workspace in seconds and start turning complex science into clear visuals."
      benefits={[
        "Accurate biomedical illustrations to start from",
        "Edit any part — recolor, move, label",
        "Invite your lab, care team or class",
      ]}
      switchPrompt={
        <>
          Already have an account?{" "}
          <Link href={loginHref} className={styles.switchLink}>
            Log in
          </Link>
        </>
      }
    >
      <h1 className={styles.title}>Create your account</h1>
      <p className={styles.subtitle}>Join BioCanvas — it takes less than a minute.</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {errorMessage && (
          <div className={`${styles.alert} ${styles.alertError}`} role="alert">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}
        {confirmationNotice && (
          <div className={`${styles.alert} ${styles.alertSuccess}`} role="status">
            <CheckCircle2 size={18} />
            <span>{confirmationNotice}</span>
          </div>
        )}

        <AuthField
          id="displayName"
          label="Full name"
          hint="Optional"
          type="text"
          icon={<UserIcon size={18} />}
          placeholder="Dr. Maya Kim"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={isSubmitting}
          autoFocus
        />
        <AuthField
          id="email"
          label="Work email"
          type="email"
          icon={<Mail size={18} />}
          placeholder="name@university.edu"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
        />
        <div className={styles.field}>
          <AuthField
            id="password"
            label="Password"
            hint="At least 6 characters"
            type="password"
            icon={<Lock size={18} />}
            placeholder="Create a password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
          />
          {password && (
            <div className={styles.strength} aria-live="polite">
              <div className={styles.strengthBars}>
                {[1, 2, 3, 4].map((i) => (
                  <i key={i} style={{ background: i <= strength.score ? strength.color : undefined }} />
                ))}
              </div>
              <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
            </div>
          )}
        </div>
        <div className={styles.field}>
          <AuthField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            icon={<ShieldCheck size={18} />}
            placeholder="Repeat your password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
            aria-invalid={mismatch}
          />
          {mismatch && (
            <span className={styles.hint} style={{ color: "#dc2626" }}>
              Passwords don’t match yet
            </span>
          )}
        </div>

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 size={18} className={styles.spin} /> Creating your account…
            </>
          ) : (
            <>
              Create account <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <p className={styles.foot}>
        Already have an account? <Link href={loginHref}>Log in</Link>
      </p>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />}>
      <SignupContent />
    </Suspense>
  );
}

"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@design-platform/auth";
import { Sparkles, Mail, Lock, User as UserIcon, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#09090b",
        padding: "1.5rem",
        color: "#f4f4f5",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "#121215",
          border: "1px solid #27272a",
          borderRadius: "16px",
          padding: "2.5rem 2rem",
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header with Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 4px 16px rgba(59, 130, 246, 0.4)",
              marginBottom: "1rem",
            }}
          >
            <Sparkles size={24} />
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem 0", letterSpacing: "-0.02em" }}>
            Create your account
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "0.875rem", margin: 0 }}>
            Join BioCanvas to start illustrating scientific figures
          </p>
        </div>

        {/* Confirmation Notice */}
        {confirmationNotice && (
          <div
            style={{
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              color: "#4ade80",
              borderRadius: "8px",
              padding: "1rem",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.625rem",
              marginBottom: "1.5rem",
              lineHeight: 1.5,
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <p style={{ margin: "0 0 0.5rem 0", fontWeight: 600 }}>Check your inbox</p>
              <p style={{ margin: "0 0 0.75rem 0", color: "#bbf7d0" }}>{confirmationNotice}</p>
              <Link
                href="/login"
                style={{
                  color: "#ffffff",
                  textDecoration: "underline",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                }}
              >
                Go to login page &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              fontSize: "0.8125rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              marginBottom: "1.25rem",
              lineHeight: 1.4,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {!confirmationNotice && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
            <div>
              <label
                htmlFor="displayName"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#d4d4d8",
                  marginBottom: "0.375rem",
                }}
              >
                Full name / Display name
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <UserIcon
                  size={16}
                  style={{
                    position: "absolute",
                    left: "0.875rem",
                    color: "#71717a",
                    pointerEvents: "none",
                  }}
                />
                <input
                  id="displayName"
                  type="text"
                  placeholder="Dr. Jane Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    height: "42px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    padding: "0 1rem 0 2.5rem",
                    fontSize: "0.875rem",
                    color: "#ffffff",
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s ease",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.target.style.borderColor = "#27272a")}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#d4d4d8",
                  marginBottom: "0.375rem",
                }}
              >
                Email address
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Mail
                  size={16}
                  style={{
                    position: "absolute",
                    left: "0.875rem",
                    color: "#71717a",
                    pointerEvents: "none",
                  }}
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@institution.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    height: "42px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    padding: "0 1rem 0 2.5rem",
                    fontSize: "0.875rem",
                    color: "#ffffff",
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s ease",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.target.style.borderColor = "#27272a")}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#d4d4d8",
                  marginBottom: "0.375rem",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Lock
                  size={16}
                  style={{
                    position: "absolute",
                    left: "0.875rem",
                    color: "#71717a",
                    pointerEvents: "none",
                  }}
                />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    height: "42px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    padding: "0 1rem 0 2.5rem",
                    fontSize: "0.875rem",
                    color: "#ffffff",
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s ease",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.target.style.borderColor = "#27272a")}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#d4d4d8",
                  marginBottom: "0.375rem",
                }}
              >
                Confirm password
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Lock
                  size={16}
                  style={{
                    position: "absolute",
                    left: "0.875rem",
                    color: "#71717a",
                    pointerEvents: "none",
                  }}
                />
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    height: "42px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "8px",
                    padding: "0 1rem 0 2.5rem",
                    fontSize: "0.875rem",
                    color: "#ffffff",
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.15s ease",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.target.style.borderColor = "#27272a")}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                height: "42px",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                marginTop: "0.5rem",
                transition: "background-color 0.15s ease",
                opacity: isSubmitting ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = "#1d4ed8";
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.currentTarget.style.backgroundColor = "#2563eb";
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <span>Create account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Link */}
        <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.8125rem", color: "#a1a1aa" }}>
          Already have an account?{" "}
          <Link
            href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
            style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#09090b" }} />}>
      <SignupContent />
    </Suspense>
  );
}

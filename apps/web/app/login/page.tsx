"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@design-platform/auth";
import { Sparkles, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/files";

  const { user, signIn, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in, redirect to intended target
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo);
    }
  }, [user, authLoading, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Please enter your email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn({ email: cleanEmail, password });
      if (res.error) {
        if (res.error.message.toLowerCase().includes("invalid login credentials")) {
          setErrorMessage("Invalid email or password. Please verify your credentials.");
        } else if (res.error.message.toLowerCase().includes("email not confirmed")) {
          setErrorMessage("Please confirm your email address before logging in. Check your inbox.");
        } else {
          setErrorMessage(res.error.message);
        }
      } else {
        router.push(redirectTo);
      }
    } catch (err) {
      setErrorMessage((err as Error)?.message || "Failed to sign in. Please try again.");
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
          maxWidth: "420px",
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
            Welcome back
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "0.875rem", margin: 0 }}>
            Sign in to access your BioCanvas designs and figures
          </p>
        </div>

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

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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
                placeholder="name@example.com"
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
              <label
                htmlFor="password"
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#d4d4d8",
                }}
              >
                Password
              </label>
            </div>
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
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
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
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.8125rem", color: "#a1a1aa" }}>
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
            style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#09090b" }} />}>
      <LoginContent />
    </Suspense>
  );
}

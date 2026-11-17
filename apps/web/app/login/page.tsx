"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@design-platform/auth";
import { Mail, Lock, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { AuthShell, AuthField, authStyles as styles } from "../../features/auth/AuthShell";

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

  const signupHref = redirectTo !== "/files" ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}` : "/signup";

  return (
    <AuthShell
      brandTitle={
        <>
          Welcome back to <span>clearer science</span>
        </>
      }
      brandLead="Pick up where you left off — your figures, pages and team are waiting."
      benefits={[
        "Editable scientific illustrations",
        "Multi-page figures, slides and handouts",
        "Real-time collaboration with your lab",
      ]}
      switchPrompt={
        <>
          New to BioCanvas?{" "}
          <Link href={signupHref} className={styles.switchLink}>
            Create an account
          </Link>
        </>
      }
    >
      <h1 className={styles.title}>Log in</h1>
      <p className={styles.subtitle}>Sign in to open your BioCanvas designs and figures.</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        {errorMessage && (
          <div className={`${styles.alert} ${styles.alertError}`} role="alert">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <AuthField
          id="email"
          label="Email address"
          type="email"
          icon={<Mail size={18} />}
          placeholder="name@hospital.org"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
          autoFocus
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          icon={<Lock size={18} />}
          placeholder="Your password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
        />

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 size={18} className={styles.spin} /> Signing in…
            </>
          ) : (
            <>
              Log in <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <p className={styles.foot}>
        Don’t have an account? <Link href={signupHref}>Sign up free</Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />}>
      <LoginContent />
    </Suspense>
  );
}

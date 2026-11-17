"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import styles from "./auth.module.css";
import {
  AntibodyIllustration,
  BrandMark,
  CellIllustration,
  DnaIllustration,
  VirionIllustration,
} from "../marketing/illustrations";

export { styles as authStyles };

interface AuthShellProps {
  /** Big headline on the brand side; wrap the highlight in <span> */
  brandTitle: React.ReactNode;
  brandLead: string;
  benefits: string[];
  /** Link shown at the top right of the form side, e.g. "New here? Create an account" */
  switchPrompt?: React.ReactNode;
  children: React.ReactNode;
}

/** Split layout: dark brand story on the left, the form on the right */
export const AuthShell: React.FC<AuthShellProps> = ({ brandTitle, brandLead, benefits, switchPrompt, children }) => (
  <div className={styles.shell}>
    <aside className={styles.brand} aria-label="About BioCanvas">
      <div className={styles.brandGrid} />
      <Link href="/" className={styles.logo}>
        <BrandMark size={32} />
        BioCanvas
      </Link>
      <div className={styles.brandBody}>
        <h2 className={styles.brandTitle}>{brandTitle}</h2>
        <p className={styles.brandLead}>{brandLead}</p>
        <ul className={styles.benefits}>
          {benefits.map((b) => (
            <li key={b}>
              <span className={styles.benefitIcon}>
                <Check size={16} />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <div className={styles.collage} aria-hidden>
          <div className={`${styles.glass} ${styles.glassA}`}>
            <CellIllustration />
          </div>
          <div className={`${styles.glass} ${styles.glassB}`}>
            <VirionIllustration />
          </div>
          <div className={`${styles.glass} ${styles.glassC}`}>
            <AntibodyIllustration />
          </div>
          <div className={`${styles.glass} ${styles.glassD}`}>
            <DnaIllustration />
          </div>
        </div>
      </div>
      <div className={styles.brandFoot}>The visual workspace for medical and life-science communication.</div>
    </aside>

    <main className={styles.formSide}>
      <div className={styles.topLinks}>
        <Link href="/">
          <ArrowLeft size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
          Home
        </Link>
        {switchPrompt && <span>{switchPrompt}</span>}
      </div>
      <div className={styles.formWrap}>
        <Link href="/" className={styles.mobileLogo}>
          <BrandMark size={30} />
          BioCanvas
        </Link>
        {children}
      </div>
    </main>
  </div>
);

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: React.ReactNode;
  hint?: React.ReactNode;
}

/** Labeled input with a leading icon; password fields get a show/hide toggle */
export const AuthField: React.FC<FieldProps> = ({ label, icon, hint, id, type, ...rest }) => {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      <div className={styles.control}>
        <span className={styles.controlIcon}>{icon}</span>
        <input id={id} className={styles.input} type={isPassword && visible ? "text" : type} {...rest} />
        {isPassword && (
          <button
            type="button"
            className={styles.reveal}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            title={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
    </div>
  );
};

/** Simple password strength (length + character variety) */
export function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "#e2e8f0" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Too short", color: "#ef4444" },
    { label: "Weak", color: "#f97316" },
    { label: "Fair", color: "#eab308" },
    { label: "Good", color: "#10b981" },
    { label: "Strong", color: "#047857" },
  ];
  const s = pw.length < 6 ? 0 : Math.max(1, score);
  return { score: s, ...levels[s]! };
}

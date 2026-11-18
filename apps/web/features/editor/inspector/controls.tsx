"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Ban } from "lucide-react";

// ==========================================
// Shared editing controls (inspector panel + contextual toolbar)
// Styles live in globals.css under `.ui-*`.
// ==========================================

// ---------- Popover (portal, fixed, flips to stay on screen) ----------

export interface PopoverProps {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Preferred side; flips when there is no room */
  placement?: "bottom" | "top";
  align?: "start" | "center" | "end";
  width?: number;
  label?: string;
}

export const Popover: React.FC<PopoverProps> = ({
  anchor,
  open,
  onClose,
  children,
  placement = "bottom",
  align = "start",
  width = 248,
  label,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const h = ref.current?.offsetHeight || 280;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const below = r.bottom + 8;
      const above = r.top - 8 - h;
      let top = placement === "bottom" ? below : above;
      if (placement === "bottom" && below + h > vh - 8 && above > 8) top = above;
      if (placement === "top" && above < 8) top = below;
      let left = align === "start" ? r.left : align === "end" ? r.right - width : r.left + r.width / 2 - width / 2;
      left = Math.max(8, Math.min(vw - width - 8, left));
      const el = ref.current;
      if (el) {
        el.style.top = `${Math.max(8, Math.min(vh - h - 8, top))}px`;
        el.style.left = `${left}px`;
        el.style.visibility = "visible";
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, placement, align, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, anchor, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="ui-popover"
      style={{ width, top: 0, left: 0, visibility: "hidden" }}
    >
      {children}
    </div>,
    document.body
  );
};

// ---------- Color picking ----------

export const DEFAULT_COLORS = [
  "#ffffff", "#f1f5f9", "#94a3b8", "#475569", "#1e293b", "#000000",
  "#fee2e2", "#ef4444", "#b91c1c", "#ffedd5", "#f97316", "#c2410c",
  "#fef9c3", "#f59e0b", "#b45309", "#dcfce7", "#22c55e", "#15803d",
  "#ccfbf1", "#14b8a6", "#0f766e", "#cffafe", "#06b6d4", "#0e7490",
  "#dbeafe", "#3b82f6", "#1d4ed8", "#ede9fe", "#8b5cf6", "#6d28d9",
  "#fce7f3", "#ec4899", "#be185d",
];

const isNone = (c?: string) => !c || c === "none" || c === "transparent";

export const normalizeHex = (c?: string): string => {
  if (!c) return "";
  const v = c.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return v;
};

export interface ColorPanelProps {
  value?: string;
  onChange: (color: string) => void;
  /** Colors already used in the design (shown first) */
  documentColors?: string[];
  allowNone?: boolean;
}

export const ColorPanel: React.FC<ColorPanelProps> = ({ value, onChange, documentColors, allowNone }) => {
  const current = normalizeHex(value);
  // The hex box shows a draft only while it is being typed in; otherwise it follows the value.
  // (The panel must never remount on change, or an open color picker would close mid-drag.)
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const hex = hexDraft ?? (isNone(value) ? "" : current.toUpperCase());

  const commitHex = () => {
    const raw = (hexDraft ?? "").trim();
    setHexDraft(null);
    if (!raw) return;
    const v = raw.startsWith("#") ? raw : `#${raw}`;
    if ((/^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)) && normalizeHex(v) !== current) onChange(normalizeHex(v));
  };

  const swatch = (c: string, key: string) => (
    <button
      key={key}
      type="button"
      className={`ui-swatch${normalizeHex(c) === current ? " is-selected" : ""}`}
      style={{ background: c }}
      onClick={() => onChange(c)}
      title={c}
      aria-label={c}
    />
  );

  const docColors = (documentColors || []).filter((c, i, all) => all.indexOf(c) === i).slice(0, 14);

  return (
    <div className="ui-color-panel">
      {docColors.length > 0 && (
        <>
          <div className="ui-color-heading">In this design</div>
          <div className="ui-swatch-grid">{docColors.map((c, i) => swatch(c, `d${i}`))}</div>
        </>
      )}
      <div className="ui-color-heading">Colors</div>
      <div className="ui-swatch-grid">
        {allowNone && (
          <button
            type="button"
            className={`ui-swatch ui-swatch--none${isNone(value) ? " is-selected" : ""}`}
            onClick={() => onChange("none")}
            title="No color"
            aria-label="No color"
          >
            <Ban size={14} />
          </button>
        )}
        {DEFAULT_COLORS.map((c) => swatch(c, c))}
      </div>
      <div className="ui-color-custom">
        <label className="ui-color-native" title="Pick any color">
          <span className="ui-swatch ui-swatch--rainbow" aria-hidden>
            <Plus size={14} />
          </span>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/.test(current) ? current : "#3b82f6"}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Custom color"
          />
        </label>
        <input
          className="ui-input ui-hex"
          value={hex}
          placeholder="#000000"
          spellCheck={false}
          onFocus={() => setHexDraft(hex)}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setHexDraft(null);
              e.currentTarget.blur();
            }
          }}
          aria-label="Hex color"
        />
      </div>
    </div>
  );
};

export interface ColorButtonProps extends ColorPanelProps {
  label: string;
  /** Show the hex value next to the swatch */
  showValue?: boolean;
  /** Outline-style chip (a ring instead of a filled square) */
  variant?: "fill" | "stroke";
  size?: "sm" | "md";
  placement?: "bottom" | "top";
  disabled?: boolean;
  /** Label for "no single value" (default: "Original") */
  mixedLabel?: string;
}

/** A swatch that opens the color panel */
export const ColorButton: React.FC<ColorButtonProps> = ({
  label,
  value,
  onChange,
  documentColors,
  allowNone,
  showValue,
  variant = "fill",
  size = "md",
  placement = "bottom",
  disabled,
  mixedLabel = "Original",
}) => {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  // Without a value: "None" where none is a valid choice, otherwise the artwork's own colors
  const mixed = !value && !allowNone;
  const none = !mixed && isNone(value);
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        disabled={disabled}
        className={`ui-color-button ui-color-button--${size}${showValue ? " has-value" : ""}${open ? " is-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={`${label}: ${mixed ? "original colors" : none ? "none" : value}`}
        aria-label={label}
        aria-expanded={open}
      >
        <span
          className={`ui-chip ui-chip--${variant}${none ? " is-none" : ""}${mixed ? " is-mixed" : ""}`}
          style={
            mixed || none ? undefined : variant === "fill" ? { background: value } : { borderColor: value }
          }
        />
        {showValue && (
          <span className={`ui-color-value${mixed ? " is-muted" : ""}`}>
            {mixed ? mixedLabel : none ? "None" : normalizeHex(value).toUpperCase()}
          </span>
        )}
      </button>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} placement={placement} label={label}>
        <div className="ui-popover-title">{label}</div>
        <ColorPanel
          value={value}
          onChange={onChange}
          documentColors={documentColors}
          allowNone={allowNone}
        />
      </Popover>
    </>
  );
};

// ---------- Inputs ----------

export interface NumberFieldProps {
  label: string;
  /** Short label shown inside the field (e.g. "X", "W", "°") */
  prefix?: React.ReactNode;
  suffix?: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  /** Several values at once (e.g. a selection with mixed font sizes): shows "Mixed" */
  mixed?: boolean;
}

/** Numeric input: commits on Enter / blur; ↑/↓ step (Shift ×10) */
export const NumberField: React.FC<NumberFieldProps> = ({
  label,
  prefix,
  suffix,
  value,
  onCommit,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision = 0,
  disabled,
  mixed = false,
}) => {
  const fmt = (n: number) => {
    const f = Math.pow(10, precision);
    return String(Math.round(n * f) / f);
  };
  // While editing, the field shows the draft; otherwise it always reflects the value
  const [draft, setDraft] = useState(fmt(value));
  const [focused, setFocused] = useState(false);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (isNaN(n)) {
      setDraft(mixed ? "" : fmt(value));
      return;
    }
    const next = clamp(n);
    setDraft(fmt(next));
    if (mixed || Math.abs(next - value) > 1e-9) onCommit(next);
  };

  return (
    <label className={`ui-number${disabled ? " is-disabled" : ""}`} title={label}>
      {prefix !== undefined && <span className="ui-number-prefix">{prefix}</span>}
      <input
        className="ui-number-input"
        inputMode="decimal"
        value={focused ? draft : mixed ? "" : fmt(value)}
        placeholder={mixed ? "Mixed" : undefined}
        disabled={disabled}
        aria-label={label}
        onFocus={(e) => {
          setDraft(mixed ? "" : fmt(value));
          setFocused(true);
          const input = e.currentTarget;
          requestAnimationFrame(() => input.select());
        }}
        onBlur={(e) => {
          setFocused(false);
          commit(e.currentTarget.value);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(e.currentTarget.value);
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(fmt(value));
            e.currentTarget.blur();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const base = parseFloat(e.currentTarget.value);
            const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            const next = clamp((isNaN(base) ? value : base) + delta);
            setDraft(fmt(next));
            onCommit(next);
          }
        }}
      />
      {suffix && <span className="ui-number-suffix">{suffix}</span>}
    </label>
  );
};

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** Slider with a precise number box next to it */
export const SliderField: React.FC<SliderFieldProps> = ({ label, value, min, max, step = 1, suffix, onChange, disabled }) => {
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <div className={`ui-slider-field${disabled ? " is-disabled" : ""}`}>
      <div className="ui-row-label">{label}</div>
      <div className="ui-slider-row">
        <input
          type="range"
          className="ui-slider"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          style={{ "--ui-pct": `${Math.max(0, Math.min(100, pct))}%` } as React.CSSProperties}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <div className="ui-slider-number">
          <NumberField
            label={label}
            value={value}
            min={min}
            max={max}
            step={step}
            precision={step < 1 ? 1 : 0}
            suffix={suffix}
            onCommit={onChange}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

// ---------- Buttons ----------

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  tone?: "default" | "danger";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, active, tone = "default", className, children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`ui-icon-button${tone === "danger" ? " is-danger" : ""}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </button>
  )
);
IconButton.displayName = "IconButton";

// ---------- Layout ----------

export interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Small control shown on the right of the title (e.g. "Reset") */
  action?: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({ title, children, defaultOpen = true, action }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`ui-section${open ? " is-open" : ""}`}>
      <div className="ui-section-head">
        <button type="button" className="ui-section-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <ChevronDown size={14} className="ui-section-caret" />
          <span>{title}</span>
        </button>
        {action}
      </div>
      {open && <div className="ui-section-body">{children}</div>}
    </section>
  );
};

export const FieldLabel: React.FC<{ children: React.ReactNode; hint?: React.ReactNode }> = ({ children, hint }) => (
  <div className="ui-row-label">
    <span>{children}</span>
    {hint && <span className="ui-row-hint">{hint}</span>}
  </div>
);

"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LINES, SHAPES, type ElementTemplate } from "./panels/elementTemplates";
import { textBoxTemplate } from "./panels/LeftPanels";
import { KeyboardIcon } from "./icons/EditorIcons";

// ==========================================
// Keyboard shortcuts: one-key inserts (T, R, C, L, A…) and the "?" help sheet.
// Editing / selection / zoom keys live in useEditor; they are listed here so the
// help sheet shows everything in one place.
// ==========================================

const templateOf = (list: typeof SHAPES, id: string): ElementTemplate => list.find((i) => i.id === id)!.template;

export interface InsertShortcut {
  keys: string[];
  label: string;
  template: () => ElementTemplate;
  /** Text boxes start in typing mode */
  startEditing?: boolean;
}

/** Single keys (no modifiers) that add an element to the page */
export const INSERT_SHORTCUTS: InsertShortcut[] = [
  { keys: ["t"], label: "Text box", template: textBoxTemplate, startEditing: true },
  { keys: ["r"], label: "Rectangle", template: () => templateOf(SHAPES, "rect") },
  { keys: ["c", "o"], label: "Circle", template: () => templateOf(SHAPES, "circle") },
  { keys: ["l"], label: "Line", template: () => templateOf(LINES, "line") },
  { keys: ["a"], label: "Arrow", template: () => templateOf(LINES, "arrow") },
];

const isMac = () => typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/** "mod+shift+Z" → "⌘⇧Z" on Mac, "Ctrl+Shift+Z" elsewhere */
export function formatKeys(spec: string): string[] {
  const mac = isMac();
  const names: Record<string, [string, string]> = {
    mod: ["⌘", "Ctrl"],
    shift: ["⇧", "Shift"],
    alt: ["⌥", "Alt"],
    del: ["⌫", "Delete"],
    enter: ["↩", "Enter"],
    esc: ["Esc", "Esc"],
    space: ["Space", "Space"],
    arrows: ["← ↑ → ↓", "← ↑ → ↓"],
    plus: ["+", "+"],
    minus: ["−", "−"],
  };
  return spec.split("+").map((k) => (names[k] ? names[k]![mac ? 0 : 1] : k.length === 1 ? k.toUpperCase() : k));
}

interface ShortcutRow {
  label: string;
  /** Alternatives, e.g. ["c", "o"]; each is a "+"-joined key spec */
  keys: string[];
  /** Mouse gesture instead of keys */
  gesture?: string;
}

export const SHORTCUT_GROUPS: Array<{ title: string; rows: ShortcutRow[] }> = [
  {
    title: "Add to page",
    rows: INSERT_SHORTCUTS.map((s) => ({ label: s.label, keys: s.keys })),
  },
  {
    title: "Edit",
    rows: [
      { label: "Undo", keys: ["mod+Z"] },
      { label: "Redo", keys: ["mod+shift+Z"] },
      { label: "Cut", keys: ["mod+X"] },
      { label: "Copy", keys: ["mod+C"] },
      { label: "Paste", keys: ["mod+V"] },
      { label: "Duplicate", keys: ["mod+D"] },
      { label: "Delete", keys: ["del"] },
      { label: "Lock / unlock", keys: ["mod+L"] },
      { label: "Flip horizontal", keys: ["shift+H"] },
      { label: "Flip vertical", keys: ["shift+V"] },
      { label: "Bring forward", keys: ["mod+]"] },
      { label: "Send backward", keys: ["mod+["] },
      { label: "Bring to front", keys: ["alt+mod+]"] },
      { label: "Send to back", keys: ["alt+mod+["] },
      { label: "Nudge 1 px", keys: ["arrows"] },
      { label: "Nudge 10 px", keys: ["shift+arrows"] },
    ],
  },
  {
    title: "Select",
    rows: [
      { label: "Select all", keys: ["mod+A"] },
      { label: "Add to selection", keys: [], gesture: "Shift + click" },
      { label: "Select an area", keys: [], gesture: "Drag on empty canvas" },
      { label: "Deselect / leave group", keys: ["esc"] },
      { label: "Edit text / edit parts", keys: ["enter"] },
      { label: "Select parent group", keys: ["shift+enter"] },
      { label: "Select deepest part", keys: [], gesture: isMac() ? "⌘ + click" : "Ctrl + click" },
      { label: "Group illustrations", keys: ["mod+G"] },
      { label: "Split illustration", keys: ["mod+shift+G"] },
    ],
  },
  {
    title: "View",
    rows: [
      { label: "Zoom in", keys: ["mod+plus"] },
      { label: "Zoom out", keys: ["mod+minus"] },
      { label: "Zoom to 100%", keys: ["mod+0"] },
      { label: "Fit page to screen", keys: ["shift+1", "mod+9"] },
      { label: "Move around", keys: [], gesture: "Space + drag" },
      { label: "Search assets", keys: ["/"] },
      { label: "Save", keys: ["mod+S"] },
      { label: "Show shortcuts", keys: ["?"] },
    ],
  },
];

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
};

export interface UseEditorShortcutsOptions {
  enabled: boolean;
  onInsert: (template: ElementTemplate, startEditing: boolean) => void;
  onOpenHelp: () => void;
}

/** One-key inserts and "?" for the help sheet (ignored while typing) */
export function useEditorShortcuts({ enabled, onInsert, onOpenHelp }: UseEditorShortcutsOptions): void {
  const latest = useRef({ enabled, onInsert, onOpenHelp });
  useLayoutEffect(() => {
    latest.current = { enabled, onInsert, onOpenHelp };
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target)) return;
      const { enabled: on, onInsert: insert, onOpenHelp: help } = latest.current;
      // "?" (Shift+/) or Cmd/Ctrl+/ opens the help sheet, also in view-only mode
      if ((e.key === "?" && !e.metaKey && !e.ctrlKey) || ((e.metaKey || e.ctrlKey) && e.key === "/")) {
        e.preventDefault();
        help();
        return;
      }
      if (!on || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return;
      // Inside a dialog or menu, letters belong to it
      if ((e.target as HTMLElement | null)?.closest?.('[role="dialog"], [role="menu"]')) return;
      const key = e.key.toLowerCase();
      const shortcut = INSERT_SHORTCUTS.find((s) => s.keys.includes(key));
      if (!shortcut) return;
      e.preventDefault();
      insert(shortcut.template(), Boolean(shortcut.startEditing));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

// ------------------------------------------
// Help sheet
// ------------------------------------------

const Keys: React.FC<{ spec: string }> = ({ spec }) => (
  <span className="ks-combo">
    {formatKeys(spec).map((k, i) => (
      <kbd key={i} className="ks-key">
        {k}
      </kbd>
    ))}
  </span>
);

export const KeyboardShortcutsDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Esc closes the sheet only (the selection stays)
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [open, onClose]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SHORTCUT_GROUPS;
    return SHORTCUT_GROUPS.map((g) => ({
      ...g,
      rows: g.rows.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          g.title.toLowerCase().includes(q) ||
          r.keys.some((k) => formatKeys(k).join("").toLowerCase().includes(q))
      ),
    })).filter((g) => g.rows.length > 0);
  }, [query]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="ks-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} className="ks-panel" role="dialog" aria-modal="true" aria-labelledby="ks-title">
        <div className="ks-head">
          <span className="ks-head-icon">
            <KeyboardIcon size={20} />
          </span>
          <div className="ks-head-text">
            <h2 id="ks-title">Keyboard shortcuts</h2>
            <p>Work faster: press a key to add, edit and move around.</p>
          </div>
          <button type="button" className="ks-close" onClick={onClose} aria-label="Close shortcuts">
            ×
          </button>
        </div>
        <div className="ks-search">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shortcuts…"
            aria-label="Search shortcuts"
          />
        </div>
        <div className="ks-body">
          {groups.length === 0 && <div className="ks-empty">No shortcut matches “{query}”.</div>}
          {groups.map((group) => (
            <section key={group.title} className="ks-group">
              <h3>{group.title}</h3>
              <ul>
                {group.rows.map((row) => (
                  <li key={row.label}>
                    <span className="ks-label">{row.label}</span>
                    <span className="ks-keys">
                      {row.gesture ? (
                        <span className="ks-gesture">{row.gesture}</span>
                      ) : (
                        row.keys.map((k, i) => (
                          <React.Fragment key={k}>
                            {i > 0 && <span className="ks-or">or</span>}
                            <Keys spec={k} />
                          </React.Fragment>
                        ))
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

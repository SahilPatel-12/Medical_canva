"use client";

import React, { createContext, useContext } from "react";
import type { DesignElement, TextProperties } from "@design-platform/types";
import {
  TEXT_STYLE_UI_ATTR,
  rangeStyle,
  replaceTextKeepingStyles,
  styleAll,
  type RangeStyle,
  type TextEditSelection,
  type TextStylePatch,
} from "@design-platform/editor";
import { Bold, Italic, Strikethrough, Subscript, Superscript, Underline } from "lucide-react";
import { IconButton } from "../inspector/controls";

// ==========================================
// Rich text styling for the toolbar and the inspector.
// While a text box is being typed in, controls style the selected characters (or the
// whole text when nothing is selected); otherwise they style the whole text box.
// ==========================================

export interface TextStyleApi {
  textEdit: TextEditSelection | null;
  applyTextStyle: (elementId: string, patch: TextStylePatch) => void;
  updateTextBox: (elementId: string, patch: Partial<TextProperties>) => void;
  setTextContent: (elementId: string, text: string) => void;
}

export const TextStyleContext = createContext<TextStyleApi | null>(null);

/** Spread on containers of text style controls: clicking them keeps the typing session */
export const textStyleUiProps = {
  [TEXT_STYLE_UI_ATTR]: "",
  // Buttons must not take focus from the text being typed (inputs and selects still may)
  onMouseDown: (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest("input, select, textarea, [contenteditable='true']")) e.preventDefault();
  },
} as const;

export interface TextStyleTarget {
  /** Style of the selection (typing) or of the whole text */
  style: RangeStyle;
  /** Typing in this text box right now */
  editing: boolean;
  /** Characters selected while typing (0 = caret only → controls style the whole text) */
  selectedCount: number;
  apply: (patch: TextStylePatch) => void;
  updateBox: (patch: Partial<TextProperties>) => void;
  setText: (text: string) => void;
}

/** Style target for one text element; falls back to whole-element updates without a provider */
export function useTextStyleTarget(
  el: DesignElement,
  onUpdateElement: (id: string, updates: Partial<DesignElement>) => void
): TextStyleTarget {
  const api = useContext(TextStyleContext);
  const p = el.properties as TextProperties;
  const edit = api?.textEdit && api.textEdit.elementId === el.id ? api.textEdit : null;
  return {
    style: edit ? edit.style : rangeStyle(p),
    editing: Boolean(edit),
    selectedCount: edit ? edit.end - edit.start : 0,
    apply: (patch) =>
      api ? api.applyTextStyle(el.id, patch) : onUpdateElement(el.id, { properties: styleAll(p, patch) }),
    updateBox: (patch) =>
      api ? api.updateTextBox(el.id, patch) : onUpdateElement(el.id, { properties: { ...p, ...patch } }),
    setText: (text) =>
      api ? api.setTextContent(el.id, text) : onUpdateElement(el.id, { properties: replaceTextKeepingStyles(p, text) }),
  };
}

const isOn = (v: unknown, on: unknown) => v === on;

/** Bold · Italic · Underline · Strikethrough · Superscript · Subscript */
export const TextFormatButtons: React.FC<{ target: TextStyleTarget; size?: number; compact?: boolean }> = ({
  target,
  size = 16,
  compact = false,
}) => {
  const s = target.style;
  const mod = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";
  const bold = isOn(s.fontWeight, "bold") || isOn(s.fontWeight, "600");
  const buttons: Array<{ label: string; active: boolean; mixed: boolean; icon: React.ReactNode; patch: TextStylePatch }> = [
    { label: `Bold (${mod}B)`, active: bold, mixed: s.fontWeight === "mixed", icon: <Bold size={size} />, patch: { fontWeight: bold ? "normal" : "bold" } },
    { label: `Italic (${mod}I)`, active: s.fontStyle === "italic", mixed: s.fontStyle === "mixed", icon: <Italic size={size} />, patch: { fontStyle: s.fontStyle === "italic" ? "normal" : "italic" } },
    { label: `Underline (${mod}U)`, active: s.underline === true, mixed: s.underline === "mixed", icon: <Underline size={size} />, patch: { underline: s.underline !== true } },
    { label: "Strikethrough", active: s.strike === true, mixed: s.strike === "mixed", icon: <Strikethrough size={size} />, patch: { strike: s.strike !== true } },
    { label: `Superscript (${mod}.)`, active: s.script === "super", mixed: false, icon: <Superscript size={size} />, patch: { script: s.script === "super" ? "normal" : "super" } },
    { label: `Subscript (${mod},)`, active: s.script === "sub", mixed: false, icon: <Subscript size={size} />, patch: { script: s.script === "sub" ? "normal" : "sub" } },
  ];
  return (
    <>
      {buttons.map((b, i) => (
        <React.Fragment key={b.label}>
          {compact && i === 4 && <span className="ctb-sep ctb-sep--thin" />}
          <IconButton
            label={b.mixed ? `${b.label} — mixed` : b.label}
            active={b.active}
            className={b.mixed ? "is-mixed" : undefined}
            onClick={() => target.apply(b.patch)}
          >
            {b.icon}
          </IconButton>
        </React.Fragment>
      ))}
    </>
  );
};

/** "Styling 5 selected characters" / "Styling all the text" while typing */
export const TextScopeHint: React.FC<{ target: TextStyleTarget }> = ({ target }) =>
  target.editing ? (
    <div className="insp-text-scope" role="status">
      {target.selectedCount > 0
        ? `Styling ${target.selectedCount} selected character${target.selectedCount === 1 ? "" : "s"}`
        : "No text selected: changes apply to all the text"}
    </div>
  ) : null;

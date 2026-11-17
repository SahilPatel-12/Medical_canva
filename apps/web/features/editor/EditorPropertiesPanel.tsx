"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  DesignDocument,
  DesignElement,
  LineCap,
  ShapeProperties,
  TextProperties,
  SvgProperties,
  getPageBackground,
} from "@design-platform/types";
import {
  extractSvgColors,
  fetchSvgMarkup,
  getSvgLayer,
  getSvgLayerChildren,
  SCIENTIFIC_COLOR_PRESETS,
} from "@design-platform/editor";
import {
  ArrowLeft,
  Link2,
  Unlink2,
  RotateCcw,
  RotateCw,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Minus,
  Plus,
  ChevronRight,
  Check,
} from "lucide-react";
import {
  BringForwardIcon,
  BringToFrontIcon,
  DeleteIcon,
  DuplicateIcon,
  EditPartsIcon,
  GoInsideIcon,
  IllustrationIcon,
  ImageIcon,
  LockIcon,
  PageIcon,
  SelectParentIcon,
  SendBackwardIcon,
  SendToBackIcon,
  ShapeIcon,
  TextIcon,
  UngroupIcon,
  UnlockIcon,
} from "./icons/EditorIcons";
import {
  ColorButton,
  FieldLabel,
  IconButton,
  NumberField,
  Section,
  SliderField,
  normalizeHex,
} from "./inspector/controls";
import { MultiSelectionActions, MultiSelectionInspector } from "./inspector/MultiSelection";

export interface EditorPropertiesPanelProps {
  document: DesignDocument;
  selectedElement: DesignElement | null;
  activePageIndex?: number;
  onUpdateElement: (id: string, updates: Partial<DesignElement>) => void;
  /** Without an id, acts on the selected part of an illustration when one is selected */
  onDeleteElement: (id?: string) => void;
  onDuplicateElement: (id?: string) => void;
  onBringForward: (id?: string) => void;
  onSendBackward: (id?: string) => void;
  onBringToFront: (id?: string) => void;
  onSendToBack: (id?: string) => void;
  /** Recolors the whole illustration, or only the selected part when one is selected */
  onUpdateSvgColor: (fill?: string, stroke?: string, strokeWidth?: number) => void;
  onUpdateSvgColorMap?: (colorMap: Record<string, string>) => void;
  onUpdateSvgComponentColor?: (
    componentIdOrIndex: string | number,
    colors: { fill?: string; stroke?: string }
  ) => void;
  onApplyScientificPreset?: (presetIdOrPreset: string, componentIdOrIndex?: string | number) => void;
  /** Splits the illustration into separate canvas objects */
  onDistributeSvgComponents?: () => void;
  onResetSvgColors?: () => void;
  groupEditSession?: {
    groupId: string;
    groupName: string;
    breadcrumb?: string[];
    selectedLayerName?: string | null;
    selectedLayerPath?: number[] | null;
    selectedLayerIsGroup?: boolean;
  } | null;
  /** Opens the illustration's parts (or goes inside the selected part when it is a group) */
  onEnterGroupEdit?: (id?: string) => void;
  /** Goes up one level */
  onExitGroupEdit?: () => void;
  /** Leaves parts editing (the whole illustration stays selected) */
  onExitAllGroupEdits?: () => void;
  /** Dissolves the selected part group into its children */
  onUngroupLayer?: () => void;
  /** Background of every page */
  onSetCanvasBackground: (color: string) => void;
  /** Background of the active page only (without it, colors apply to every page) */
  onSetPageBackground?: (color: string) => void;
  /** Present when several elements are selected */
  multi?: MultiSelectionActions | null;
  embedded?: boolean;
  onBackToLibrary?: () => void;
}

const FONT_FAMILIES = [
  { label: "Inter", value: "Inter, -apple-system, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

const PAGE_BACKGROUNDS = ["#ffffff", "#f8fafc", "#f0f9ff", "#f0fdf4", "#f5f3ff", "#fff7ed", "#e2e8f0", "#1e293b", "#0f172a"];

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  svg: { label: "Illustration", icon: <IllustrationIcon size={20} /> },
  shape: { label: "Shape", icon: <ShapeIcon size={20} /> },
  text: { label: "Text", icon: <TextIcon size={20} /> },
  image: { label: "Image", icon: <ImageIcon size={20} /> },
};

const svgMarkupOf = (el: DesignElement | null): string => {
  if (!el || el.type !== "svg") return "";
  const p = el.properties as SvgProperties;
  const m = p.svgContent || p.originalSvg || "";
  return m.includes("<svg") ? m : "";
};

export const EditorPropertiesPanel: React.FC<EditorPropertiesPanelProps> = (props) => {
  const { document, selectedElement, activePageIndex = 0, embedded = false, onBackToLibrary } = props;
  const el = selectedElement;

  // Remote SVGs: fetch the markup once so colors and parts can be edited
  useEffect(() => {
    if (!el || el.type !== "svg") return;
    const p = el.properties as SvgProperties;
    const src = p.svgContent || p.originalSvg || "";
    if ((src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) && !src.includes("<svg")) {
      fetchSvgMarkup(src).then((markup) => {
        if (markup && markup.includes("<svg")) {
          props.onUpdateElement(el.id, { properties: { ...p, originalSvg: markup, svgContent: markup } });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el?.id, (el?.properties as SvgProperties | undefined)?.svgContent]);

  // Colors already used on this page (offered first in every color picker)
  const pageElements = document.pages?.[activePageIndex]?.elements;
  const documentColors = useMemo(() => {
    const out: string[] = [];
    for (const item of pageElements || []) {
      const p = item.properties as Partial<ShapeProperties & TextProperties>;
      if (item.type === "shape" || item.type === "text") {
        if (p.fill && p.fill.startsWith("#")) out.push(normalizeHex(p.fill));
        if (p.stroke && p.stroke.startsWith("#")) out.push(normalizeHex(p.stroke));
      }
    }
    return out;
  }, [pageElements]);

  return (
    <div className={`insp${embedded ? " insp--embedded" : ""}`}>
      {onBackToLibrary && (
        <div className="insp-topbar">
          <button type="button" className="insp-back" onClick={onBackToLibrary}>
            <ArrowLeft size={15} />
            Library
          </button>
        </div>
      )}
      {props.multi && props.multi.elements.length > 1 ? (
        <MultiSelectionInspector actions={props.multi} />
      ) : !el ? (
        <PageInspector {...props} />
      ) : (
        <ElementInspector key={el.id} {...props} element={el} documentColors={documentColors} />
      )}
    </div>
  );
};

// ==========================================
// Nothing selected: page settings
// ==========================================

const PageInspector: React.FC<EditorPropertiesPanelProps> = ({
  document,
  activePageIndex = 0,
  onSetCanvasBackground,
  onSetPageBackground,
}) => {
  const page = document.pages?.[activePageIndex];
  const pages = document.pages || [];
  const bg = getPageBackground(document, activePageIndex);
  // Colors go to this page; "Apply to all pages" copies it to the rest
  const setBg = onSetPageBackground || onSetCanvasBackground;
  const allSame = pages.every((_, i) => normalizeHex(getPageBackground(document, i)) === normalizeHex(bg));
  return (
    <>
      <div className="insp-header">
        <span className="insp-type-icon">
          <PageIcon size={20} />
        </span>
        <div className="insp-heading">
          <div className="insp-title">Page {activePageIndex + 1}</div>
          <div className="insp-subtitle">
            {document.width} × {document.height} px · {page?.elements.length || 0} elements
          </div>
        </div>
      </div>

      <div className="insp-empty-hint">
        <EditPartsIcon size={18} />
        <span>Select something on the page to edit it.</span>
      </div>

      <Section title={pages.length > 1 ? `Background · Page ${activePageIndex + 1}` : "Background"}>
        <div className="insp-row">
          <ColorButton label="Page background" value={bg} onChange={setBg} showValue />
        </div>
        <div className="insp-bg-grid">
          {PAGE_BACKGROUNDS.map((c) => (
            <button
              key={c}
              type="button"
              className={`ui-swatch ui-swatch--lg${normalizeHex(bg) === c ? " is-selected" : ""}`}
              style={{ background: c }}
              onClick={() => setBg(c)}
              title={c}
              aria-label={`Background ${c}`}
            />
          ))}
        </div>
        {onSetPageBackground && pages.length > 1 && (
          <button
            type="button"
            className="insp-link insp-link--block"
            disabled={allSame}
            onClick={() => onSetCanvasBackground(bg)}
            title={allSame ? "Every page already uses this color" : "Use this color on every page"}
          >
            {allSame ? "All pages use this color" : "Apply to all pages"}
          </button>
        )}
      </Section>
    </>
  );
};

// ==========================================
// Element selected
// ==========================================

interface ElementInspectorProps extends EditorPropertiesPanelProps {
  element: DesignElement;
  documentColors: string[];
}

const ElementInspector: React.FC<ElementInspectorProps> = (props) => {
  const { element: el, onUpdateElement, onDuplicateElement, onDeleteElement, groupEditSession } = props;
  const meta = TYPE_META[el.type] || { label: "Element", icon: <ShapeIcon size={20} /> };
  const markup = svgMarkupOf(el);
  const partCount = useMemo(() => (markup ? getSvgLayerChildren(markup, [])?.length || 0 : 0), [markup]);
  const inParts = el.type === "svg" && Boolean(groupEditSession);
  const [name, setName] = useState(el.name || "");
  const isLocked = Boolean(el.locked);

  const commitName = () => {
    const next = name.trim();
    if (next !== (el.name || "")) onUpdateElement(el.id, { name: next });
  };

  return (
    <>
      <div className="insp-header">
        <span className="insp-type-icon">{meta.icon}</span>
        <div className="insp-heading">
          <input
            className="insp-name"
            value={name}
            placeholder={meta.label}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label="Element name"
          />
          <div className="insp-subtitle">
            {meta.label}
            {el.type === "svg" && partCount > 1 ? ` · ${partCount} parts` : ""}
          </div>
        </div>
        <div className="insp-header-actions">
          <IconButton
            label={isLocked ? "Unlock" : "Lock position"}
            active={isLocked}
            onClick={() => onUpdateElement(el.id, { locked: !isLocked })}
          >
            {isLocked ? <LockIcon size={18} /> : <UnlockIcon size={18} />}
          </IconButton>
          <IconButton label="Duplicate (⌘D)" onClick={() => onDuplicateElement(el.id)}>
            <DuplicateIcon size={18} />
          </IconButton>
          <IconButton label="Delete" tone="danger" onClick={() => onDeleteElement(el.id)}>
            <DeleteIcon size={18} />
          </IconButton>
        </div>
      </div>

      {isLocked && (
        <div className="insp-banner">
          <LockIcon size={16} />
          <span>Locked — it can’t be moved or resized.</span>
          <button type="button" className="insp-link" onClick={() => onUpdateElement(el.id, { locked: false })}>
            Unlock
          </button>
        </div>
      )}

      {el.type === "svg" && inParts && <SvgPartInspector {...props} markup={markup} />}
      {el.type === "svg" && !inParts && <SvgInspector {...props} markup={markup} partCount={partCount} />}
      {el.type === "text" && <TextInspector {...props} />}
      {el.type === "shape" && <ShapeInspector {...props} />}

      {!inParts && (
        <>
          <PositionSection {...props} />
          <Section title="Appearance">
            <SliderField
              label="Opacity"
              value={Math.round((el.opacity ?? 1) * 100)}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => onUpdateElement(el.id, { opacity: v / 100 })}
            />
          </Section>
          <ArrangeSection {...props} />
        </>
      )}
    </>
  );
};

// ---------- Illustration (whole) ----------

const SvgInspector: React.FC<ElementInspectorProps & { markup: string; partCount: number }> = ({
  element: el,
  markup,
  partCount,
  documentColors,
  onEnterGroupEdit,
  onDistributeSvgComponents,
  onUpdateSvgColor,
  onUpdateSvgColorMap,
  onApplyScientificPreset,
  onResetSvgColors,
}) => {
  const p = el.properties as SvgProperties & { strokeWidth?: number };
  const [showAllColors, setShowAllColors] = useState(false);
  const [showAllPalettes, setShowAllPalettes] = useState(false);

  // The colors the artwork uses right now (attributes, styles, CSS classes, gradients)
  const colors = useMemo(() => (markup ? extractSvgColors(markup) : []), [markup]);
  const shownColors = showAllColors ? colors : colors.slice(0, 12);
  const illustrationColors = colors;

  const replaceColor = (current: string, next: string) => {
    if (normalizeHex(next) === current) return;
    if (onUpdateSvgColorMap) onUpdateSvgColorMap({ [current]: next });
  };

  const palettes = showAllPalettes ? SCIENTIFIC_COLOR_PRESETS : SCIENTIFIC_COLOR_PRESETS.slice(0, 6);
  const hasChanges = Boolean(p.originalSvg && p.svgContent && p.originalSvg !== p.svgContent);

  return (
    <>
      {partCount > 1 && (
        <div className="insp-card">
          <div className="insp-card-text">
            <div className="insp-card-title">Edit parts</div>
            <div className="insp-card-hint">Select, move and recolor any part. Tip: double-click it on the page.</div>
          </div>
          <div className="insp-card-actions">
            <button type="button" className="ui-button ui-button--primary" onClick={() => onEnterGroupEdit?.(el.id)}>
              <EditPartsIcon size={17} />
              Edit parts
            </button>
            {onDistributeSvgComponents && (
              <button
                type="button"
                className="ui-button"
                onClick={() => onDistributeSvgComponents()}
                title="Split the illustration into separate objects on the page"
              >
                <UngroupIcon size={17} />
                Ungroup
              </button>
            )}
          </div>
        </div>
      )}

      <Section
        title="Colors"
        action={
          hasChanges && onResetSvgColors ? (
            <button type="button" className="insp-link" onClick={() => onResetSvgColors()}>
              Reset
            </button>
          ) : undefined
        }
      >
        {colors.length > 0 && (
          <>
            <FieldLabel hint={`${colors.length}`}>Colors in this illustration</FieldLabel>
            <div className="insp-color-list">
              {shownColors.map((c, i) => (
                <ColorButton
                  // Keyed by position so an open picker stays open while its color changes
                  key={i}
                  label={`Replace ${c.toUpperCase()}`}
                  value={c}
                  onChange={(next) => replaceColor(c, next)}
                  documentColors={[...illustrationColors, ...documentColors]}
                  size="sm"
                />
              ))}
              {colors.length > 12 && (
                <button type="button" className="insp-more" onClick={() => setShowAllColors((v) => !v)}>
                  {showAllColors ? "Less" : `+${colors.length - 12}`}
                </button>
              )}
            </div>
          </>
        )}

        <FieldLabel>Recolor everything</FieldLabel>
        <div className="insp-row">
          <ColorButton
            label="Fill"
            value={p.fill}
            onChange={(c) => onUpdateSvgColor(c, undefined)}
            documentColors={[...illustrationColors, ...documentColors]}
            showValue
          />
          <ColorButton
            label="Outline"
            variant="stroke"
            value={p.stroke}
            onChange={(c) => onUpdateSvgColor(undefined, c)}
            documentColors={[...illustrationColors, ...documentColors]}
            showValue
          />
        </div>
        <SliderField
          label="Outline width"
          value={p.strokeWidth ?? 1}
          min={0}
          max={12}
          step={0.5}
          onChange={(w) => onUpdateSvgColor(undefined, undefined, w)}
        />

        <FieldLabel>Scientific palettes</FieldLabel>
        <div className="insp-palettes">
          {palettes.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="insp-palette"
              onClick={() => (onApplyScientificPreset ? onApplyScientificPreset(preset.id) : onUpdateSvgColor(preset.primary, preset.secondary))}
              title={preset.description}
            >
              <span className="insp-palette-dots">
                <span style={{ background: preset.tint }} />
                <span style={{ background: preset.primary }} />
                <span style={{ background: preset.secondary }} />
              </span>
              <span className="insp-palette-name">{preset.name}</span>
            </button>
          ))}
        </div>
        {SCIENTIFIC_COLOR_PRESETS.length > 6 && (
          <button type="button" className="insp-link insp-link--block" onClick={() => setShowAllPalettes((v) => !v)}>
            {showAllPalettes ? "Show fewer palettes" : `Show all ${SCIENTIFIC_COLOR_PRESETS.length} palettes`}
          </button>
        )}
      </Section>
    </>
  );
};

// ---------- Illustration: a part is selected ----------

const SvgPartInspector: React.FC<ElementInspectorProps & { markup: string }> = ({
  element: el,
  markup,
  groupEditSession,
  documentColors,
  onEnterGroupEdit,
  onExitGroupEdit,
  onExitAllGroupEdits,
  onUngroupLayer,
  onUpdateSvgColor,
  onDuplicateElement,
  onDeleteElement,
}) => {
  const path = groupEditSession?.selectedLayerPath || null;
  const layer = useMemo(() => (markup && path ? getSvgLayer(markup, path) : null), [markup, path]);
  const crumbs = groupEditSession?.breadcrumb?.length ? groupEditSession.breadcrumb : [el.name || "Illustration"];
  const partName = groupEditSession?.selectedLayerName || null;
  const isGroup = Boolean(groupEditSession?.selectedLayerIsGroup);
  const colorSuggestions = useMemo(
    () => [...(markup ? extractSvgColors(markup).map(normalizeHex) : []), ...documentColors],
    [markup, documentColors]
  );

  return (
    <>
      <div className="insp-card insp-card--parts">
        <div className="insp-crumbs" aria-label="Location">
          {crumbs.map((c, i) => (
            <React.Fragment key={`${c}-${i}`}>
              {i > 0 && <ChevronRight size={13} />}
              <span>{c}</span>
            </React.Fragment>
          ))}
          {partName && (
            <>
              <ChevronRight size={13} />
              <strong>{partName}</strong>
            </>
          )}
        </div>
        {!path && <div className="insp-card-hint">Click a part on the page to select it.</div>}
        <div className="insp-card-actions">
          {onExitGroupEdit && (
            <button type="button" className="ui-button" onClick={() => onExitGroupEdit()} title="Select the group around this part (Esc)">
              <SelectParentIcon size={17} />
              Parent
            </button>
          )}
          {isGroup && onEnterGroupEdit && (
            <button type="button" className="ui-button" onClick={() => onEnterGroupEdit(el.id)} title="Edit the parts inside (Enter)">
              <GoInsideIcon size={17} />
              Go inside
            </button>
          )}
          {onExitAllGroupEdits && (
            <button type="button" className="ui-button ui-button--primary" onClick={() => onExitAllGroupEdits()}>
              <Check size={15} />
              Done
            </button>
          )}
        </div>
      </div>

      {path && (
        <>
          <Section title={isGroup ? "Group colors" : "Part colors"}>
            <div className="insp-row">
              <ColorButton
                label="Fill"
                value={layer?.fill}
                onChange={(c) => onUpdateSvgColor(c, undefined)}
                documentColors={colorSuggestions}
                showValue
              />
              <ColorButton
                label="Outline"
                variant="stroke"
                value={layer?.stroke}
                onChange={(c) => onUpdateSvgColor(undefined, c)}
                documentColors={colorSuggestions}
                allowNone
                showValue
              />
            </div>
            <SliderField
              label="Outline width"
              value={layer?.strokeWidth ?? 1}
              min={0}
              max={12}
              step={0.5}
              onChange={(w) => onUpdateSvgColor(undefined, undefined, w)}
            />
            <FieldLabel>Scientific palettes</FieldLabel>
            <div className="insp-palettes">
              {SCIENTIFIC_COLOR_PRESETS.slice(0, 6).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="insp-palette"
                  onClick={() => onUpdateSvgColor(preset.primary, preset.secondary)}
                  title={preset.description}
                >
                  <span className="insp-palette-dots">
                    <span style={{ background: preset.tint }} />
                    <span style={{ background: preset.primary }} />
                    <span style={{ background: preset.secondary }} />
                  </span>
                  <span className="insp-palette-name">{preset.name}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title={isGroup ? "Group" : "Part"}>
            <div className="insp-action-grid">
              <button type="button" className="ui-button" onClick={() => onDuplicateElement(undefined)}>
                <DuplicateIcon size={17} />
                Duplicate
              </button>
              {isGroup && onUngroupLayer && (
                <button type="button" className="ui-button" onClick={() => onUngroupLayer()}>
                  <UngroupIcon size={17} />
                  Ungroup
                </button>
              )}
              <button type="button" className="ui-button ui-button--danger" onClick={() => onDeleteElement(undefined)}>
                <DeleteIcon size={17} />
                Delete
              </button>
            </div>
            <div className="insp-tip">
              Drag on the page to move or resize · Arrow keys nudge · Double-click to go deeper
            </div>
          </Section>
        </>
      )}
    </>
  );
};

// ---------- Text ----------

const TextInspector: React.FC<ElementInspectorProps> = ({ element: el, onUpdateElement, documentColors }) => {
  const p = el.properties as TextProperties;
  const set = (updates: Partial<TextProperties>) => onUpdateElement(el.id, { properties: { ...p, ...updates } });
  const size = p.fontSize || 24;
  const isBold = p.fontWeight === "bold" || p.fontWeight === "600";
  const family = FONT_FAMILIES.find((f) => f.value === p.fontFamily)?.value || p.fontFamily || FONT_FAMILIES[0]!.value;
  const [text, setText] = useState(p.text || "");

  return (
    <>
      <Section title="Text">
        <textarea
          className="ui-input insp-textarea"
          value={text}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== p.text && set({ text })}
          aria-label="Text content"
        />
      </Section>
      <Section title="Font">
        <select className="ui-input ui-select" value={family} onChange={(e) => set({ fontFamily: e.target.value })} aria-label="Font">
          {!FONT_FAMILIES.some((f) => f.value === family) && <option value={family}>{family.split(",")[0]}</option>}
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <div className="insp-row">
          <div className="insp-stepper">
            <IconButton label="Smaller" onClick={() => set({ fontSize: Math.max(6, size - 2) })}>
              <Minus size={14} />
            </IconButton>
            <NumberField label="Font size" value={size} min={6} max={400} onCommit={(v) => set({ fontSize: v })} />
            <IconButton label="Larger" onClick={() => set({ fontSize: Math.min(400, size + 2) })}>
              <Plus size={14} />
            </IconButton>
          </div>
          <ColorButton label="Text color" value={p.fill || "#18181b"} onChange={(c) => set({ fill: c })} documentColors={documentColors} />
        </div>
        <div className="insp-row">
          <div className="ui-segmented" role="group" aria-label="Style">
            <IconButton label="Bold" active={isBold} onClick={() => set({ fontWeight: isBold ? "normal" : "bold" })}>
              <Bold size={15} />
            </IconButton>
            <IconButton
              label="Italic"
              active={p.fontStyle === "italic"}
              onClick={() => set({ fontStyle: p.fontStyle === "italic" ? "normal" : "italic" })}
            >
              <Italic size={15} />
            </IconButton>
          </div>
          <div className="ui-segmented" role="group" aria-label="Alignment">
            {(
              [
                ["left", <AlignLeft key="l" size={15} />],
                ["center", <AlignCenter key="c" size={15} />],
                ["right", <AlignRight key="r" size={15} />],
              ] as const
            ).map(([a, icon]) => (
              <IconButton key={a} label={`Align ${a}`} active={(p.align || "left") === a} onClick={() => set({ align: a })}>
                {icon}
              </IconButton>
            ))}
          </div>
        </div>
        <SliderField
          label="Line spacing"
          value={p.lineHeight || 1.2}
          min={0.8}
          max={3}
          step={0.1}
          onChange={(v) => set({ lineHeight: v })}
        />
      </Section>
    </>
  );
};

// ---------- Shape ----------

const DASH_OPTIONS: Array<{ id: "solid" | "dashed" | "dotted"; label: string }> = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
];
const CAP_OPTIONS: Array<{ id: LineCap; label: string }> = [
  { id: "none", label: "None" },
  { id: "arrow", label: "Arrow" },
  { id: "bar", label: "Bar (inhibition)" },
  { id: "dot", label: "Dot" },
];

const DashIcon: React.FC<{ dash: "solid" | "dashed" | "dotted" }> = ({ dash }) => (
  <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden>
    <line
      x1="1"
      y1="5"
      x2="21"
      y2="5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap={dash === "dotted" ? "round" : "butt"}
      strokeDasharray={dash === "dashed" ? "5 3" : dash === "dotted" ? "0.1 4" : undefined}
    />
  </svg>
);

const CapIcon: React.FC<{ cap: LineCap; side: "start" | "end" }> = ({ cap, side }) => {
  const x = side === "end" ? 20 : 2;
  const d = side === "end" ? 1 : -1;
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden>
      <line x1={side === "end" ? 2 : 6} y1="7" x2={side === "end" ? 16 : 20} y2="7" stroke="currentColor" strokeWidth="2" />
      {cap === "arrow" && <path d={`M${x} 7 L${x - d * 6} 3 L${x - d * 6} 11 Z`} fill="currentColor" />}
      {cap === "bar" && <rect x={side === "end" ? x - 2 : x} y="2" width="2" height="10" fill="currentColor" />}
      {cap === "dot" && <circle cx={x - d * 2} cy="7" r="3" fill="currentColor" />}
    </svg>
  );
};

const ShapeInspector: React.FC<ElementInspectorProps> = ({ element: el, onUpdateElement, documentColors }) => {
  const p = el.properties as ShapeProperties;
  const set = (updates: Partial<ShapeProperties>) => onUpdateElement(el.id, { properties: { ...p, ...updates } });
  const isLine = p.shapeType === "line";
  const hasOutline = Boolean(p.stroke && p.stroke !== "transparent" && (p.strokeWidth || 0) > 0);

  if (isLine) {
    return (
      <Section title="Line">
        <div className="insp-row">
          <ColorButton label="Line color" value={p.fill} onChange={(c) => set({ fill: c })} documentColors={documentColors} showValue />
        </div>
        <SliderField label="Thickness" value={p.strokeWidth ?? 4} min={1} max={30} onChange={(v) => set({ strokeWidth: v })} />
        <FieldLabel>Style</FieldLabel>
        <div className="ui-segmented ui-segmented--full" role="group" aria-label="Line style">
          {DASH_OPTIONS.map((o) => (
            <IconButton key={o.id} label={o.label} active={(p.dash || "solid") === o.id} onClick={() => set({ dash: o.id })}>
              <DashIcon dash={o.id} />
            </IconButton>
          ))}
        </div>
        <div className="insp-grid-2">
          <div>
            <FieldLabel>Start</FieldLabel>
            <div className="ui-segmented ui-segmented--full" role="group" aria-label="Line start">
              {CAP_OPTIONS.map((o) => (
                <IconButton key={o.id} label={`Start: ${o.label}`} active={(p.startCap || "none") === o.id} onClick={() => set({ startCap: o.id })}>
                  <CapIcon cap={o.id} side="start" />
                </IconButton>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>End</FieldLabel>
            <div className="ui-segmented ui-segmented--full" role="group" aria-label="Line end">
              {CAP_OPTIONS.map((o) => (
                <IconButton key={o.id} label={`End: ${o.label}`} active={(p.endCap || "none") === o.id} onClick={() => set({ endCap: o.id })}>
                  <CapIcon cap={o.id} side="end" />
                </IconButton>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="insp-link insp-link--block"
          onClick={() => set({ startCap: p.endCap || "none", endCap: p.startCap || "none" })}
        >
          Swap ends
        </button>
      </Section>
    );
  }

  return (
    <Section title="Fill & outline">
      <div className="insp-row">
        <ColorButton
          label="Fill"
          value={p.fill === "transparent" ? "none" : p.fill}
          onChange={(c) => set({ fill: c === "none" ? "transparent" : c })}
          documentColors={documentColors}
          allowNone
          showValue
        />
        <ColorButton
          label="Outline"
          variant="stroke"
          value={hasOutline ? p.stroke : "none"}
          onChange={(c) =>
            set({ stroke: c === "none" ? "transparent" : c, strokeWidth: c !== "none" && !p.strokeWidth ? 4 : p.strokeWidth })
          }
          documentColors={documentColors}
          allowNone
          showValue
        />
      </div>
      {hasOutline && (
        <>
          <SliderField label="Outline width" value={p.strokeWidth ?? 0} min={1} max={40} onChange={(v) => set({ strokeWidth: v })} />
          <FieldLabel>Outline style</FieldLabel>
          <div className="ui-segmented ui-segmented--full" role="group" aria-label="Outline style">
            {DASH_OPTIONS.map((o) => (
              <IconButton key={o.id} label={o.label} active={(p.dash || "solid") === o.id} onClick={() => set({ dash: o.id })}>
                <DashIcon dash={o.id} />
              </IconButton>
            ))}
          </div>
        </>
      )}
      {p.shapeType === "rectangle" && (
        <SliderField
          label="Corner radius"
          value={p.cornerRadius || 0}
          min={0}
          max={Math.round(Math.min(el.width, el.height) / 2)}
          onChange={(v) => set({ cornerRadius: v })}
        />
      )}
    </Section>
  );
};

// ---------- Position & size ----------

const PositionSection: React.FC<ElementInspectorProps> = ({ element: el, document, onUpdateElement }) => {
  const [keepRatio, setKeepRatio] = useState(el.type === "svg" || el.type === "image");
  const locked = Boolean(el.locked);
  const set = (u: Partial<DesignElement>) => onUpdateElement(el.id, u);
  const r = (n: number) => Math.round(n);

  const align = (type: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (type === "left") set({ x: 0 });
    if (type === "center") set({ x: r((document.width - el.width) / 2) });
    if (type === "right") set({ x: r(document.width - el.width) });
    if (type === "top") set({ y: 0 });
    if (type === "middle") set({ y: r((document.height - el.height) / 2) });
    if (type === "bottom") set({ y: r(document.height - el.height) });
  };

  const resize = (dim: "width" | "height", v: number) => {
    const value = Math.max(1, v);
    if (!keepRatio || !el.width || !el.height) return set({ [dim]: value });
    const ratio = el.width / el.height;
    set(dim === "width" ? { width: value, height: r(value / ratio) } : { height: value, width: r(value * ratio) });
  };

  const rotation = Math.round(((el.rotation || 0) % 360 + 360) % 360);

  return (
    <Section title="Position & size">
      <FieldLabel>Align on page</FieldLabel>
      <div className="ui-segmented ui-segmented--full" role="group" aria-label="Align on page">
        <IconButton label="Align left" disabled={locked} onClick={() => align("left")}>
          <AlignStartVertical size={16} />
        </IconButton>
        <IconButton label="Center horizontally" disabled={locked} onClick={() => align("center")}>
          <AlignCenterVertical size={16} />
        </IconButton>
        <IconButton label="Align right" disabled={locked} onClick={() => align("right")}>
          <AlignEndVertical size={16} />
        </IconButton>
        <IconButton label="Align top" disabled={locked} onClick={() => align("top")}>
          <AlignStartHorizontal size={16} />
        </IconButton>
        <IconButton label="Center vertically" disabled={locked} onClick={() => align("middle")}>
          <AlignCenterHorizontal size={16} />
        </IconButton>
        <IconButton label="Align bottom" disabled={locked} onClick={() => align("bottom")}>
          <AlignEndHorizontal size={16} />
        </IconButton>
      </div>

      <div className="insp-grid-2">
        <NumberField label="X position" prefix="X" value={el.x} disabled={locked} onCommit={(v) => set({ x: v })} />
        <NumberField label="Y position" prefix="Y" value={el.y} disabled={locked} onCommit={(v) => set({ y: v })} />
      </div>
      <div className="insp-size-row">
        <NumberField label="Width" prefix="W" value={el.width} min={1} disabled={locked} onCommit={(v) => resize("width", v)} />
        <IconButton
          label={keepRatio ? "Proportions locked" : "Keep proportions"}
          active={keepRatio}
          onClick={() => setKeepRatio((k) => !k)}
          className="insp-ratio"
        >
          {keepRatio ? <Link2 size={15} /> : <Unlink2 size={15} />}
        </IconButton>
        <NumberField label="Height" prefix="H" value={el.height} min={1} disabled={locked} onCommit={(v) => resize("height", v)} />
      </div>
      <div className="insp-rotate-row">
        <NumberField
          label="Rotation"
          prefix={<RotateCw size={13} />}
          suffix="°"
          value={rotation}
          disabled={locked}
          onCommit={(v) => set({ rotation: ((v % 360) + 360) % 360 })}
        />
        <IconButton label="Rotate left 90°" disabled={locked} onClick={() => set({ rotation: (rotation + 270) % 360 })}>
          <RotateCcw size={15} />
        </IconButton>
        <IconButton label="Rotate right 90°" disabled={locked} onClick={() => set({ rotation: (rotation + 90) % 360 })}>
          <RotateCw size={15} />
        </IconButton>
        {rotation !== 0 && (
          <button type="button" className="insp-link" disabled={locked} onClick={() => set({ rotation: 0 })}>
            Reset
          </button>
        )}
      </div>
    </Section>
  );
};

// ---------- Layer order ----------

const ArrangeSection: React.FC<ElementInspectorProps> = ({ element: el, onBringForward, onSendBackward, onBringToFront, onSendToBack }) => (
  <Section title="Layer order">
    <div className="insp-action-grid">
      <button type="button" className="ui-button" onClick={() => onBringForward(el.id)}>
        <BringForwardIcon size={17} />
        Forward
      </button>
      <button type="button" className="ui-button" onClick={() => onSendBackward(el.id)}>
        <SendBackwardIcon size={17} />
        Backward
      </button>
      <button type="button" className="ui-button" onClick={() => onBringToFront(el.id)}>
        <BringToFrontIcon size={17} />
        To front
      </button>
      <button type="button" className="ui-button" onClick={() => onSendToBack(el.id)}>
        <SendToBackIcon size={17} />
        To back
      </button>
    </div>
  </Section>
);

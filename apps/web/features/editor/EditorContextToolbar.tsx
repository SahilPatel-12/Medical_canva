"use client";

import React, { useMemo, useState } from "react";
import { DesignElement, ShapeProperties, SvgProperties, TextProperties } from "@design-platform/types";
import { extractSvgColors, getSvgLayer, getSvgLayerChildren } from "@design-platform/editor";
import {
  Check,
  ChevronRight,
  Minus,
  Plus,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import {
  AdjustIcon,
  DeleteIcon,
  DuplicateIcon,
  EditPartsIcon,
  GoInsideIcon,
  IllustrationIcon,
  LockIcon,
  SelectParentIcon,
  TransparencyIcon,
  UngroupIcon,
  UnlockIcon,
} from "./icons/EditorIcons";
import { ColorButton, IconButton, Popover, SliderField, normalizeHex } from "./inspector/controls";
import { TextFormatButtons, textStyleUiProps, useTextStyleTarget } from "./text/TextStyle";

// ==========================================
// Contextual toolbar (Canva-style): the most used actions for the current selection,
// right above the canvas. Everything else lives in the inspector ("More").
// ==========================================

export interface EditorContextToolbarProps {
  element: DesignElement;
  groupEditSession?: {
    breadcrumb?: string[];
    selectedLayerName?: string | null;
    selectedLayerPath?: number[] | null;
    selectedLayerIsGroup?: boolean;
  } | null;
  onUpdateElement: (id: string, updates: Partial<DesignElement>) => void;
  onUpdateSvgColor: (fill?: string, stroke?: string, strokeWidth?: number) => void;
  onUpdateSvgColorMap: (colorMap: Record<string, string>) => void;
  onDuplicate: (id?: string) => void;
  onDelete: (id?: string) => void;
  onEnterGroupEdit: (id?: string) => void;
  onExitGroupEdit: () => void;
  onExitAllGroupEdits: () => void;
  onUngroupLayer: () => void;
  onSplitIllustration: () => void;
  /** Opens the full inspector panel */
  onOpenInspector: () => void;
}

const svgMarkupOf = (el: DesignElement) => {
  const p = el.properties as SvgProperties;
  const m = p.svgContent || p.originalSvg || "";
  return m.includes("<svg") ? m : "";
};

export const EditorContextToolbar: React.FC<EditorContextToolbarProps> = (props) => {
  const { element: el, groupEditSession, onDuplicate, onDelete, onUpdateElement, onOpenInspector } = props;
  const locked = Boolean(el.locked);
  const inParts = el.type === "svg" && Boolean(groupEditSession);

  if (inParts) return <PartsToolbar {...props} />;

  return (
    <div className="ctb" role="toolbar" aria-label={`${el.name || el.type} actions`}>
      {locked ? (
        <span className="ctb-note">
          <LockIcon size={15} /> Locked
        </span>
      ) : (
        <>
          {el.type === "svg" && <IllustrationTools {...props} />}
          {el.type === "shape" && <ShapeTools {...props} />}
          {el.type === "text" && <TextTools {...props} />}
          <OpacityTool {...props} />
          <span className="ctb-sep" />
        </>
      )}

      <IconButton
        label={locked ? "Unlock" : "Lock position"}
        active={locked}
        onClick={() => onUpdateElement(el.id, { locked: !locked })}
      >
        {locked ? <LockIcon size={18} /> : <UnlockIcon size={18} />}
      </IconButton>
      <IconButton label="Duplicate (⌘D)" onClick={() => onDuplicate(el.id)}>
        <DuplicateIcon size={18} />
      </IconButton>
      <IconButton label="Delete" tone="danger" onClick={() => onDelete(el.id)}>
        <DeleteIcon size={18} />
      </IconButton>
      <span className="ctb-sep" />
      <button type="button" className="ctb-button" onClick={onOpenInspector} title="All options: position, size, layer order…">
        <AdjustIcon size={17} />
        <span>More</span>
      </button>
    </div>
  );
};

// ---------- Illustration ----------

const IllustrationTools: React.FC<EditorContextToolbarProps> = ({
  element: el,
  onUpdateSvgColorMap,
  onEnterGroupEdit,
  onSplitIllustration,
  onOpenInspector,
}) => {
  const markup = svgMarkupOf(el);
  // The colors the artwork uses right now; picking a new one replaces it everywhere
  const colors = useMemo(() => (markup ? extractSvgColors(markup) : []), [markup]);
  const partCount = useMemo(() => (markup ? getSvgLayerChildren(markup, [])?.length || 0 : 0), [markup]);
  const shown = colors.slice(0, 5);

  return (
    <>
      {shown.length > 0 && (
        <div className="ctb-swatches" aria-label="Illustration colors">
          {shown.map((c, i) => (
            <ColorButton
              // Keyed by position so an open picker stays open while its color changes
              key={i}
              label={`Replace ${c.toUpperCase()}`}
              value={c}
              onChange={(next) => {
                if (normalizeHex(next) !== c) onUpdateSvgColorMap({ [c]: next });
              }}
              documentColors={colors}
              size="sm"
            />
          ))}
          {colors.length > 5 && (
            <button type="button" className="ctb-more-colors" onClick={onOpenInspector} title="All colors">
              +{colors.length - 5}
            </button>
          )}
        </div>
      )}
      <span className="ctb-sep" />
      {partCount > 1 && (
        <button
          type="button"
          className="ctb-button ctb-button--accent"
          onClick={() => onEnterGroupEdit(el.id)}
          title="Select, move and recolor individual parts (or double-click a part)"
        >
          <EditPartsIcon size={17} />
          <span>Edit parts</span>
        </button>
      )}
      {partCount > 1 && (
        <button
          type="button"
          className="ctb-button"
          onClick={onSplitIllustration}
          title="Split into separate objects on the page"
        >
          <UngroupIcon size={17} />
          <span>Ungroup</span>
        </button>
      )}
    </>
  );
};

// ---------- Shape ----------

const ShapeTools: React.FC<EditorContextToolbarProps> = ({ element: el, onUpdateElement }) => {
  const p = el.properties as ShapeProperties;
  const set = (u: Partial<ShapeProperties>) => onUpdateElement(el.id, { properties: { ...p, ...u } });
  const isLine = p.shapeType === "line";
  return (
    <>
      <ColorButton
        label={isLine ? "Line color" : "Fill"}
        value={p.fill === "transparent" ? "none" : p.fill}
        allowNone={!isLine}
        onChange={(c) => set({ fill: c === "none" ? "transparent" : c })}
      />
      {!isLine && (
        <ColorButton
          label="Outline"
          variant="stroke"
          value={p.stroke && p.stroke !== "transparent" ? p.stroke : undefined}
          allowNone
          onChange={(c) =>
            set({ stroke: c === "none" ? "transparent" : c, strokeWidth: c !== "none" && !p.strokeWidth ? 2 : p.strokeWidth })
          }
        />
      )}
      <span className="ctb-sep" />
    </>
  );
};

// ---------- Text ----------

const TextTools: React.FC<EditorContextToolbarProps> = ({ element: el, onUpdateElement }) => {
  const target = useTextStyleTarget(el, onUpdateElement);
  const s = target.style;
  const p = el.properties as TextProperties;
  const align = p.align || "left";
  const nextAlign = align === "left" ? "center" : align === "center" ? "right" : "left";
  return (
    <span className="ctb-group" {...textStyleUiProps}>
      <div className="ctb-stepper" role="group" aria-label="Font size">
        <IconButton label="Smaller" onClick={() => target.apply({ fontSizeDelta: -2 })}>
          <Minus size={14} />
        </IconButton>
        <span className="ctb-stepper-value" title={s.fontSize === "mixed" ? "Mixed sizes" : undefined}>
          {s.fontSize === "mixed" ? "–" : Math.round(s.fontSize * 10) / 10}
        </span>
        <IconButton label="Larger" onClick={() => target.apply({ fontSizeDelta: 2 })}>
          <Plus size={14} />
        </IconButton>
      </div>
      <ColorButton
        label="Text color"
        value={s.fill === "mixed" ? "" : s.fill}
        mixedLabel="Mixed"
        onChange={(c) => target.apply({ fill: c })}
      />
      <TextFormatButtons target={target} compact />
      <span className="ctb-sep ctb-sep--thin" />
      <IconButton label={`Alignment: ${align}`} onClick={() => target.updateBox({ align: nextAlign })}>
        {align === "center" ? <AlignCenter size={16} /> : align === "right" ? <AlignRight size={16} /> : <AlignLeft size={16} />}
      </IconButton>
      <span className="ctb-sep" />
    </span>
  );
};

// ---------- Opacity ----------

const OpacityTool: React.FC<EditorContextToolbarProps> = ({ element: el, onUpdateElement }) => {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton ref={setAnchor} label="Transparency" active={open} onClick={() => setOpen((o) => !o)}>
        <TransparencyIcon size={18} />
      </IconButton>
      <Popover anchor={anchor} open={open} onClose={() => setOpen(false)} align="center" width={240} label="Transparency">
        <div className="ui-popover-body">
          <SliderField
            label="Opacity"
            value={Math.round((el.opacity ?? 1) * 100)}
            min={0}
            max={100}
            suffix="%"
            onChange={(v) => onUpdateElement(el.id, { opacity: v / 100 })}
          />
        </div>
      </Popover>
    </>
  );
};

// ---------- Editing parts of an illustration ----------

const PartsToolbar: React.FC<EditorContextToolbarProps> = ({
  element: el,
  groupEditSession,
  onUpdateSvgColor,
  onDuplicate,
  onDelete,
  onEnterGroupEdit,
  onExitGroupEdit,
  onExitAllGroupEdits,
  onUngroupLayer,
}) => {
  const markup = svgMarkupOf(el);
  const path = groupEditSession?.selectedLayerPath || null;
  const layer = useMemo(() => (markup && path ? getSvgLayer(markup, path) : null), [markup, path]);
  const isGroup = Boolean(groupEditSession?.selectedLayerIsGroup);
  const crumbs = groupEditSession?.breadcrumb?.length ? groupEditSession.breadcrumb : [el.name || "Illustration"];
  const suggestions = useMemo(() => (markup ? extractSvgColors(markup).map(normalizeHex) : []), [markup]);

  return (
    <div className="ctb ctb--parts" role="toolbar" aria-label="Edit parts">
      <div className="ctb-crumbs" title="You are editing parts of this illustration">
        <IllustrationIcon size={15} />
        {crumbs.map((c, i) => (
          <React.Fragment key={`${c}-${i}`}>
            {i > 0 && <ChevronRight size={12} />}
            <span>{c}</span>
          </React.Fragment>
        ))}
        {groupEditSession?.selectedLayerName && (
          <>
            <ChevronRight size={12} />
            <strong>{groupEditSession.selectedLayerName}</strong>
          </>
        )}
      </div>
      <span className="ctb-sep" />

      {path ? (
        <>
          <ColorButton
            label="Fill"
            value={layer?.fill}
            onChange={(c) => onUpdateSvgColor(c, undefined)}
            documentColors={suggestions}
          />
          <ColorButton
            label="Outline"
            variant="stroke"
            value={layer?.stroke}
            allowNone
            onChange={(c) => onUpdateSvgColor(undefined, c)}
            documentColors={suggestions}
          />
          <span className="ctb-sep" />
          <IconButton label="Select parent group (Esc)" onClick={onExitGroupEdit}>
            <SelectParentIcon size={18} />
          </IconButton>
          {isGroup && (
            <>
              <IconButton label="Go inside this group (Enter)" onClick={() => onEnterGroupEdit(el.id)}>
                <GoInsideIcon size={18} />
              </IconButton>
              <IconButton label="Ungroup this group" onClick={onUngroupLayer}>
                <UngroupIcon size={18} />
              </IconButton>
            </>
          )}
          <IconButton label="Duplicate part (⌘D)" onClick={() => onDuplicate(undefined)}>
            <DuplicateIcon size={18} />
          </IconButton>
          <IconButton label="Delete part" tone="danger" onClick={() => onDelete(undefined)}>
            <DeleteIcon size={18} />
          </IconButton>
        </>
      ) : (
        <span className="ctb-note">Click a part to select it</span>
      )}
      <span className="ctb-sep" />
      <button type="button" className="ctb-button ctb-button--primary" onClick={onExitAllGroupEdits}>
        <Check size={15} />
        <span>Done</span>
      </button>
    </div>
  );
};

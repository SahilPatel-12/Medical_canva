"use client";

import React, { useMemo, useState } from "react";
import type { DesignElement, ShapeProperties, TextProperties } from "@design-platform/types";
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  ChevronDown,
  X,
} from "lucide-react";
import { ColorButton, FieldLabel, IconButton, Popover, Section, SliderField } from "./controls";
import {
  DeleteIcon,
  DuplicateIcon,
  IllustrationIcon,
  ImageIcon,
  LockIcon,
  ShapeIcon,
  TextIcon,
  UnlockIcon,
  UngroupIcon,
} from "../icons/EditorIcons";

// ==========================================
// Multi-selection: actions shared by the contextual toolbar and the inspector
// ==========================================

export type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";

export interface MultiSelectionActions {
  elements: DesignElement[];
  onAlign: (edge: AlignEdge) => void;
  onDistribute: (axis: "horizontal" | "vertical") => void;
  onGroup?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdateMany: (batch: Array<{ id: string; updates: Partial<DesignElement> }>) => void;
  /** Narrow the selection to one element */
  onSelectOne: (id: string) => void;
  /** Drop one element from the selection */
  onDeselectOne: (id: string) => void;
}

const ALIGN_BUTTONS: Array<{ edge: AlignEdge; label: string; icon: React.ReactNode }> = [
  { edge: "left", label: "Align left edges", icon: <AlignStartVertical size={16} /> },
  { edge: "center", label: "Align horizontal centers", icon: <AlignCenterVertical size={16} /> },
  { edge: "right", label: "Align right edges", icon: <AlignEndVertical size={16} /> },
  { edge: "top", label: "Align top edges", icon: <AlignStartHorizontal size={16} /> },
  { edge: "middle", label: "Align vertical centers", icon: <AlignCenterHorizontal size={16} /> },
  { edge: "bottom", label: "Align bottom edges", icon: <AlignEndHorizontal size={16} /> },
];

const typeIcon = (el: DesignElement, size = 16) =>
  el.type === "text" ? (
    <TextIcon size={size} />
  ) : el.type === "image" ? (
    <ImageIcon size={size} />
  ) : el.type === "svg" ? (
    <IllustrationIcon size={size} />
  ) : (
    <ShapeIcon size={size} />
  );

const canGroup = (els: DesignElement[]) => els.length > 1 && els.every((el) => el.type === "svg");
const allLocked = (els: DesignElement[]) => els.length > 0 && els.every((el) => el.locked);

const AlignGrid: React.FC<{ actions: MultiSelectionActions; onDone?: () => void }> = ({ actions, onDone }) => {
  const canDistribute = actions.elements.length >= 3;
  return (
    <>
      <div className="ui-segmented ui-segmented--full" role="group" aria-label="Align selected items">
        {ALIGN_BUTTONS.map((b) => (
          <IconButton
            key={b.edge}
            label={b.label}
            onClick={() => {
              actions.onAlign(b.edge);
              onDone?.();
            }}
          >
            {b.icon}
          </IconButton>
        ))}
      </div>
      <div className="insp-action-grid" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="ui-button"
          disabled={!canDistribute}
          title={canDistribute ? "Equal spacing, left to right" : "Select 3 or more items to distribute"}
          onClick={() => {
            actions.onDistribute("horizontal");
            onDone?.();
          }}
        >
          <AlignHorizontalSpaceAround size={15} /> Space evenly ↔
        </button>
        <button
          type="button"
          className="ui-button"
          disabled={!canDistribute}
          title={canDistribute ? "Equal spacing, top to bottom" : "Select 3 or more items to distribute"}
          onClick={() => {
            actions.onDistribute("vertical");
            onDone?.();
          }}
        >
          <AlignVerticalSpaceAround size={15} /> Space evenly ↕
        </button>
      </div>
    </>
  );
};

// ---------- Contextual toolbar ----------

export const MultiSelectionToolbar: React.FC<{ actions: MultiSelectionActions; onOpenInspector: () => void }> = ({
  actions,
  onOpenInspector,
}) => {
  const { elements } = actions;
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [alignOpen, setAlignOpen] = useState(false);
  const locked = allLocked(elements);
  return (
    <div className="ctb" role="toolbar" aria-label={`${elements.length} items selected`}>
      <span className="ctb-count">{elements.length} selected</span>
      <span className="ctb-sep" />
      <button
        ref={setAnchor}
        type="button"
        className="ctb-button"
        aria-expanded={alignOpen}
        onClick={() => setAlignOpen((o) => !o)}
        title="Align and space the selected items"
      >
        <AlignCenterVertical size={16} />
        <span>Align</span>
        <ChevronDown size={14} />
      </button>
      <Popover anchor={anchor} open={alignOpen} onClose={() => setAlignOpen(false)} width={300} label="Align">
        <div className="ui-popover-title">Align selection</div>
        <div className="ui-popover-body" style={{ paddingTop: 6 }}>
          <AlignGrid actions={actions} onDone={() => setAlignOpen(false)} />
        </div>
      </Popover>
      {actions.onGroup && canGroup(elements) && (
        <button type="button" className="ctb-button ctb-button--accent" onClick={actions.onGroup} title="Combine into one illustration (⌘G)">
          <UngroupIcon size={17} />
          <span>Group</span>
        </button>
      )}
      <span className="ctb-sep" />
      <IconButton
        label={locked ? "Unlock all" : "Lock all"}
        active={locked}
        onClick={() => actions.onUpdateMany(elements.map((el) => ({ id: el.id, updates: { locked: !locked } })))}
      >
        {locked ? <LockIcon size={18} /> : <UnlockIcon size={18} />}
      </IconButton>
      <IconButton label="Duplicate all (⌘D)" onClick={actions.onDuplicate}>
        <DuplicateIcon size={18} />
      </IconButton>
      <IconButton label="Delete all" tone="danger" onClick={actions.onDelete}>
        <DeleteIcon size={18} />
      </IconButton>
      <span className="ctb-sep" />
      <button type="button" className="ctb-button" onClick={onOpenInspector}>
        <span>More</span>
      </button>
    </div>
  );
};

// ---------- Inspector ----------

export const MultiSelectionInspector: React.FC<{ actions: MultiSelectionActions }> = ({ actions }) => {
  const { elements } = actions;
  const locked = allLocked(elements);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    elements.forEach((el) => (c[el.type] = (c[el.type] || 0) + 1));
    return c;
  }, [elements]);
  const summary = Object.entries(counts)
    .map(([t, n]) => `${n} ${t === "svg" ? (n > 1 ? "illustrations" : "illustration") : t === "shape" ? (n > 1 ? "shapes" : "shape") : t === "text" ? "text" : n > 1 ? "images" : "image"}`)
    .join(" · ");

  // Elements whose color is a plain fill (shapes and text) can be recolored together
  const colorable = elements.filter((el) => el.type === "shape" || el.type === "text");
  const fills = [...new Set(colorable.map((el) => (el.properties as ShapeProperties | TextProperties).fill))];
  const opacities = [...new Set(elements.map((el) => Math.round((el.opacity ?? 1) * 100)))];

  return (
    <>
      <div className="insp-header">
        <span className="insp-type-icon insp-type-icon--multi">{elements.length}</span>
        <div className="insp-heading">
          <div className="insp-title">{elements.length} items selected</div>
          <div className="insp-subtitle">{summary}</div>
        </div>
        <div className="insp-header-actions">
          <IconButton
            label={locked ? "Unlock all" : "Lock all"}
            active={locked}
            onClick={() => actions.onUpdateMany(elements.map((el) => ({ id: el.id, updates: { locked: !locked } })))}
          >
            {locked ? <LockIcon size={18} /> : <UnlockIcon size={18} />}
          </IconButton>
          <IconButton label="Duplicate all (⌘D)" onClick={actions.onDuplicate}>
            <DuplicateIcon size={18} />
          </IconButton>
          <IconButton label="Delete all" tone="danger" onClick={actions.onDelete}>
            <DeleteIcon size={18} />
          </IconButton>
        </div>
      </div>

      {actions.onGroup && canGroup(elements) && (
        <div className="insp-card">
          <div className="insp-card-title">Combine into one illustration</div>
          <div className="insp-card-hint">Group these illustrations so they move and resize together. You can still edit each part.</div>
          <div className="insp-card-actions">
            <button type="button" className="ui-button ui-button--primary" onClick={actions.onGroup}>
              <UngroupIcon size={16} /> Group (⌘G)
            </button>
          </div>
        </div>
      )}

      <Section title="Align & space">
        <AlignGrid actions={actions} />
        <div className="insp-tip">Aligns the items to each other. Drag the selection to move them together.</div>
      </Section>

      <Section title="Appearance">
        {colorable.length > 0 && (
          <>
            <FieldLabel hint={colorable.length < elements.length ? "Shapes & text only" : undefined}>Color</FieldLabel>
            <div className="insp-row" style={{ marginBottom: 8 }}>
              <ColorButton
                label="Color for all"
                value={fills.length === 1 ? fills[0] : undefined}
                mixedLabel="Mixed"
                showValue
                onChange={(c) =>
                  actions.onUpdateMany(
                    colorable.map((el) => ({ id: el.id, updates: { properties: { ...el.properties, fill: c } } }))
                  )
                }
              />
            </div>
          </>
        )}
        <SliderField
          label={opacities.length === 1 ? "Opacity" : "Opacity (mixed)"}
          value={opacities.length === 1 ? opacities[0]! : 100}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => actions.onUpdateMany(elements.map((el) => ({ id: el.id, updates: { opacity: v / 100 } })))}
        />
      </Section>

      <Section title="Selected items">
        <ul className="insp-multi-list">
          {[...elements].reverse().map((el) => (
            <li key={el.id}>
              <button type="button" className="insp-multi-item" onClick={() => actions.onSelectOne(el.id)} title="Select only this item">
                {typeIcon(el)}
                <span>{el.name || (el.type === "text" ? (el.properties as TextProperties).text : el.type)}</span>
              </button>
              <IconButton label="Remove from selection" onClick={() => actions.onDeselectOne(el.id)}>
                <X size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
        <div className="insp-tip">Shift-click on the page or in Layers to add or remove items.</div>
      </Section>
    </>
  );
};

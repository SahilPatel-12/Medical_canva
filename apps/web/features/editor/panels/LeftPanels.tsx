"use client";

import React, { useMemo, useRef, useState } from "react";
import type { Asset, DesignElement, ShapeProperties, SvgProperties, TextProperties } from "@design-platform/types";
import {
  ChevronLeft,
  Search,
  X,
  GripVertical,
} from "lucide-react";
import {
  DeleteIcon,
  DuplicateIcon,
  IllustrationIcon,
  ImageIcon,
  LayersIcon,
  LockIcon,
  ShapeIcon,
  TextIcon,
  UnlockIcon,
  UploadsIcon,
} from "../icons/EditorIcons";
import { LINES, MARKERS, SHAPES, SYMBOLS, CatalogItem, ElementTemplate, TemplatePreview } from "./elementTemplates";

// ==========================================
// Shared chrome
// ==========================================

export const PanelHeader: React.FC<{ title: string; subtitle?: string; onCollapse?: () => void }> = ({
  title,
  subtitle,
  onCollapse,
}) => (
  <div className="lp-header">
    <div className="lp-header-text">
      <h2 className="lp-title">{title}</h2>
      {subtitle && <p className="lp-subtitle">{subtitle}</p>}
    </div>
    {onCollapse && (
      <button type="button" className="ui-icon-button" onClick={onCollapse} title="Hide panel" aria-label="Hide panel">
        <ChevronLeft size={18} />
      </button>
    )}
  </div>
);

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <label className="lp-search">
    <Search size={16} />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    {value && (
      <button type="button" onClick={() => onChange("")} aria-label="Clear search">
        <X size={14} />
      </button>
    )}
  </label>
);

const PanelSection: React.FC<{
  title: string;
  count: number;
  limit?: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, count, limit, expanded, onToggle, children }) => (
  <section className="lp-section">
    <div className="lp-section-head">
      <h3>{title}</h3>
      {limit !== undefined && count > limit && (
        <button type="button" className="insp-link" onClick={onToggle}>
          {expanded ? "Show less" : "See all"}
        </button>
      )}
    </div>
    {children}
  </section>
);

const setDragTemplate = (e: React.DragEvent, template: ElementTemplate) => {
  e.dataTransfer.setData("application/json", JSON.stringify({ elementTemplate: template }));
  e.dataTransfer.effectAllowed = "copy";
};

const matches = (q: string, ...fields: (string | undefined)[]) =>
  !q || fields.some((f) => f && f.toLowerCase().includes(q));

// ==========================================
// Elements
// ==========================================

export interface ElementsPanelProps {
  onInsert: (template: ElementTemplate) => void;
  /** Shapes & symbols from the asset library */
  libraryItems: Asset[];
  onAddAsset: (asset: Asset) => void;
  onCollapse: () => void;
}

export const ElementsPanel: React.FC<ElementsPanelProps> = ({ onInsert, libraryItems, onAddAsset, onCollapse }) => {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();

  const groups: Array<{ id: string; title: string; items: CatalogItem[]; limit: number; columns: number }> = [
    { id: "shapes", title: "Shapes", items: SHAPES, limit: 8, columns: 4 },
    { id: "lines", title: "Lines & arrows", items: LINES, limit: 8, columns: 4 },
    { id: "symbols", title: "Scientific symbols", items: SYMBOLS, limit: 8, columns: 4 },
    { id: "markers", title: "Numbered markers", items: MARKERS, limit: 6, columns: 6 },
  ];
  const library = libraryItems.filter((a) => matches(q, a.name, a.tags?.join(" "), a.subcategoryName));
  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));
  let resultCount = library.length;

  const sections = groups.map((g) => {
    const items = g.items.filter((i) => matches(q, i.label, i.keywords));
    resultCount += items.length;
    if (items.length === 0) return null;
    const open = Boolean(q) || expanded[g.id];
    const shown = open ? items : items.slice(0, g.limit);
    return (
      <PanelSection key={g.id} title={g.title} count={items.length} limit={q ? undefined : g.limit} expanded={open} onToggle={() => toggle(g.id)}>
        <div className="lp-tile-grid" style={{ gridTemplateColumns: `repeat(${g.columns}, 1fr)` }}>
          {shown.map((item) => (
            <button
              key={item.id}
              type="button"
              className="lp-tile"
              title={`${item.label} — click to add or drag onto the page`}
              aria-label={`Add ${item.label}`}
              draggable
              onDragStart={(e) => setDragTemplate(e, item.template)}
              onClick={() => onInsert(item.template)}
            >
              <TemplatePreview template={item.template} />
            </button>
          ))}
        </div>
      </PanelSection>
    );
  });

  return (
    <div className="lp">
      <PanelHeader title="Elements" subtitle="Shapes, lines and symbols" onCollapse={onCollapse} />
      <div className="lp-sticky">
        <SearchBox value={query} onChange={setQuery} placeholder="Search elements" />
      </div>
      <div className="lp-body">
        {sections}
        {library.length > 0 && (
          <PanelSection
            title="From the library"
            count={library.length}
            limit={q ? undefined : 8}
            expanded={Boolean(q) || Boolean(expanded.library)}
            onToggle={() => toggle("library")}
          >
            <div className="lp-tile-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              {(q || expanded.library ? library : library.slice(0, 8)).map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="lp-tile"
                  title={asset.name}
                  aria-label={`Add ${asset.name}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/json", JSON.stringify(asset));
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onAddAsset(asset)}
                >
                  <AssetThumb asset={asset} />
                </button>
              ))}
            </div>
          </PanelSection>
        )}
        {resultCount === 0 && <div className="lp-empty">No elements match “{query}”.</div>}
      </div>
    </div>
  );
};

const AssetThumb: React.FC<{ asset: Asset }> = ({ asset }) => {
  const src = asset.source?.trim().startsWith("<svg")
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.source)}`
    : asset.url || asset.source;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" draggable={false} style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <ShapeIcon size={20} />;
};

// ==========================================
// Text
// ==========================================

interface TextPreset {
  id: string;
  /** Shown in the panel */
  label: string;
  hint?: string;
  text: string;
  width: number;
  props: Partial<TextProperties>;
}

const FONT = "Inter, -apple-system, sans-serif";

const TEXT_STYLES: TextPreset[] = [
  { id: "heading", label: "Add a heading", text: "Add a heading", width: 640, props: { fontSize: 56, fontWeight: "bold", fill: "#0f172a" } },
  { id: "subheading", label: "Add a subheading", text: "Add a subheading", width: 520, props: { fontSize: 32, fontWeight: "600", fill: "#1e293b" } },
  { id: "body", label: "Add a little bit of body text", text: "Add a little bit of body text", width: 440, props: { fontSize: 20, fill: "#334155", lineHeight: 1.4 } },
];

const SCIENCE_TEXT: TextPreset[] = [
  { id: "panel", label: "A", hint: "Panel letter", text: "A", width: 64, props: { fontSize: 48, fontWeight: "bold", fill: "#0f172a" } },
  { id: "caption", label: "Figure 1. What this figure shows.", hint: "Figure caption", text: "Figure 1. Describe what this figure shows.", width: 560, props: { fontSize: 16, fill: "#334155", lineHeight: 1.45 } },
  { id: "axis", label: "Concentration (mM)", hint: "Axis / label", text: "Concentration (mM)", width: 280, props: { fontSize: 18, fontWeight: "600", fill: "#1e293b" } },
  { id: "species", label: "Escherichia coli", hint: "Species name", text: "Escherichia coli", width: 260, props: { fontSize: 22, fontStyle: "italic", fill: "#0f172a" } },
  { id: "gene", label: "TP53", hint: "Gene symbol", text: "TP53", width: 120, props: { fontSize: 22, fontStyle: "italic", fontWeight: "600", fill: "#0f172a" } },
  { id: "formula", label: "H₂O + CO₂ → H₂CO₃", hint: "Chemical equation", text: "H₂O + CO₂ → H₂CO₃", width: 300, props: { fontSize: 24, fill: "#0f172a" } },
  { id: "scale", label: "10 µm", hint: "Scale label", text: "10 µm", width: 110, props: { fontSize: 16, fontWeight: "bold", fill: "#0f172a", align: "center" } },
  { id: "note", label: "Note: add a short annotation", hint: "Annotation", text: "Note: add a short annotation", width: 320, props: { fontSize: 16, fontStyle: "italic", fill: "#475569" } },
];

const textTemplate = (preset: TextPreset): ElementTemplate => ({
  type: "text",
  name: preset.hint || preset.label,
  width: preset.width,
  height: Math.round((preset.props.fontSize || 20) * (preset.props.lineHeight || 1.2)),
  rotation: 0,
  opacity: 1,
  properties: {
    text: preset.text,
    fontSize: 20,
    fontFamily: FONT,
    fill: "#0f172a",
    align: "left",
    fontWeight: "normal",
    fontStyle: "normal",
    lineHeight: 1.2,
    ...preset.props,
  } as TextProperties,
});

export interface TextPanelProps {
  onInsert: (template: ElementTemplate, startEditing?: boolean) => void;
  onCollapse: () => void;
}

export const TextPanel: React.FC<TextPanelProps> = ({ onInsert, onCollapse }) => {
  const previewStyle = (p: Partial<TextProperties>, scale = 1): React.CSSProperties => ({
    fontSize: Math.min(26, (p.fontSize || 20) * scale),
    fontWeight: p.fontWeight === "bold" ? 700 : p.fontWeight ? Number(p.fontWeight) : 400,
    fontStyle: p.fontStyle === "italic" ? "italic" : "normal",
    color: "var(--foreground, #0f172a)",
  });
  const drag = (preset: TextPreset) => (e: React.DragEvent) => setDragTemplate(e, textTemplate(preset));

  return (
    <div className="lp">
      <PanelHeader title="Text" subtitle="Click to add, then double-click to type" onCollapse={onCollapse} />
      <div className="lp-body">
        <button
          type="button"
          className="ui-button ui-button--primary lp-wide-button"
          onClick={() =>
            onInsert(
              textTemplate({ id: "box", label: "Text", hint: "Text", text: "Your text", width: 360, props: { fontSize: 24 } }),
              true
            )
          }
        >
          <TextIcon size={18} />
          Add a text box
        </button>

        <section className="lp-section">
          <div className="lp-section-head">
            <h3>Default text styles</h3>
          </div>
          <div className="lp-text-list">
            {TEXT_STYLES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="lp-text-item"
                draggable
                onDragStart={drag(preset)}
                onClick={() => onInsert(textTemplate(preset))}
              >
                <span style={previewStyle(preset.props, preset.id === "heading" ? 0.46 : preset.id === "subheading" ? 0.56 : 0.75)}>
                  {preset.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-section-head">
            <h3>Scientific labels</h3>
          </div>
          <div className="lp-text-grid">
            {SCIENCE_TEXT.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="lp-text-card"
                draggable
                onDragStart={drag(preset)}
                onClick={() => onInsert(textTemplate(preset))}
                title={`Add ${preset.hint}`}
              >
                <span className="lp-text-card-sample" style={previewStyle(preset.props, 0.62)}>
                  {preset.label}
                </span>
                <span className="lp-text-card-hint">{preset.hint}</span>
              </button>
            ))}
          </div>
        </section>
        <p className="lp-tip">Tip: double-click any text on the page (or press Enter) to edit it.</p>
      </div>
    </div>
  );
};

// ==========================================
// Uploads
// ==========================================

export interface UploadsPanelProps {
  uploads: Asset[];
  isUploading: boolean;
  error: string | null;
  onFiles: (files: FileList | null) => void;
  onAddAsset: (asset: Asset) => void;
  onRemove: (id: string) => void;
  onCollapse: () => void;
}

export const UploadsPanel: React.FC<UploadsPanelProps> = ({ uploads, isUploading, error, onFiles, onAddAsset, onRemove, onCollapse }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  return (
    <div className="lp">
      <PanelHeader title="Uploads" subtitle="Your images and SVG files" onCollapse={onCollapse} />
      <div className="lp-body">
        <div
          className={`lp-dropzone${dragOver ? " is-over" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
        >
          <UploadsIcon size={30} />
          <strong>{isUploading ? "Uploading…" : "Upload files"}</strong>
          <span>Drag files here or click to browse · SVG, PNG, JPG, WebP · up to 15 MB</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {error && <div className="lp-error">{error}</div>}

        <section className="lp-section">
          <div className="lp-section-head">
            <h3>Your uploads</h3>
            {uploads.length > 0 && <span className="lp-count">{uploads.length}</span>}
          </div>
          {uploads.length === 0 ? (
            <div className="lp-empty">
              <UploadsIcon size={22} />
              Uploaded files appear here. Click one to add it to the page.
            </div>
          ) : (
            <div className="lp-upload-grid">
              {uploads.map((asset) => (
                <div key={asset.id} className="lp-upload">
                  <button
                    type="button"
                    className="lp-upload-thumb"
                    title={`${asset.name} — click to add or drag onto the page`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify(asset));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onAddAsset(asset)}
                  >
                    <AssetThumb asset={asset} />
                  </button>
                  <span className="lp-upload-name">{asset.name}</span>
                  <button type="button" className="lp-upload-remove" onClick={() => onRemove(asset.id)} aria-label={`Remove ${asset.name}`} title="Remove from uploads">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

// ==========================================
// Layers
// ==========================================

export interface LayersPanelProps {
  elements: DesignElement[];
  selectedId: string | null;
  /** All selected ids (multi-selection) */
  selectedIds?: string[];
  /** `additive` when Shift / Cmd / Ctrl was held */
  onSelect: (id: string, additive?: boolean) => void;
  onUpdate: (id: string, updates: Partial<DesignElement>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Moves an element to a stacking index (0 = bottom) */
  onMove: (id: string, index: number) => void;
  onCollapse: () => void;
}

const layerIcon = (el: DesignElement) =>
  el.type === "text" ? <TextIcon size={16} /> : el.type === "image" ? <ImageIcon size={16} /> : el.type === "svg" ? <IllustrationIcon size={16} /> : <ShapeIcon size={16} />;

const LayerThumb: React.FC<{ el: DesignElement }> = ({ el }) => {
  if (el.type === "svg") {
    const p = el.properties as SvgProperties;
    const m = p.svgContent || p.originalSvg || "";
    if (m.includes("<svg")) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img alt="" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(m)}`} draggable={false} />;
    }
  }
  if (el.type === "image") {
    const src = (el.properties as { src?: string }).src;
    // eslint-disable-next-line @next/next/no-img-element
    if (src) return <img alt="" src={src} draggable={false} />;
  }
  if (el.type === "shape") {
    return <TemplatePreview template={{ ...el, width: el.width, height: Math.max(el.height, 1) }} />;
  }
  if (el.type === "text") {
    const p = el.properties as TextProperties;
    return <span className="lp-layer-text-thumb" style={{ color: p.fill }}>Aa</span>;
  }
  return layerIcon(el);
};

export const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  selectedId,
  selectedIds,
  onSelect,
  onUpdate,
  onDuplicate,
  onDelete,
  onMove,
  onCollapse,
}) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  // Top of the list = front-most element
  const ordered = useMemo(() => [...elements].reverse(), [elements]);
  const toStackIndex = (displayIndex: number) => elements.length - 1 - displayIndex;

  return (
    <div className="lp">
      <PanelHeader
        title="Layers"
        subtitle={`${elements.length} ${elements.length === 1 ? "element" : "elements"} on this page`}
        onCollapse={onCollapse}
      />
      <div className="lp-body">
        {elements.length === 0 ? (
          <div className="lp-empty">
            <LayersIcon size={22} />
            Nothing on this page yet. Add elements, text or assets and they will be listed here.
          </div>
        ) : (
          <>
            <p className="lp-tip lp-tip--top">Drag to reorder · Shift-click to select several · top is in front</p>
            <ul className="lp-layers" onDragLeave={() => setDropIndex(null)}>
              {ordered.map((el, i) => {
                const isSelected = selectedIds && selectedIds.length > 0 ? selectedIds.includes(el.id) : el.id === selectedId;
                const label = el.name || (el.type === "text" ? (el.properties as TextProperties).text : el.type);
                return (
                  <li
                    key={el.id}
                    className={`lp-layer${isSelected ? " is-selected" : ""}${dragId === el.id ? " is-dragging" : ""}${
                      dropIndex === i && dragId && dragId !== el.id ? " is-drop-target" : ""
                    }`}
                    draggable={renaming !== el.id}
                    onDragStart={(e) => {
                      setDragId(el.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", el.id);
                    }}
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      setDropIndex(i);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId && dragId !== el.id) onMove(dragId, toStackIndex(i));
                      setDragId(null);
                      setDropIndex(null);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropIndex(null);
                    }}
                    onClick={(e) => onSelect(el.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                  >
                    <GripVertical size={14} className="lp-layer-grip" />
                    <span className="lp-layer-thumb">
                      <LayerThumb el={el} />
                    </span>
                    {renaming === el.id ? (
                      <input
                        className="ui-input lp-layer-rename"
                        defaultValue={el.name || ""}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          onUpdate(el.id, { name: e.currentTarget.value.trim() });
                          setRenaming(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setRenaming(null);
                        }}
                        aria-label="Layer name"
                      />
                    ) : (
                      <span
                        className="lp-layer-name"
                        title="Double-click to rename"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setRenaming(el.id);
                        }}
                      >
                        {label}
                      </span>
                    )}
                    <span className="lp-layer-actions">
                      <button
                        type="button"
                        className={`ui-icon-button${el.locked ? " is-on" : ""}`}
                        title={el.locked ? "Unlock" : "Lock"}
                        aria-label={el.locked ? `Unlock ${label}` : `Lock ${label}`}
                        aria-pressed={Boolean(el.locked)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdate(el.id, { locked: !el.locked });
                        }}
                      >
                        {el.locked ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
                      </button>
                      <button
                        type="button"
                        className="ui-icon-button lp-layer-hover"
                        title="Duplicate"
                        aria-label={`Duplicate ${label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(el.id);
                        }}
                      >
                        <DuplicateIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className="ui-icon-button is-danger lp-layer-hover"
                        title="Delete"
                        aria-label={`Delete ${label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(el.id);
                        }}
                      >
                        <DeleteIcon size={16} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

export type { ShapeProperties };

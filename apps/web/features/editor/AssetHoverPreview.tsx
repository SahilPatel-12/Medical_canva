"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Asset } from "@design-platform/types";
import { fetchSvgMarkup, getCategoryBySlug, getSvgLayerChildren } from "@design-platform/editor";
import { formatAssetName } from "./EditorLeftPanel";

// ==========================================
// Hover preview for the asset library (BioRender style): a larger look at the
// asset beside the panel, with what kind of asset it is before it is placed.
// ==========================================

export interface AssetPreviewTarget {
  asset: Asset;
  /** Hovered tile, viewport pixels */
  anchor: { top: number; bottom: number };
  /** Right edge of the library panel: the card opens just beside it */
  panelRight: number;
}

interface AssetInfo {
  kind: "grouped" | "single" | "image" | "unknown";
  parts: number;
  ratio: number | null;
}

const infoCache = new Map<string, AssetInfo>();

function assetKey(asset: Asset): string {
  return asset.id + (asset.contentHash || asset.version || "");
}

function svgSourceOf(asset: Asset): string {
  if (asset.source && asset.source.trim().startsWith("<svg")) return asset.source;
  return asset.url || (asset.source?.startsWith("http") || asset.source?.startsWith("/") ? asset.source : "");
}

function ratioOf(markup: string): number | null {
  const root = markup.match(/<svg\b[^>]*>/i)?.[0] || "";
  const vb = root.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb[2]! > 0 && vb[3]! > 0) return vb[2]! / vb[3]!;
  const w = parseFloat(root.match(/\swidth\s*=\s*["']([0-9.]+)/i)?.[1] || "");
  const h = parseFloat(root.match(/\sheight\s*=\s*["']([0-9.]+)/i)?.[1] || "");
  return w > 0 && h > 0 ? w / h : null;
}

/** What the asset is: grouped illustration (editable parts), single-part icon, or image */
async function describeAsset(asset: Asset): Promise<AssetInfo> {
  const key = assetKey(asset);
  const cached = infoCache.get(key);
  if (cached) return cached;
  const isSvg = asset.type === "svg" || asset.contentType?.includes("svg") || /\.svg(\?|$)/i.test(asset.url || "");
  let info: AssetInfo;
  if (!isSvg && !asset.source?.trim().startsWith("<svg")) {
    info = { kind: asset.type === "image" ? "image" : "unknown", parts: 0, ratio: null };
  } else {
    const markup = await fetchSvgMarkup(svgSourceOf(asset)).catch(() => "");
    if (!markup) {
      info = { kind: "unknown", parts: 0, ratio: null };
    } else {
      const parts = getSvgLayerChildren(markup, [])?.length || 0;
      info = { kind: parts > 1 ? "grouped" : "single", parts, ratio: ratioOf(markup) };
    }
  }
  infoCache.set(key, info);
  return info;
}

const CARD_WIDTH = 264;
const CARD_HEIGHT_ESTIMATE = 372;
const GAP = 12;
const EDGE = 12;

const KIND_LABEL: Record<AssetInfo["kind"], string> = {
  grouped: "Grouped icon",
  single: "Single icon",
  image: "Image",
  unknown: "Icon",
};

export const AssetHoverPreview: React.FC<{ target: AssetPreviewTarget | null }> = ({ target }) => {
  const asset = target?.asset ?? null;
  const key = asset ? assetKey(asset) : "";
  const [loaded, setLoaded] = useState<{ key: string; info: AssetInfo } | null>(null);
  const info = (asset && infoCache.get(key)) || (loaded && loaded.key === key ? loaded.info : null);

  useEffect(() => {
    if (!asset || infoCache.has(key)) return;
    let alive = true;
    describeAsset(asset).then((result) => {
      if (alive) setLoaded({ key, info: result });
    });
    return () => {
      alive = false;
    };
  }, [asset, key]);

  if (!target || !asset || typeof document === "undefined") return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Beside the panel, level with the hovered tile; kept inside the window
  const left = Math.min(target.panelRight + GAP, vw - CARD_WIDTH - EDGE);
  const top = Math.max(EDGE, Math.min(target.anchor.top - 8, vh - CARD_HEIGHT_ESTIMATE - EDGE));

  const title = formatAssetName(asset.name);
  const category = asset.categorySlug ? getCategoryBySlug(asset.categorySlug) : undefined;
  const subName =
    asset.subcategoryName ||
    category?.subcategories.find((s) => s.slug === asset.subcategorySlug || s.id === asset.subcategoryId)?.name;
  const path = [category?.name, subName].filter(Boolean).join(" › ");
  const inline = asset.source?.trim().startsWith("<svg") ? asset.source : null;
  const src = inline ? null : asset.url || asset.thumbnail || asset.source;

  return createPortal(
    <div className="ahp" role="tooltip" style={{ left, top, width: CARD_WIDTH }}>
      <div className="ahp-head">
        <div className="ahp-title">{title}</div>
        {path && <div className="ahp-path">{path}</div>}
      </div>
      <div className="ahp-stage">
        {inline ? (
          <div className="ahp-art" dangerouslySetInnerHTML={{ __html: inline }} />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ahp-art" src={src} alt="" draggable={false} />
        ) : null}
      </div>
      <div className="ahp-kind">
        {info ? (
          <>
            <span className={`ahp-badge is-${info.kind}`}>{KIND_LABEL[info.kind]}</span>
            {info.kind === "grouped" && <span className="ahp-meta">{info.parts} editable parts</span>}
            {info.kind === "single" && <span className="ahp-meta">Recolor as one piece</span>}
          </>
        ) : (
          <span className="ahp-badge is-loading">Checking parts…</span>
        )}
      </div>
      <div className="ahp-hint">
        {info?.kind === "grouped" ? "Click to add · Double-click to edit parts" : "Click to add · Drag onto a page"}
      </div>
    </div>,
    document.body
  );
};

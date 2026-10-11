import React from "react";

export interface CategoryTheme {
  accent: string;
  background: string;
  border: string;
  badgeBg: string;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  "cell-types": {
    accent: "#2563eb",
    background: "#eff6ff",
    border: "#bfdbfe",
    badgeBg: "rgba(37, 99, 235, 0.08)",
  },
  proteins: {
    accent: "#4f46e5",
    background: "#eef2ff",
    border: "#c7d2fe",
    badgeBg: "rgba(79, 70, 229, 0.08)",
  },
  "nucleic-acids": {
    accent: "#0891b2",
    background: "#ecfeff",
    border: "#a5f3fc",
    badgeBg: "rgba(8, 145, 178, 0.08)",
  },
  "human-anatomy": {
    accent: "#e11d48",
    background: "#fff1f2",
    border: "#fecdd3",
    badgeBg: "rgba(225, 29, 72, 0.08)",
  },
  "lab-and-objects": {
    accent: "#7c3aed",
    background: "#f5f3ff",
    border: "#ddd6fe",
    badgeBg: "rgba(124, 58, 237, 0.08)",
  },
  species: {
    accent: "#d97706",
    background: "#fffbeb",
    border: "#fde68a",
    badgeBg: "rgba(217, 119, 6, 0.08)",
  },
  agriculture: {
    accent: "#059669",
    background: "#ecfdf5",
    border: "#a7f3d0",
    badgeBg: "rgba(5, 150, 105, 0.08)",
  },
  membranes: {
    accent: "#0d9488",
    background: "#f0fdfa",
    border: "#99f6e4",
    badgeBg: "rgba(13, 148, 136, 0.08)",
  },
  "cell-structures": {
    accent: "#ea580c",
    background: "#fff7ed",
    border: "#fed7aa",
    badgeBg: "rgba(234, 88, 12, 0.08)",
  },
  epithelium: {
    accent: "#0284c7",
    background: "#f0f9ff",
    border: "#bae6fd",
    badgeBg: "rgba(2, 132, 199, 0.08)",
  },
  "lipids-and-carbs": {
    accent: "#ca8a04",
    background: "#fefce8",
    border: "#fef08a",
    badgeBg: "rgba(202, 138, 4, 0.08)",
  },
  chemistry: {
    accent: "#9333ea",
    background: "#faf5ff",
    border: "#e9d5ff",
    badgeBg: "rgba(147, 51, 234, 0.08)",
  },
  "graphs-and-symbols": {
    accent: "#475569",
    background: "#f8fafc",
    border: "#e2e8f0",
    badgeBg: "rgba(71, 85, 105, 0.08)",
  },
  "arrows-and-shapes": {
    accent: "#c026d3",
    background: "#fdf4ff",
    border: "#f5d0fe",
    badgeBg: "rgba(192, 38, 211, 0.08)",
  },
  biomojii: {
    accent: "#db2777",
    background: "#fdf2f8",
    border: "#fbcfe8",
    badgeBg: "rgba(219, 39, 119, 0.08)",
  },
};

const DEFAULT_THEME: CategoryTheme = {
  accent: "#2563eb",
  background: "#f8fafc",
  border: "#e2e8f0",
  badgeBg: "rgba(37, 99, 235, 0.06)",
};

export function getCategoryTheme(slug: string): CategoryTheme {
  return CATEGORY_THEMES[slug] || DEFAULT_THEME;
}

/**
 * High-fidelity scientific SVG vector representations for each canonical category
 */
function renderCategoryVector(slug: string, color: string): React.ReactNode {
  switch (slug) {
    case "cell-types":
      // Eukaryotic animal cell with nucleus and organelles
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <ellipse cx="18" cy="18" rx="15" ry="14" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.75" />
          <ellipse cx="16" cy="16" rx="6.5" ry="5.5" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5" />
          <circle cx="15.5" cy="15.5" r="2.5" fill={color} />
          <circle cx="25" cy="13" r="1.5" fill={color} />
          <circle cx="11" cy="24" r="1.5" fill={color} />
          <ellipse cx="24" cy="22" rx="2.5" ry="1.5" fill={color} fillOpacity="0.7" />
        </svg>
      );

    case "proteins":
      // Y-shaped immunoglobulin / antibody
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <path
            d="M 11 7 L 11 18 L 18 24 L 18 31 M 25 7 L 25 18 L 18 24"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 7 10 L 7 18 L 13 23 M 29 10 L 29 18 L 23 23"
            stroke={color}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.8"
          />
          <line x1="14" y1="20" x2="22" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1,1" />
        </svg>
      );

    case "nucleic-acids":
      // DNA double helix
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <path d="M 10 6 Q 7 18 10 30" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M 26 6 Q 29 18 26 30" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="10" y1="9" x2="26" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9" y1="15" x2="27" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9" y1="21" x2="27" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="27" x2="26" y2="27" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="9" r="1.5" fill={color} />
          <circle cx="26" cy="9" r="1.5" fill={color} />
          <circle cx="9" cy="15" r="1.5" fill={color} />
          <circle cx="27" cy="15" r="1.5" fill={color} />
          <circle cx="9" cy="21" r="1.5" fill={color} />
          <circle cx="27" cy="21" r="1.5" fill={color} />
        </svg>
      );

    case "human-anatomy":
      // Anatomical heart
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <path
            d="M 18 29 C 18 29 6 20 6 12 C 6 7 11 4.5 15 7 C 16.5 8 18 10.5 18 10.5 C 18 10.5 19.5 8 21 7 C 25 4.5 30 7 30 12 C 30 20 18 29 18 29 Z"
            fill={color}
            fillOpacity="0.15"
            stroke={color}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            d="M 9 15 L 13 15 L 15 11 L 18 20 L 20 13 L 22 17 L 24 15 L 27 15"
            stroke={color}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "lab-and-objects":
      // Laboratory Erlenmeyer flask
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <path
            d="M 15 5 L 21 5 L 21 13 L 29 27 C 30 29 28.5 31 26 31 L 10 31 C 7.5 31 6 29 7 27 L 15 13 Z"
            fill={color}
            fillOpacity="0.15"
            stroke={color}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path d="M 10 24 L 26 24 L 28 29 C 28.5 30 27.5 31 26 31 L 10 31 C 8.5 31 7.5 30 8 29 Z" fill={color} fillOpacity="0.35" />
          <line x1="14" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="27" r="1" fill="#ffffff" />
          <circle cx="20" cy="25.5" r="1" fill="#ffffff" />
        </svg>
      );

    case "species":
      // Virus / Microorganism with capsid & spikes
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <circle cx="18" cy="18" r="9" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.75" />
          <line x1="18" y1="9" x2="18" y2="4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="18" cy="3.5" r="1.5" fill={color} />
          <line x1="18" y1="27" x2="18" y2="32" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="18" cy="32.5" r="1.5" fill={color} />
          <line x1="9" y1="18" x2="4" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="3.5" cy="18" r="1.5" fill={color} />
          <line x1="27" y1="18" x2="32" y2="18" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="32.5" cy="18" r="1.5" fill={color} />
          <line x1="11.5" y1="11.5" x2="8" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="7.5" cy="7.5" r="1.25" fill={color} />
          <line x1="24.5" y1="24.5" x2="28" y2="28" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="28.5" cy="28.5" r="1.25" fill={color} />
        </svg>
      );

    case "agriculture":
      // Sprouting plant leaf
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <path
            d="M 18 5 C 27 11 29 25 18 31 C 7 25 9 11 18 5 Z"
            fill={color}
            fillOpacity="0.2"
            stroke={color}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <line x1="18" y1="6" x2="18" y2="31" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="18" y1="14" x2="23" y2="11" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
          <line x1="18" y1="20" x2="24" y2="17" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
          <line x1="18" y1="14" x2="13" y2="11" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
          <line x1="18" y1="20" x2="12" y2="17" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );

    case "membranes":
      // Phospholipid bilayer cross section
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <circle cx="9" cy="10" r="2.5" fill={color} />
          <path d="M 8.5 13 L 8.5 17 M 10 13 L 10 17" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="18" cy="10" r="2.5" fill={color} />
          <path d="M 17.5 13 L 17.5 17 M 19 13 L 19 17" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="27" cy="10" r="2.5" fill={color} />
          <path d="M 26.5 13 L 26.5 17 M 28 13 L 28 17" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="9" cy="26" r="2.5" fill={color} />
          <path d="M 8.5 23 L 8.5 19 M 10 23 L 10 19" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="18" cy="26" r="2.5" fill={color} />
          <path d="M 17.5 23 L 17.5 19 M 19 23 L 19 19" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
          <circle cx="27" cy="26" r="2.5" fill={color} />
          <path d="M 26.5 23 L 26.5 19 M 28 23 L 28 19" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );

    case "cell-structures":
      // Mitochondrion with folded inner cristae
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <ellipse cx="18" cy="18" rx="14" ry="8.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.75" />
          <path
            d="M 8 18 C 11 15 11 21 14 18 C 17 15 17 21 20 18 C 23 15 23 21 26 18 C 28 16 28 20 29 18"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case "epithelium":
      // Polarized columnar epithelial cell barrier
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <rect x="6" y="9" width="7" height="19" rx="1.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.25" />
          <circle cx="9.5" cy="21" r="1.75" fill={color} />
          <rect x="14.5" y="9" width="7" height="19" rx="1.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.25" />
          <circle cx="18" cy="21" r="1.75" fill={color} />
          <rect x="23" y="9" width="7" height="19" rx="1.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.25" />
          <circle cx="26.5" cy="21" r="1.75" fill={color} />
          <line x1="4" y1="28" x2="32" y2="28" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 7 9 L 8 6 M 10 9 L 11 6 M 15.5 9 L 16.5 6 M 18.5 9 L 19.5 6 M 24 9 L 25 6 M 27 9 L 28 6" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      );

    case "lipids-and-carbs":
      // Carbohydrate hexose pyranose ring
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <polygon
            points="18,7 28,13 28,24 18,30 8,24 8,13"
            fill={color}
            fillOpacity="0.2"
            stroke={color}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <circle cx="18" cy="7" r="1.75" fill={color} />
          <circle cx="28" cy="13" r="1.75" fill={color} />
          <circle cx="28" cy="24" r="1.75" fill={color} />
          <circle cx="18" cy="30" r="1.75" fill={color} />
          <circle cx="8" cy="24" r="1.75" fill={color} />
          <circle cx="8" cy="13" r="1.75" fill={color} />
          <line x1="28" y1="13" x2="32" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case "chemistry":
      // Aromatic benzene ring
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <polygon points="18,6 28,12 28,24 18,30 8,24 8,12" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
          <circle cx="18" cy="18" r="5.5" stroke={color} strokeWidth="1.5" strokeDasharray="3,2" />
          <circle cx="18" cy="6" r="1.75" fill={color} />
          <circle cx="28" cy="12" r="1.75" fill={color} />
          <circle cx="28" cy="24" r="1.75" fill={color} />
          <circle cx="18" cy="30" r="1.75" fill={color} />
          <circle cx="8" cy="24" r="1.75" fill={color} />
          <circle cx="8" cy="12" r="1.75" fill={color} />
        </svg>
      );

    case "graphs-and-symbols":
      // Scientific data graph with bar chart and metrics
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <line x1="6" y1="6" x2="6" y2="30" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
          <line x1="6" y1="30" x2="30" y2="30" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
          <rect x="9" y="19" width="4.5" height="11" rx="1" fill={color} fillOpacity="0.4" />
          <rect x="16" y="13" width="4.5" height="17" rx="1" fill={color} fillOpacity="0.7" />
          <rect x="23" y="8" width="4.5" height="22" rx="1" fill={color} />
          <path d="M 11 17 L 18 11 L 25 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case "arrows-and-shapes":
      // Pathway arrow and geometric shapes
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <path
            d="M 6 18 L 20 18 L 20 12 L 30 20 L 20 28 L 20 22 L 6 22 Z"
            fill={color}
            fillOpacity="0.3"
            stroke={color}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="9" r="3" fill={color} fillOpacity="0.5" />
          <rect x="23" y="6" width="6" height="6" rx="1.5" stroke={color} strokeWidth="1.5" />
        </svg>
      );

    case "biomojii":
      // Cheerful cell character with friendly face
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <circle cx="18" cy="18" r="14" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.75" />
          <circle cx="13" cy="15" r="1.75" fill={color} />
          <circle cx="23" cy="15" r="1.75" fill={color} />
          <path d="M 14 21 Q 18 26 22 21" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
          <ellipse cx="10" cy="19" rx="1.5" ry="1" fill={color} fillOpacity="0.5" />
          <ellipse cx="26" cy="19" rx="1.5" ry="1" fill={color} fillOpacity="0.5" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 36 36" width="24" height="24" fill="none">
          <circle cx="18" cy="18" r="13" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.75" />
          <path d="M 13 18 L 16 21 L 23 14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export interface CategoryThumbnailProps {
  slug: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const CategoryThumbnail: React.FC<CategoryThumbnailProps> = ({
  slug,
  size = 42,
  style,
}) => {
  const theme = getCategoryTheme(slug);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "10px",
        backgroundColor: theme.background,
        border: `1px solid ${theme.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.02)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        ...style,
      }}
    >
      {renderCategoryVector(slug, theme.accent)}
    </div>
  );
};

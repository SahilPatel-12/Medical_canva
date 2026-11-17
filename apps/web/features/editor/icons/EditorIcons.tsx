import React from "react";

// ==========================================
// Editor icon set — custom duotone icons drawn on a 24px grid.
// Outline strokes use currentColor; the soft second tone (`.ei-tint`) is styled in
// globals.css and gets stronger on active / pressed controls.
// ==========================================

export interface EditorIconProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
}

const make = (name: string, body: React.ReactNode) => {
  const Icon: React.FC<EditorIconProps> = ({ size = 20, className, ...rest }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={`ei${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {body}
    </svg>
  );
  Icon.displayName = name;
  return Icon;
};

const T = "ei-tint";

// ---------- Navigation ----------

/** Scientific asset library */
export const AssetsIcon = make(
  "AssetsIcon",
  <>
    <path className={T} d="M6.4 15h11.2l1.8 3.6A1.6 1.6 0 0 1 18 21H6a1.6 1.6 0 0 1-1.4-2.4z" />
    <path d="M9 3h6M10 3v5.6l-5.4 10A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.4-2.4l-5.4-10V3" />
    <path d="M6.6 15h10.8" />
    <circle cx="10.5" cy="18" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="13.8" cy="17.2" r="0.6" fill="currentColor" stroke="none" />
  </>
);

/** Shapes, lines and symbols */
export const ElementsIcon = make(
  "ElementsIcon",
  <>
    <path className={T} d="M12 3l4.3 7H7.7z" />
    <path d="M12 3l4.3 7H7.7z" />
    <circle cx="7" cy="16.8" r="3.7" />
    <rect className={T} x="13.3" y="13.1" width="7.4" height="7.4" rx="1.6" />
    <rect x="13.3" y="13.1" width="7.4" height="7.4" rx="1.6" />
  </>
);

export const TextIcon = make(
  "TextIcon",
  <>
    <rect className={T} x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M8.3 8.6h7.4M12 8.6v7.6" />
  </>
);

export const UploadsIcon = make(
  "UploadsIcon",
  <>
    <path className={T} d="M7.4 19.3h10.2a4.1 4.1 0 0 0 .5-8.2 6.1 6.1 0 0 0-11.8 1.2 3.5 3.5 0 0 0 1.1 7z" />
    <path d="M7.4 19.3h10.2a4.1 4.1 0 0 0 .5-8.2 6.1 6.1 0 0 0-11.8 1.2 3.5 3.5 0 0 0 1.1 7z" />
    <path d="M12 16.6v-5.4M9.6 13.4 12 11l2.4 2.4" />
  </>
);

export const LayersIcon = make(
  "LayersIcon",
  <>
    <path className={T} d="M12 3.2 20.8 7.7 12 12.2 3.2 7.7z" />
    <path d="M12 3.2 20.8 7.7 12 12.2 3.2 7.7z" />
    <path d="m3.2 12 8.8 4.5 8.8-4.5M3.2 16.3l8.8 4.5 8.8-4.5" />
  </>
);

/** Edit / adjust options */
export const AdjustIcon = make(
  "AdjustIcon",
  <>
    <path d="M4 7h8.6M17.4 7H20M4 17h2.6M11.4 17H20" />
    <circle className={T} cx="15" cy="7" r="2.4" />
    <circle cx="15" cy="7" r="2.4" />
    <circle className={T} cx="9" cy="17" r="2.4" />
    <circle cx="9" cy="17" r="2.4" />
  </>
);

export const PageIcon = make(
  "PageIcon",
  <>
    <path className={T} d="M6.2 3h7.6l4.7 4.7v12.1a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 19.8V4.2A1.2 1.2 0 0 1 6.2 3z" />
    <path d="M6.2 3h7.6l4.7 4.7v12.1a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 19.8V4.2A1.2 1.2 0 0 1 6.2 3z" />
    <path d="M13.6 3.2v3.6a1 1 0 0 0 1 1h3.7" />
  </>
);

// ---------- Element kinds ----------

/** Scientific illustration (SVG) */
export const IllustrationIcon = make(
  "IllustrationIcon",
  <>
    <path d="m9.3 7.6 5.6.9M8.2 9.7l1.5 4.6M15.8 10.9l-3.2 3.6" />
    <circle className={T} cx="7" cy="7" r="2.6" />
    <circle cx="7" cy="7" r="2.6" />
    <circle cx="17.2" cy="9" r="2.2" />
    <circle className={T} cx="10.6" cy="17.3" r="3.2" />
    <circle cx="10.6" cy="17.3" r="3.2" />
  </>
);

export const ShapeIcon = make(
  "ShapeIcon",
  <>
    <circle cx="9" cy="9" r="5.5" />
    <rect className={T} x="10" y="10" width="10.5" height="10.5" rx="2" />
    <rect x="10" y="10" width="10.5" height="10.5" rx="2" />
  </>
);

export const ImageIcon = make(
  "ImageIcon",
  <>
    <rect x="3" y="4.5" width="18" height="15" rx="2.8" />
    <path className={T} d="m3.4 17.6 5.2-5.2a1.3 1.3 0 0 1 1.8 0l3.3 3.3 2-2a1.3 1.3 0 0 1 1.8 0l3.2 3.2v.9a1.7 1.7 0 0 1-1.7 1.7H5.2a1.8 1.8 0 0 1-1.8-1.9z" />
    <path d="m3.4 17.4 5.2-5a1.3 1.3 0 0 1 1.8 0l5.6 5.6M14.2 15.4l1.6-1.6a1.3 1.3 0 0 1 1.8 0l3 3" />
    <circle cx="15.8" cy="8.8" r="1.5" />
  </>
);

// ---------- Editing actions ----------

/** Select parts inside an illustration */
export const EditPartsIcon = make(
  "EditPartsIcon",
  <>
    <rect x="3" y="3" width="13.5" height="13.5" rx="2.5" strokeDasharray="2.6 2.6" />
    <path className={T} d="m11.2 11.2 9.3 3.5-4 1.5-1.5 4z" />
    <path d="m11.2 11.2 9.3 3.5-4 1.5-1.5 4z" />
  </>
);

export const UngroupIcon = make(
  "UngroupIcon",
  <>
    <rect className={T} x="3" y="3" width="9.5" height="9.5" rx="2" />
    <rect x="3" y="3" width="9.5" height="9.5" rx="2" />
    <rect x="11.5" y="11.5" width="9.5" height="9.5" rx="2" strokeDasharray="2.4 2.2" />
  </>
);

/** Select the group around the current part */
export const SelectParentIcon = make(
  "SelectParentIcon",
  <>
    <rect x="3" y="3" width="18" height="18" rx="3.5" />
    <rect className={T} x="11.5" y="11.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="11.5" y="11.5" width="6.5" height="6.5" rx="1.5" />
    <path d="M10.4 10.4 6.6 6.6M6.6 10V6.6H10" />
  </>
);

/** Go inside the selected group */
export const GoInsideIcon = make(
  "GoInsideIcon",
  <>
    <rect x="3" y="3" width="18" height="18" rx="3.5" />
    <rect className={T} x="11.5" y="11.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="11.5" y="11.5" width="6.5" height="6.5" rx="1.5" />
    <path d="m6.6 6.6 3.8 3.8M10.4 7v3.4H7" />
  </>
);

export const TransparencyIcon = make(
  "TransparencyIcon",
  <>
    <path className={T} d="M12 3.5a8.5 8.5 0 0 1 0 17z" />
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17" />
    <path d="M12 7.5h3.6M12 12h5.5M12 16.5h3.6" strokeWidth="1.4" />
  </>
);

export const DuplicateIcon = make(
  "DuplicateIcon",
  <>
    <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    <rect className={T} x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M14.5 12v5M12 14.5h5" />
  </>
);

export const DeleteIcon = make(
  "DeleteIcon",
  <>
    <path className={T} d="M6 6.6h12l-.9 12.5a2 2 0 0 1-2 1.9H8.9a2 2 0 0 1-2-1.9z" />
    <path d="M4 6.6h16M9.4 6.6V4.9a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.7" />
    <path d="M6 6.6l.9 12.5a2 2 0 0 0 2 1.9h6.2a2 2 0 0 0 2-1.9L18 6.6M10 10.6v6M14 10.6v6" />
  </>
);

export const LockIcon = make(
  "LockIcon",
  <>
    <rect className={T} x="4.5" y="10.5" width="15" height="10.5" rx="2.6" />
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.6" />
    <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9M12 14.6v2.4" />
  </>
);

export const UnlockIcon = make(
  "UnlockIcon",
  <>
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.6" />
    <path d="M8 10.5V7.6a4 4 0 0 1 7.7-1.6M12 14.6v2.4" />
  </>
);

export const AddPageIcon = make(
  "AddPageIcon",
  <>
    <path className={T} d="M6.2 3h7.6l4.7 4.7v12.1a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 19.8V4.2A1.2 1.2 0 0 1 6.2 3z" />
    <path d="M6.2 3h7.6l4.7 4.7v12.1a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 19.8V4.2A1.2 1.2 0 0 1 6.2 3z" />
    <path d="M13.6 3.2v3.6a1 1 0 0 0 1 1h3.7M11.7 11v6M8.7 14h6" />
  </>
);

// ---------- Layer order ----------

export const BringForwardIcon = make(
  "BringForwardIcon",
  <>
    <path className={T} d="M3 15.6 12 20l9-4.4-9-4.4z" />
    <path d="M3 15.6 12 20l9-4.4-9-4.4z" />
    <path d="M12 9V3.4M9.2 6.2 12 3.4l2.8 2.8" />
  </>
);

export const SendBackwardIcon = make(
  "SendBackwardIcon",
  <>
    <path className={T} d="M3 8.4 12 12.8l9-4.4L12 4z" />
    <path d="M3 8.4 12 12.8l9-4.4L12 4z" />
    <path d="M12 15v5.6M9.2 17.8l2.8 2.8 2.8-2.8" />
  </>
);

export const BringToFrontIcon = make(
  "BringToFrontIcon",
  <>
    <path className={T} d="M3 16.2 12 20.6l9-4.4-9-4.4z" />
    <path d="M3 16.2 12 20.6l9-4.4-9-4.4z" />
    <path d="M12 10V5.6M9.4 8.2 12 5.6l2.6 2.6M7.5 2.8h9" />
  </>
);

export const SendToBackIcon = make(
  "SendToBackIcon",
  <>
    <path className={T} d="M3 7.8 12 12.2l9-4.4-9-4.4z" />
    <path d="M3 7.8 12 12.2l9-4.4-9-4.4z" />
    <path d="M12 14v4.4M9.4 15.8l2.6 2.6 2.6-2.6M7.5 21.2h9" />
  </>
);

// ---------- Canvas controls ----------

export const NotesIcon = make(
  "NotesIcon",
  <>
    <path className={T} d="M5.2 4h13.6A1.2 1.2 0 0 1 20 5.2v9.3L14.5 20H5.2A1.2 1.2 0 0 1 4 18.8V5.2A1.2 1.2 0 0 1 5.2 4z" />
    <path d="M5.2 4h13.6A1.2 1.2 0 0 1 20 5.2v9.3L14.5 20H5.2A1.2 1.2 0 0 1 4 18.8V5.2A1.2 1.2 0 0 1 5.2 4z" />
    <path d="M20 14.5h-4.3a1.2 1.2 0 0 0-1.2 1.2V20M8 9h8M8 12.5h4.5" />
  </>
);

export const GridViewIcon = make(
  "GridViewIcon",
  <>
    <rect className={T} x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect className={T} x="13.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </>
);

export const FitScreenIcon = make(
  "FitScreenIcon",
  <>
    <path d="M3.5 8.5V5a1.5 1.5 0 0 1 1.5-1.5h3.5M15.5 3.5H19A1.5 1.5 0 0 1 20.5 5v3.5M20.5 15.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5M8.5 20.5H5A1.5 1.5 0 0 1 3.5 19v-3.5" />
    <rect className={T} x="7.5" y="8.5" width="9" height="7" rx="1.5" />
    <rect x="7.5" y="8.5" width="9" height="7" rx="1.5" />
  </>
);

export const PaletteIcon = make(
  "PaletteIcon",
  <>
    <path
      className={T}
      d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 1.9-.9 1.9-1.8 0-1-.8-1.4-.8-2.3a1.6 1.6 0 0 1 1.7-1.6h2a3.7 3.7 0 0 0 3.7-3.7C20.5 6.9 16.7 3.5 12 3.5z"
    />
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.3 0 1.9-.9 1.9-1.8 0-1-.8-1.4-.8-2.3a1.6 1.6 0 0 1 1.7-1.6h2a3.7 3.7 0 0 0 3.7-3.7C20.5 6.9 16.7 3.5 12 3.5z" />
    <circle cx="7.6" cy="11.4" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="10.2" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="14.6" cy="7.8" r="1.1" fill="currentColor" stroke="none" />
  </>
);

// ---------- Right-click menu ----------

export const CutIcon = make(
  "CutIcon",
  <>
    <circle className={T} cx="6.5" cy="17" r="3" />
    <circle className={T} cx="17.5" cy="17" r="3" />
    <circle cx="6.5" cy="17" r="3" />
    <circle cx="17.5" cy="17" r="3" />
    <path d="M8.6 14.9 17 3.5M15.4 14.9 7 3.5" />
  </>
);

export const CopyIcon = make(
  "CopyIcon",
  <>
    <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    <rect className={T} x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
  </>
);

export const PasteIcon = make(
  "PasteIcon",
  <>
    <path className={T} d="M6.5 5h11a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-13A1.5 1.5 0 0 1 6.5 5z" />
    <path d="M8.5 5h-2A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5h-2" />
    <rect x="8.5" y="3" width="7" height="4" rx="1.2" />
    <path d="M9 12.5h6M9 16h4" />
  </>
);

export const FlipHorizontalIcon = make(
  "FlipHorizontalIcon",
  <>
    <path className={T} d="M9.5 6.5v11L3 12z" />
    <path d="M9.5 6.5v11L3 12z" />
    <path d="M14.5 6.5v11L21 12z" strokeDasharray="2.2 2" />
    <path d="M12 3v2.5M12 9v2M12 14.5v2M12 19.5V21" />
  </>
);

export const FlipVerticalIcon = make(
  "FlipVerticalIcon",
  <>
    <path className={T} d="M6.5 9.5h11L12 3z" />
    <path d="M6.5 9.5h11L12 3z" />
    <path d="M6.5 14.5h11L12 21z" strokeDasharray="2.2 2" />
    <path d="M3 12h2.5M9 12h2M14.5 12h2M19.5 12H21" />
  </>
);

export const FlipIcon = make(
  "FlipIcon",
  <>
    <path className={T} d="M9.5 6.5v11L3 12z" />
    <path d="M9.5 6.5v11L3 12z" />
    <path d="M14.5 6.5v11L21 12z" />
    <path d="M12 3v18" strokeDasharray="2 2.4" />
  </>
);

export const ArrangeIcon = make(
  "ArrangeIcon",
  <>
    <rect x="3.5" y="9.5" width="11" height="11" rx="2" />
    <rect className={T} x="9.5" y="3.5" width="11" height="11" rx="2" />
    <rect x="9.5" y="3.5" width="11" height="11" rx="2" />
  </>
);

export const AlignIcon = make(
  "AlignIcon",
  <>
    <path d="M4 3.5v17" />
    <rect className={T} x="7" y="6" width="12" height="4.5" rx="1.4" />
    <rect x="7" y="6" width="12" height="4.5" rx="1.4" />
    <rect className={T} x="7" y="13.5" width="7.5" height="4.5" rx="1.4" />
    <rect x="7" y="13.5" width="7.5" height="4.5" rx="1.4" />
  </>
);

export const GroupIcon = make(
  "GroupIcon",
  <>
    <rect x="3" y="3" width="18" height="18" rx="2.5" strokeDasharray="2.5 2.5" />
    <rect className={T} x="6.5" y="6.5" width="6" height="6" rx="1.4" />
    <rect x="6.5" y="6.5" width="6" height="6" rx="1.4" />
    <circle className={T} cx="15" cy="15" r="2.8" />
    <circle cx="15" cy="15" r="2.8" />
  </>
);

export const SelectAllIcon = make(
  "SelectAllIcon",
  <>
    <path d="M3.5 7V5A1.5 1.5 0 0 1 5 3.5h2M10.5 3.5h3M17 3.5h2A1.5 1.5 0 0 1 20.5 5v2M20.5 10.5v3M20.5 17v2a1.5 1.5 0 0 1-1.5 1.5h-2M13.5 20.5h-3M7 20.5H5A1.5 1.5 0 0 1 3.5 19v-2M3.5 13.5v-3" />
    <path className={T} d="M8.5 8.5l7.5 3-3 1.5-1.5 3z" />
    <path d="M8.5 8.5l7.5 3-3 1.5-1.5 3z" />
  </>
);

export const ChevronRightIcon = make("ChevronRightIcon", <path d="M9.5 6l6 6-6 6" />);

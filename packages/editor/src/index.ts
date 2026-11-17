/**
 * @design-platform/editor public API
 */

export const EDITOR_VERSION = "0.1.0";

// Canvas & Engine
export * from "./canvas/CanvasEngine";
export * from "./canvas/svgUtils";
export * from "./canvas/svgColors";
export * from "./canvas/svgFlip";

// Elements & Sample Library
export * from "./elements/sampleAssets";
export * from "./elements/taxonomy";
export * from "./elements/shapeGeometry";

// State, Store & Hook
export * from "./state/EditorStore";
export * from "./state/useEditor";

// Commands & History
export * from "./commands/history";

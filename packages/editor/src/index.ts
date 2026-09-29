/**
 * Editor package version
 */
export const EDITOR_VERSION = "0.1.0";

/**
 * Basic canvas dimension specifications (for future editor engine)
 */
export interface CanvasDimensions {
  width: number;
  height: number;
  unit: "px" | "mm" | "in";
}

/**
 * Editor configuration bootstrap interface
 */
export interface EditorBootstrapConfig {
  containerId: string;
  initialDimensions?: CanvasDimensions;
  readOnly?: boolean;
}

export type ImportMode = "auto" | "single" | "horizontal" | "vertical" | "grid";

export type PanelDecision = "pending" | "keep" | "ignore";

export type ImportSessionPanel = {
  id: string;
  label: string;
  decision: PanelDecision;
};

export type ImportSession = {
  fileName: string;
  sourceDataUrl: string;
  importMode: ImportMode;
  panels: ImportSessionPanel[];
};

import type { ImportMode, ImportSession, PanelDecision } from "./types";

export function createImportSession(input: { fileName: string; sourceDataUrl: string }): ImportSession {
  return {
    fileName: input.fileName,
    sourceDataUrl: input.sourceDataUrl,
    importMode: "auto",
    panels: [],
  };
}

export function setPanelDecision(session: ImportSession, panelId: string, decision: PanelDecision): ImportSession {
  return {
    ...session,
    panels: session.panels.map((panel) => (panel.id === panelId ? { ...panel, decision } : panel)),
  };
}

export function setImportMode(session: ImportSession, importMode: ImportMode): ImportSession {
  return {
    ...session,
    importMode,
  };
}

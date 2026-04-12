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

export function getKeptPanelIds(session: ImportSession): string[] {
  const explicitlyKept = session.panels.filter((panel) => panel.decision === "keep").map((panel) => panel.id);
  if (explicitlyKept.length > 0) {
    return explicitlyKept;
  }

  const nonIgnored = session.panels.filter((panel) => panel.decision !== "ignore").map((panel) => panel.id);
  return nonIgnored;
}

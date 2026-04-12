import { describe, expect, it } from "vitest";

import { createImportSession, setPanelDecision, setImportMode } from "./state";

describe("import session state", () => {
  it("starts with automatic mode and pending decisions", () => {
    const session = createImportSession({ fileName: "figure.png", sourceDataUrl: "data:image/png;base64,test" });
    expect(session.importMode).toBe("auto");
    expect(session.panels).toEqual([]);
  });

  it("updates per-panel keep or ignore decisions", () => {
    const base = {
      ...createImportSession({ fileName: "figure.png", sourceDataUrl: "data:image/png;base64,test" }),
      panels: [
        {
          id: "panel_a",
          label: "Panel A",
          decision: "pending" as const,
        },
      ],
    };

    const next = setPanelDecision(base, "panel_a", "keep");
    expect(next.panels[0]?.decision).toBe("keep");
  });

  it("changes import mode explicitly", () => {
    const session = createImportSession({ fileName: "figure.png", sourceDataUrl: "data:image/png;base64,test" });
    const updated = setImportMode(session, "grid");
    expect(updated.importMode).toBe("grid");
  });
});

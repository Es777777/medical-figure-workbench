import { describe, expect, it } from "vitest";

import { buildProjectExportPayload, buildSceneExportPayload } from "./export-utils";

describe("export payload", () => {
  it("creates a JSON export payload from scene metadata", () => {
    const payload = buildSceneExportPayload({ id: "scene_1", nodes: [] } as any);
    expect(payload.fileName).toContain("scene-1");
    expect(payload.mimeType).toBe("application/json");
  });

  it("creates a JSON project export payload", () => {
    const payload = buildProjectExportPayload({ id: "project_1", title: "Paper Figures", tasks: [] } as any);
    expect(payload.fileName).toContain("project-1");
    expect(payload.mimeType).toBe("application/json");
  });
});

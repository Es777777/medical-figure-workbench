import { describe, expect, it } from "vitest";

import { getExportValidationReport } from "./validation";

describe("export validation", () => {
  it("warns when a scene has no nodes", () => {
    const report = getExportValidationReport({ id: "task_1", title: "Figure 1", scene: { id: "scene", nodes: [] } } as any);
    expect(report.warnings[0]?.code).toBe("empty-scene");
  });

  it("warns when text nodes are empty", () => {
    const report = getExportValidationReport({
      id: "task_1",
      title: "Figure 1",
      scene: { id: "scene", nodes: [{ id: "t1", type: "text", text: "" }] },
    } as any);
    expect(report.warnings.map((item) => item.code)).toContain("empty-text");
  });
});

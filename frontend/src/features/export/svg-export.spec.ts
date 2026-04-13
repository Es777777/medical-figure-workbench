import { describe, expect, it } from "vitest";

import { buildTaskSvgExport } from "./svg-export";

describe("task SVG export", () => {
  it("creates an SVG string with a root svg element", () => {
    const result = buildTaskSvgExport({
      title: "Figure 1",
      scene: { canvas: { width: 1200, height: 800 }, nodes: [] },
    } as any);
    expect(result.content).toContain("<svg");
  });
});

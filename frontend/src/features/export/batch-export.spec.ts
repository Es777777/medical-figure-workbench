import { describe, expect, it } from "vitest";

import { buildBatchTaskJsonExports, buildBatchTaskPngExports, buildBatchTaskSvgExports } from "./batch-export";

describe("batch export", () => {
  it("creates one JSON export per task", () => {
    const results = buildBatchTaskJsonExports([
      { id: "task_1", title: "Figure 1", scene: { id: "scene_1", nodes: [] } },
      { id: "task_2", title: "Figure 2", scene: { id: "scene_2", nodes: [] } },
    ] as any);
    expect(results).toHaveLength(2);
    expect(results[0]?.taskId).toContain("task_1");
  });

  it("creates one SVG export per task", () => {
    const results = buildBatchTaskSvgExports([
      { id: "task_1", title: "Figure 1", scene: { canvas: { width: 100, height: 100 }, nodes: [] } },
      { id: "task_2", title: "Figure 2", scene: { canvas: { width: 100, height: 100 }, nodes: [] } },
    ] as any);
    expect(results).toHaveLength(2);
    expect(results[1]?.fileName).toContain("task_2");
  });

  it("creates one PNG export placeholder per task", () => {
    const results = buildBatchTaskPngExports([
      { id: "task_1", title: "Figure 1", scene: { canvas: { width: 100, height: 100 }, nodes: [] } },
      { id: "task_2", title: "Figure 2", scene: { canvas: { width: 100, height: 100 }, nodes: [] } },
    ] as any);
    expect(results).toHaveLength(2);
    expect(results[0]?.fileName).toContain("task_1");
    expect(results[0]?.mimeType).toBe("image/png");
    expect(results[0]?.render.width).toBe(100);
    expect(results[0]?.render.height).toBe(100);
    expect(results[0]?.bundlePath).toContain("task_1");
    expect(results[0]?.bundleName).toContain("png-batch");
  });
});

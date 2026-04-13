import { describe, expect, it } from "vitest";

import { buildBatchTaskJsonExports } from "./batch-export";

describe("batch export", () => {
  it("creates one JSON export per task", () => {
    const results = buildBatchTaskJsonExports([
      { id: "task_1", title: "Figure 1", scene: { id: "scene_1", nodes: [] } },
      { id: "task_2", title: "Figure 2", scene: { id: "scene_2", nodes: [] } },
    ] as any);
    expect(results).toHaveLength(2);
    expect(results[0]?.taskId).toContain("task_1");
  });
});

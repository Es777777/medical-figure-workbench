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

  it("includes text nodes in SVG output", () => {
    const result = buildTaskSvgExport({
      id: "task_1",
      title: "Figure 1",
      scene: {
        canvas: { width: 1200, height: 800 },
        nodes: [{ type: "text", text: "Hello", transform: { x: 20, y: 30 } }],
      },
    } as any);
    expect(result.content).toContain("<text");
    expect(result.content).toContain("Hello");
  });

  it("includes panel and image placeholders in SVG output", () => {
    const result = buildTaskSvgExport({
      id: "task_2",
      title: "Figure 2",
      scene: {
        canvas: { width: 1200, height: 800 },
        nodes: [
          { type: "panel", transform: { x: 10, y: 10, width: 300, height: 200 } },
          { type: "image", transform: { x: 20, y: 20, width: 280, height: 160 } },
        ],
      },
    } as any);
    expect(result.content).toContain("<rect");
    expect(result.content).toContain('width="300"');
  });

  it("includes arrow output in SVG", () => {
    const result = buildTaskSvgExport({
      id: "task_3",
      title: "Figure 3",
      scene: {
        canvas: { width: 1200, height: 800 },
        nodes: [
          {
            type: "arrow",
            points: [
              { x: 10, y: 20 },
              { x: 100, y: 120 },
            ],
            transform: { x: 10, y: 20, width: 90, height: 100 },
            style: { stroke: "#38558f", strokeWidth: 4 },
          },
        ],
      },
    } as any);
    expect(result.content).toContain("<line");
    expect(result.content).toContain('x1="10"');
  });

  it("includes shape output in SVG", () => {
    const result = buildTaskSvgExport({
      id: "task_4",
      title: "Figure 4",
      scene: {
        canvas: { width: 1200, height: 800 },
        nodes: [
          {
            type: "shape",
            shape: "diamond",
            transform: { x: 80, y: 120, width: 140, height: 140 },
            style: { fill: "#d9efe9", stroke: "#0c8f8a", strokeWidth: 3 },
          },
        ],
      },
    } as any);
    expect(result.content).toContain("<polygon");
    expect(result.content).toContain("#0c8f8a");
  });
});

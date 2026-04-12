import { describe, expect, it } from "vitest";

import type { SceneGraph } from "@shared/scene-graph";

import { buildPanelResourceRecommendations, insertSingleFigurePanelIntoScene } from "./figure-workbench";

const scene = {
  id: "scene_test",
  version: 1,
  kind: "scientific-figure",
  canvas: { width: 1200, height: 800, backgroundColor: "#fff" },
  source: {
    assetId: "src",
    originalUri: "/original.png",
    normalizedUri: "/normalized.png",
    originalDetectedFormat: "png",
    normalizedMimeType: "image/png",
    width: 1200,
    height: 800,
  },
  nodes: [],
} satisfies SceneGraph;

describe("figure workbench helpers", () => {
  it("recommends relevant assets from panel hints", () => {
    const results = buildPanelResourceRecommendations(
      {
        label: "Panel A",
        recognizedText: "renal tubular injury",
        semanticHints: [{ id: "kidney-clean", label: "Kidney", category: "organ", score: 3 }],
      },
      "en",
    );

    expect(results[0]?.id).toBe("kidney-clean");
  });

  it("imports only one chosen panel into the scene", () => {
    const result = insertSingleFigurePanelIntoScene(
      scene,
      {
        sourceName: "figure.png",
        sourceDataUrl: "data:image/png;base64,test",
        width: 1200,
        height: 800,
        summary: "summary",
        recommendedPrompt: "prompt",
        detectedKeywords: [],
        mergedRecognizedText: "",
        backendDrafts: null,
        panels: [
          {
            id: "panel_a",
            label: "Panel A",
            roleHint: "entity",
            bbox: { x: 0, y: 0, width: 200, height: 120 },
            previewUri: "data:image/png;base64,a",
            confidence: 0.9,
            semanticHints: [],
            recognizedText: "",
            textConfidence: null,
          },
        ],
      },
      "panel_a",
      "en",
    );

    expect(result.scene.nodes).toHaveLength(2);
    expect(result.selectedNodeId).toContain("img");
  });
});

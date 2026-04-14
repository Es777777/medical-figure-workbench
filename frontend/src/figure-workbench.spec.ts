import { describe, expect, it } from "vitest";

import type { SceneGraph } from "@shared/scene-graph";

import {
  __figureWorkbenchTestables,
  buildPanelResourceRecommendations,
  buildSplitRectsForMode,
  insertFigurePanelsIntoScene,
  insertSingleFigurePanelIntoScene,
} from "./figure-workbench";

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

function createImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = 255;
  }

  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

function paintRect(imageData: ImageData, rect: { x: number; y: number; width: number; height: number }, color: [number, number, number]) {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const offset = (y * imageData.width + x) * 4;
      imageData.data[offset] = color[0];
      imageData.data[offset + 1] = color[1];
      imageData.data[offset + 2] = color[2];
      imageData.data[offset + 3] = 255;
    }
  }
}

function paintDiamond(imageData: ImageData, centerX: number, centerY: number, radius: number, color: [number, number, number]) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) {
        continue;
      }
      if (Math.abs(x - centerX) + Math.abs(y - centerY) > radius) {
        continue;
      }
      const offset = (y * imageData.width + x) * 4;
      imageData.data[offset] = color[0];
      imageData.data[offset + 1] = color[1];
      imageData.data[offset + 2] = color[2];
      imageData.data[offset + 3] = 255;
    }
  }
}

describe("figure workbench helpers", () => {
  it("creates two vertical panels for horizontal mode", () => {
    const rects = buildSplitRectsForMode(1200, 600, "horizontal");
    expect(rects).toHaveLength(2);
    expect(rects[0]?.width).toBe(600);
  });

  it("creates four panels for grid mode", () => {
    const rects = buildSplitRectsForMode(1200, 800, "grid");
    expect(rects).toHaveLength(4);
  });

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

  it("keeps the real split preview when importing panels", () => {
    const previewUri = "data:image/png;base64,real-split-preview";
    const result = insertFigurePanelsIntoScene(
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
            previewUri,
            confidence: 0.9,
            semanticHints: [{ id: "kidney-clean", label: "Kidney", category: "organ", score: 3 }],
            recognizedText: "",
            textConfidence: null,
          },
        ],
      },
      "en",
    );

    const importedImage = result.scene.nodes.find((node) => node.type === "image");
    expect(importedImage?.type).toBe("image");
    if (importedImage?.type === "image") {
      expect(importedImage.asset.uri).toBe(previewUri);
      expect(importedImage.asset.sourceKind).toBe("extracted");
    }
  });

  it("keeps contour candidates instead of collapsing back to a full-image box", () => {
    const resolved = __figureWorkbenchTestables.resolveAutoPanelRects(
      [{ x: 0, y: 0, width: 1200, height: 800 }],
      [{ x: 0, y: 0, width: 1200, height: 800 }],
      [
        { x: 0, y: 0, width: 1200, height: 800 },
        { x: 56, y: 96, width: 248, height: 220 },
        { x: 360, y: 104, width: 286, height: 214 },
        { x: 724, y: 112, width: 244, height: 210 },
      ],
      1200,
      800,
    );

    expect(resolved).toHaveLength(3);
    expect(resolved.some((rect) => rect.width >= 1150 && rect.height >= 760)).toBe(false);
  });

  it("drops decorative full-width strips and expands the main panels back into place", () => {
    const resolved = __figureWorkbenchTestables.resolveAutoPanelRects(
      [{ x: 0, y: 0, width: 1200, height: 800 }],
      [{ x: 0, y: 0, width: 1200, height: 800 }],
      [
        { x: 0, y: 0, width: 1200, height: 120 },
        { x: 0, y: 140, width: 520, height: 420 },
        { x: 560, y: 140, width: 640, height: 420 },
        { x: 0, y: 700, width: 1200, height: 100 },
      ],
      1200,
      800,
    );

    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.y).toBe(120);
    expect(resolved[0]?.height).toBe(580);
  });

  it("finds multiple contour islands in an irregular graphic", () => {
    const imageData = createImageData(360, 220);
    paintRect(imageData, { x: 24, y: 28, width: 86, height: 80 }, [24, 117, 147]);
    paintDiamond(imageData, 182, 98, 42, [211, 129, 64]);
    paintRect(imageData, { x: 256, y: 126, width: 76, height: 62 }, [41, 66, 126]);

    const rects = __figureWorkbenchTestables.detectContourGridRects(imageData, 360, 220);

    expect(rects.length).toBeGreaterThan(1);
    expect(rects.some((rect) => rect.width >= 340 && rect.height >= 200)).toBe(false);
  });

  it("separates major regions even when thin connector lines link them", () => {
    const imageData = createImageData(420, 240);
    paintRect(imageData, { x: 22, y: 54, width: 110, height: 118 }, [30, 121, 143]);
    paintRect(imageData, { x: 292, y: 42, width: 92, height: 132 }, [201, 126, 43]);
    paintRect(imageData, { x: 130, y: 108, width: 162, height: 6 }, [82, 92, 104]);

    const rects = __figureWorkbenchTestables.detectContourGridRects(imageData, 420, 240);

    expect(rects.length).toBeGreaterThan(1);
    expect(rects.some((rect) => rect.width >= 390 && rect.height >= 200)).toBe(false);
  });

  it("refines a large parent panel into smaller nested sub-panels", () => {
    const imageData = createImageData(720, 420);
    paintRect(imageData, { x: 18, y: 34, width: 112, height: 352 }, [30, 121, 143]);
    paintRect(imageData, { x: 184, y: 70, width: 150, height: 260 }, [201, 126, 43]);
    paintRect(imageData, { x: 378, y: 70, width: 154, height: 260 }, [62, 92, 150]);
    paintRect(imageData, { x: 582, y: 24, width: 96, height: 360 }, [102, 96, 88]);

    const refined = __figureWorkbenchTestables.refineAutoDetectedRects(
      imageData,
      [
        { x: 18, y: 34, width: 112, height: 352 },
        { x: 164, y: 34, width: 388, height: 352 },
        { x: 582, y: 24, width: 96, height: 360 },
      ],
      1,
      720,
      420,
    );

    expect(refined.length).toBeGreaterThan(3);
    expect(refined.some((rect) => rect.x >= 150 && rect.x < 230 && rect.width < 230)).toBe(true);
    expect(refined.some((rect) => rect.x >= 340 && rect.width < 230)).toBe(true);
  });

  it("adds rotated OCR fallback attempts for tall narrow panels", () => {
    const attempts = __figureWorkbenchTestables.buildOcrAttemptPlan(180, 520);

    expect(attempts.some((attempt) => attempt.variantId === "adaptive-rot90")).toBe(true);
    expect(attempts.some((attempt) => attempt.variantId === "binary-rot90" && attempt.psmKey === "line")).toBe(true);
  });

  it("keeps line-mode and inverted OCR fallbacks for text-heavy strips", () => {
    const attempts = __figureWorkbenchTestables.buildOcrAttemptPlan(720, 180);

    expect(attempts.some((attempt) => attempt.psmKey === "line")).toBe(true);
    expect(attempts.some((attempt) => attempt.variantId === "adaptive-invert")).toBe(true);
    expect(attempts.some((attempt) => attempt.variantId === "contrast-invert")).toBe(true);
  });
});

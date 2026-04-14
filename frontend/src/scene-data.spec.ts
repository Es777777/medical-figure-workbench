import { describe, expect, it } from "vitest";

import type { SceneGraph } from "@shared/scene-graph";

import { deleteNode, insertArrowNode, insertImageNode, insertPanelNode, insertShapeNode, insertTextNode } from "./scene-data";

const scene = {
  id: "scene_spec",
  version: 1,
  kind: "scientific-figure",
  canvas: { width: 1200, height: 800, backgroundColor: "#ffffff" },
  source: {
    assetId: "src_spec",
    originalUri: "/original.png",
    normalizedUri: "/normalized.png",
    originalDetectedFormat: "png",
    normalizedMimeType: "image/png",
    width: 1200,
    height: 800,
  },
  nodes: [],
} satisfies SceneGraph;

describe("scene-data manual insertion helpers", () => {
  it("inserts uploaded image nodes into the current scene", () => {
    const result = insertImageNode(scene, {
      name: "example.png",
      assetUri: "data:image/png;base64,test",
      mimeType: "image/png",
      assetWidth: 640,
      assetHeight: 320,
      sourceKind: "upload",
      tags: ["manual-upload"],
    });

    const imageNode = result.scene.nodes.find((node) => node.id === result.nodeId);
    expect(imageNode?.type).toBe("image");
    expect(imageNode?.tags).toContain("manual-upload");
  });

  it("creates panel, text, arrow, and shape nodes with stable types", () => {
    const panelResult = insertPanelNode(scene, { title: "Panel A", tags: ["manual-tool"] });
    const textResult = insertTextNode(panelResult.scene, { text: "Annotation", tags: ["manual-tool"] });
    const arrowResult = insertArrowNode(textResult.scene, { label: "flows", tags: ["manual-tool"] });
    const shapeResult = insertShapeNode(arrowResult.scene, { shape: "ellipse", tags: ["manual-tool"] });

    expect(panelResult.scene.nodes.find((node) => node.id === panelResult.nodeId)?.type).toBe("panel");
    expect(textResult.scene.nodes.find((node) => node.id === textResult.nodeId)?.type).toBe("text");
    expect(arrowResult.scene.nodes.find((node) => node.id === arrowResult.nodeId)?.type).toBe("arrow");
    expect(shapeResult.scene.nodes.find((node) => node.id === shapeResult.nodeId)?.type).toBe("shape");
  });

  it("removes a parent node together with its children", () => {
    const panelResult = insertPanelNode(scene, { title: "Panel A" });
    const panelId = panelResult.nodeId;
    const nestedTextResult = insertTextNode(panelResult.scene, { text: "Inside panel", tags: ["manual-tool"] });
    const nextScene = {
      ...nestedTextResult.scene,
      nodes: nestedTextResult.scene.nodes.map((node) =>
        node.id === nestedTextResult.nodeId
          ? {
              ...node,
              parentId: panelId,
            }
          : node,
      ),
    };

    const prunedScene = deleteNode(nextScene, panelId);
    expect(prunedScene.nodes).toHaveLength(0);
  });
});

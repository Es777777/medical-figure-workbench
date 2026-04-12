import type { SceneGraph } from "@shared/scene-graph";

export function buildSceneExportPayload(scene: SceneGraph) {
  return {
    fileName: `${scene.id}.json`,
    mimeType: "application/json",
    content: JSON.stringify(scene, null, 2),
  };
}

import type { SceneGraph } from "@shared/scene-graph";

import type { FigureProject } from "../project/types";

export function buildSceneExportPayload(scene: SceneGraph) {
  return {
    fileName: `${scene.id}.json`,
    mimeType: "application/json",
    content: JSON.stringify(scene, null, 2),
  };
}

export function buildProjectExportPayload(project: FigureProject) {
  return {
    fileName: `${project.id}.json`,
    mimeType: "application/json",
    content: JSON.stringify(project, null, 2),
  };
}

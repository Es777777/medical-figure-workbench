import type { SceneGraph } from "@shared/scene-graph";

import type { FigureProject } from "../project/types";

function slugify(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "untitled";
}

export function buildSceneExportPayload(scene: SceneGraph) {
  return {
    fileName: `${slugify(scene.id)}.json`,
    mimeType: "application/json",
    content: JSON.stringify(scene, null, 2),
  };
}

export function buildProjectExportPayload(project: FigureProject) {
  return {
    fileName: `${slugify(project.title || project.id)}-${slugify(project.id)}.json`,
    mimeType: "application/json",
    content: JSON.stringify(project, null, 2),
  };
}

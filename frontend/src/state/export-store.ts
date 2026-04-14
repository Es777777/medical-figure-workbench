import type { FigureProject, FigureTask } from "../features/project/types";

import { buildBatchTaskJsonExports, buildBatchTaskPngExports, buildBatchTaskSvgExports } from "../features/export/batch-export";
import { buildProjectExportPayload, buildSceneExportPayload } from "../features/export/export-utils";
import { buildTaskSvgExport } from "../features/export/svg-export";

export function buildTaskJsonDownload(task: FigureTask) {
  return task.scene ? buildSceneExportPayload(task.scene) : null;
}

export function buildTaskSvgDownload(task: FigureTask) {
  return buildTaskSvgExport(task);
}

export function buildProjectDownload(project: FigureProject) {
  return buildProjectExportPayload(project);
}

export function buildBatchDownloads(project: FigureProject) {
  return {
    json: buildBatchTaskJsonExports(project.tasks),
    svg: buildBatchTaskSvgExports(project.tasks),
    png: buildBatchTaskPngExports(project.tasks),
  };
}

export function triggerBlobDownload(payload: { fileName: string; mimeType: string; content: string }) {
  const blob = new Blob([payload.content], { type: payload.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payload.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

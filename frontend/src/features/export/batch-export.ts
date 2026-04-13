import type { FigureTask } from "../project/types";

import { buildSceneExportPayload } from "./export-utils";
import { buildTaskSvgExport } from "./svg-export";

export function buildBatchTaskJsonExports(tasks: FigureTask[]) {
  return tasks
    .filter((task) => task.scene)
    .map((task) => ({
      taskId: task.id,
      taskTitle: task.title,
      ...buildSceneExportPayload(task.scene!),
    }));
}

export function buildBatchTaskSvgExports(tasks: FigureTask[]) {
  return tasks
    .filter((task) => task.scene)
    .map((task) => ({
      taskId: task.id,
      taskTitle: task.title,
      ...buildTaskSvgExport(task),
    }));
}

export function buildBatchTaskPngExports(tasks: FigureTask[]) {
  return tasks
    .filter((task) => task.scene)
    .map((task) => ({
      taskId: task.id,
      taskTitle: task.title,
      bundleName: "png-batch",
      fileName: `${task.id}.png`,
      bundlePath: `png/${task.id}.png`,
      mimeType: "image/png",
      render: {
        width: task.scene!.canvas.width,
        height: task.scene!.canvas.height,
        nodeCount: task.scene!.nodes.length,
      },
    }));
}

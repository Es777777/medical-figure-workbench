import type { FigureTask } from "../project/types";

import { buildSceneExportPayload } from "./export-utils";

export function buildBatchTaskJsonExports(tasks: FigureTask[]) {
  return tasks
    .filter((task) => task.scene)
    .map((task) => ({
      taskId: task.id,
      taskTitle: task.title,
      ...buildSceneExportPayload(task.scene!),
    }));
}

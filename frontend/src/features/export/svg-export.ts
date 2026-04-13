import type { FigureTask } from "../project/types";

export function buildTaskSvgExport(task: FigureTask) {
  const width = task.scene?.canvas.width ?? 1200;
  const height = task.scene?.canvas.height ?? 800;
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"></svg>`;
  return {
    fileName: `${task.id}.svg`,
    mimeType: "image/svg+xml",
    content,
  };
}

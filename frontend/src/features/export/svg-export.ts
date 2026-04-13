import type { FigureTask } from "../project/types";

export function buildTaskSvgExport(task: FigureTask) {
  const width = task.scene?.canvas.width ?? 1200;
  const height = task.scene?.canvas.height ?? 800;
  const nodeFragments = (task.scene?.nodes ?? []).map((node) => {
    if (node.type === "text") {
      return `<text x="${node.transform.x}" y="${node.transform.y}">${node.text ?? ""}</text>`;
    }
    return "";
  });
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${nodeFragments.join("")}</svg>`;
  return {
    fileName: `${task.id}.svg`,
    mimeType: "image/svg+xml",
    content,
  };
}

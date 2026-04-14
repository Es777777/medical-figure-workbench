import type { FigureTask } from "../project/types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildTaskSvgExport(task: FigureTask) {
  const width = task.scene?.canvas.width ?? 1200;
  const height = task.scene?.canvas.height ?? 800;
  const nodeFragments = (task.scene?.nodes ?? []).map((node) => {
    if (node.type === "text") {
      return `<text x="${node.transform.x}" y="${node.transform.y}" font-family="${escapeXml(node.style?.fontFamily || "Trebuchet MS")}" font-size="${node.style?.fontSize || 16}" fill="${node.style?.color || "#1f2a35"}">${escapeXml(node.text ?? "")}</text>`;
    }
    if (node.type === "panel") {
      return `<rect x="${node.transform.x}" y="${node.transform.y}" width="${node.transform.width}" height="${node.transform.height}" fill="none" stroke="#8d7f6f" stroke-width="2" rx="16" ry="16" />`;
    }
    if (node.type === "image") {
      return `<g><rect x="${node.transform.x}" y="${node.transform.y}" width="${node.transform.width}" height="${node.transform.height}" fill="#f4f1ea" stroke="#b8aea1" stroke-width="1.5" /><text x="${node.transform.x + 12}" y="${node.transform.y + 24}" font-family="Palatino Linotype" font-size="16" fill="#1f2a35">${escapeXml(node.name ?? "Image node")}</text></g>`;
    }
    if (node.type === "arrow") {
      const first = node.points[0] ?? { x: node.transform.x, y: node.transform.y };
      const last = node.points[node.points.length - 1] ?? { x: node.transform.x + node.transform.width, y: node.transform.y + node.transform.height };
      return `<line x1="${first.x}" y1="${first.y}" x2="${last.x}" y2="${last.y}" stroke="${node.style.stroke}" stroke-width="${node.style.strokeWidth}" />`;
    }
    if (node.type === "shape") {
      if (node.shape === "ellipse") {
        return `<ellipse cx="${node.transform.x + node.transform.width / 2}" cy="${node.transform.y + node.transform.height / 2}" rx="${node.transform.width / 2}" ry="${node.transform.height / 2}" fill="${escapeXml(node.style.fill)}" stroke="${escapeXml(node.style.stroke)}" stroke-width="${node.style.strokeWidth}" />`;
      }
      if (node.shape === "diamond") {
        const top = `${node.transform.x + node.transform.width / 2},${node.transform.y}`;
        const right = `${node.transform.x + node.transform.width},${node.transform.y + node.transform.height / 2}`;
        const bottom = `${node.transform.x + node.transform.width / 2},${node.transform.y + node.transform.height}`;
        const left = `${node.transform.x},${node.transform.y + node.transform.height / 2}`;
        return `<polygon points="${top} ${right} ${bottom} ${left}" fill="${escapeXml(node.style.fill)}" stroke="${escapeXml(node.style.stroke)}" stroke-width="${node.style.strokeWidth}" />`;
      }
      return `<rect x="${node.transform.x}" y="${node.transform.y}" width="${node.transform.width}" height="${node.transform.height}" fill="${escapeXml(node.style.fill)}" stroke="${escapeXml(node.style.stroke)}" stroke-width="${node.style.strokeWidth}" rx="16" ry="16" />`;
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

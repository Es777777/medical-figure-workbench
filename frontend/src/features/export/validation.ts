import type { FigureTask } from "../project/types";

export type ExportWarning = {
  code: string;
  severity: "notice" | "warning";
  message: string;
};

export function getExportValidationReport(task: FigureTask) {
  const warnings: ExportWarning[] = [];

  if (!task.scene || task.scene.nodes.length === 0) {
    warnings.push({
      code: "empty-scene",
      severity: "warning",
      message: "The current task has no scene nodes to export.",
    });
  }

  const emptyTextNodes = (task.scene?.nodes ?? []).filter((node) => node.type === "text" && (!node.text || node.text.trim() === ""));
  if (emptyTextNodes.length > 0) {
    warnings.push({
      code: "empty-text",
      severity: "notice",
      message: "One or more text nodes are empty.",
    });
  }

  if (!task.title.trim()) {
    warnings.push({
      code: "missing-task-title",
      severity: "notice",
      message: "The current task does not have a clear title.",
    });
  }

  if (!task.title.trim()) {
    warnings.push({
      code: "missing-task-title",
      severity: "notice",
      message: "The current task does not have a clear title.",
    });
  }

  return { warnings };
}

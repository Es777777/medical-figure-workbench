import { describe, expect, it } from "vitest";

import { createProject, createTask, deserializeProject, serializeProject, switchActiveTask, updateTaskScene } from "./store";

describe("project store", () => {
  it("creates a project with one active task", () => {
    const project = createProject("Paper Figures");
    expect(project.title).toBe("Paper Figures");
    expect(project.tasks).toHaveLength(1);
    expect(project.currentTaskId).toBe(project.tasks[0]?.id);
  });

  it("adds and switches tasks", () => {
    const project = createProject("Paper Figures");
    const next = createTask(project, "Figure 2");
    const switched = switchActiveTask(next, next.tasks[1]!.id);
    expect(switched.currentTaskId).toBe(next.tasks[1]!.id);
  });

  it("round-trips a project through JSON", () => {
    const project = createProject("Paper Figures");
    const restored = deserializeProject(serializeProject(project));
    expect(restored.title).toBe("Paper Figures");
    expect(restored.tasks).toHaveLength(1);
  });

  it("updates only the active task scene", () => {
    const project = createProject("Paper Figures");
    const updated = updateTaskScene(project, project.currentTaskId, { id: "scene_1", nodes: [] } as any);
    expect(updated.tasks[0]?.scene?.id).toBe("scene_1");
  });
});

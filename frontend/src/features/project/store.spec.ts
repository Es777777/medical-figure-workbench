import { describe, expect, it } from "vitest";

import { createProjectState } from "../../state/project-store";
import { createProject, createTask, deleteTask, deserializeProject, moveTask, serializeProject, switchActiveTask, updateTaskScene } from "./store";

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

  it("creates a project state wrapper", () => {
    const state = createProjectState("Medical Figure Project");
    expect(state.project.title).toBe("Medical Figure Project");
  });

  it("moves a task to a new index", () => {
    const project = createTask(createTask(createProject("Paper Figures"), "Figure 2"), "Figure 3");
    const moved = moveTask(project, project.tasks[2]!.id, 0);
    expect(moved.tasks[0]?.title).toBe("Figure 3");
  });

  it("deletes a task and preserves a valid current task", () => {
    const project = createTask(createTask(createProject("Paper Figures"), "Figure 2"), "Figure 3");
    const next = deleteTask(project, project.tasks[1]!.id);
    expect(next.tasks).toHaveLength(2);
    expect(next.tasks.find((task) => task.id === project.tasks[1]!.id)).toBeUndefined();
    expect(next.currentTaskId).toBe(project.currentTaskId);
  });
});

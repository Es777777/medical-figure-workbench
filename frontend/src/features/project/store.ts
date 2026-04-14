import type { SceneGraph } from "@shared/scene-graph";

import type { FigureProject, FigureTask } from "./types";

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function createBlankTask(title = "Figure 1"): FigureTask {
  const now = new Date().toISOString();
  return {
    id: makeId("task"),
    title,
    createdAt: now,
    updatedAt: now,
    status: "pending-import",
    importMode: "auto",
    sourceDataUrl: "",
    sourceName: "",
    importedSourcePreviewVisible: false,
    contextNotes: "",
    recommendedPrompt: "",
    mergedRecognizedText: "",
    analysis: null,
    panelDecisions: [],
    analyzePrompt: "",
    analyzeState: {
      status: "idle",
      mode: null,
      message: "",
      response: null,
      acceptedActionIds: [],
      rejectedActionIds: [],
      appliedActionIds: [],
      staleActionIds: [],
    },
    reconstructProblemNotes: "",
    reconstructState: {
      status: "idle",
      mode: null,
      message: "",
      response: null,
      acceptedActionIds: [],
      rejectedActionIds: [],
      appliedActionIds: [],
      staleActionIds: [],
    },
    regeneratePrompt: "",
    regenerateFeedback: "",
    regenerateState: {
      status: "idle",
      mode: null,
      message: "",
      response: null,
      appliedVariantId: null,
    },
    scene: null,
  };
}

export function createProject(title: string): FigureProject {
  const task = createBlankTask();
  const now = new Date().toISOString();
  return {
    id: makeId("project"),
    title,
    createdAt: now,
    updatedAt: now,
    currentTaskId: task.id,
    tasks: [task],
  };
}

export function createTask(project: FigureProject, title: string): FigureProject {
  const task = createBlankTask(title);
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    currentTaskId: task.id,
    tasks: [...project.tasks, task],
  };
}

export function switchActiveTask(project: FigureProject, taskId: string): FigureProject {
  return {
    ...project,
    currentTaskId: taskId,
    updatedAt: new Date().toISOString(),
  };
}

export function moveTask(project: FigureProject, taskId: string, nextIndex: number): FigureProject {
  const currentIndex = project.tasks.findIndex((task) => task.id === taskId);
  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= project.tasks.length) {
    return project;
  }

  const tasks = [...project.tasks];
  const [task] = tasks.splice(currentIndex, 1);
  tasks.splice(nextIndex, 0, task);

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tasks,
  };
}

export function deleteTask(project: FigureProject, taskId: string): FigureProject {
  if (project.tasks.length <= 1) {
    return project;
  }

  const tasks = project.tasks.filter((task) => task.id !== taskId);
  const currentTaskId = project.currentTaskId === taskId ? tasks[0]!.id : project.currentTaskId;

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    currentTaskId,
    tasks,
  };
}

export function updateTaskScene(project: FigureProject, taskId: string, scene: SceneGraph | null): FigureProject {
  const now = new Date().toISOString();
  return {
    ...project,
    updatedAt: now,
    tasks: project.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            updatedAt: now,
            scene,
          }
        : task,
    ),
  };
}

export function updateTask(project: FigureProject, taskId: string, patch: Partial<FigureTask>): FigureProject {
  const now = new Date().toISOString();
  return {
    ...project,
    updatedAt: now,
    tasks: project.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            ...patch,
            updatedAt: now,
          }
        : task,
    ),
  };
}

export function serializeProject(project: FigureProject): string {
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(raw: string): FigureProject {
  return JSON.parse(raw) as FigureProject;
}

# Medical Figure Workbench Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-level persistence, multi-task figure management, and durable save/load behavior so the tool can be reused across sessions and across multiple manuscript figures.

**Architecture:** Introduce a project file layer above the current figure workbench by adding project/task types, a project store, and UI modules for task switching and project persistence. Keep the current import-session and scene graph systems, but scope them per figure task and persist the entire project instead of only the active scene.

**Tech Stack:** React, TypeScript, Vite, Vitest, existing scene graph types, existing import-session modules, browser localStorage, JSON file import/export.

---

## File Structure

- Create: `frontend/src/features/project/types.ts`
  - Project-level and task-level TypeScript models.
- Create: `frontend/src/features/project/store.ts`
  - Pure helpers for creating, updating, switching, and serializing projects.
- Create: `frontend/src/features/project/store.spec.ts`
  - Tests for project/task behavior.
- Create: `frontend/src/features/project/TaskListPanel.tsx`
  - UI for figure task listing, switching, and creation.
- Create: `frontend/src/features/project/ProjectToolbar.tsx`
  - Project title and save/open/new-task controls.
- Modify: `frontend/src/features/import-session/types.ts`
  - Expand import-session shape for recoverable task-level data.
- Modify: `frontend/src/features/import-session/state.ts`
  - Add helpers for serializable task-level import-session data.
- Modify: `frontend/src/features/export/export-utils.ts`
  - Add project file export helper.
- Modify: `frontend/src/features/export/export.spec.ts`
  - Add project export coverage.
- Modify: `frontend/src/features/export/ExportCenter.tsx`
  - Support project export and clearer task export actions.
- Modify: `frontend/src/App.tsx`
  - Replace page-global assumptions with active-task project wiring.
- Modify: `frontend/src/copy.ts`
  - Add project/task UI strings.
- Modify: `frontend/src/styles.css`
  - Add project toolbar and task list styling.
- Modify: `README.md`
  - Document Phase 2 project workflow.

### Task 1: Add project and figure-task state models

**Files:**
- Create: `frontend/src/features/project/types.ts`
- Create: `frontend/src/features/project/store.ts`
- Create: `frontend/src/features/project/store.spec.ts`

- [ ] **Step 1: Write the failing tests for project/task creation and switching**

```ts
import { describe, expect, it } from "vitest";

import { createProject, createTask, switchActiveTask } from "./store";

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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/project/store.spec.ts`

Expected: FAIL because the project store files do not exist yet.

- [ ] **Step 3: Create `frontend/src/features/project/types.ts`**

```ts
import type { SceneGraph } from "@shared/scene-graph";

import type { ImportMode } from "../import-session/types";

export type FigureTaskStatus = "pending-import" | "parsed" | "in-review" | "editing" | "exported";

export type FigureTask = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: FigureTaskStatus;
  importMode: ImportMode;
  scene: SceneGraph | null;
};

export type FigureProject = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentTaskId: string;
  tasks: FigureTask[];
};
```

- [ ] **Step 4: Create `frontend/src/features/project/store.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- src/features/project/store.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/project/types.ts frontend/src/features/project/store.ts frontend/src/features/project/store.spec.ts
git commit -m "feat: add project and task state models"
```

### Task 2: Expand export helpers for project-file persistence

**Files:**
- Modify: `frontend/src/features/export/export-utils.ts`
- Modify: `frontend/src/features/export/export.spec.ts`
- Modify: `frontend/src/features/project/types.ts`

- [ ] **Step 1: Extend export tests for project JSON output**

```ts
import { describe, expect, it } from "vitest";

import { buildProjectExportPayload } from "./export-utils";

describe("project export payload", () => {
  it("creates a JSON project export payload", () => {
    const payload = buildProjectExportPayload({ id: "project_1", title: "Paper Figures", tasks: [] } as any);
    expect(payload.fileName).toContain("project_1");
    expect(payload.mimeType).toBe("application/json");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/export/export.spec.ts`

Expected: FAIL because `buildProjectExportPayload` does not exist yet.

- [ ] **Step 3: Implement `buildProjectExportPayload()` in `frontend/src/features/export/export-utils.ts`**

```ts
import type { FigureProject } from "../project/types";

export function buildProjectExportPayload(project: FigureProject) {
  return {
    fileName: `${project.id}.json`,
    mimeType: "application/json",
    content: JSON.stringify(project, null, 2),
  };
}
```

- [ ] **Step 4: Run the export tests to verify they pass**

Run: `npm run test -- src/features/export/export.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/export/export-utils.ts frontend/src/features/export/export.spec.ts frontend/src/features/project/types.ts
git commit -m "feat: add project export payload helper"
```

### Task 3: Add project toolbar and task list UI modules

**Files:**
- Create: `frontend/src/features/project/ProjectToolbar.tsx`
- Create: `frontend/src/features/project/TaskListPanel.tsx`
- Modify: `frontend/src/copy.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write a copy-level failing test for project labels**

```ts
import { describe, expect, it } from "vitest";

import { UI_COPY } from "../../copy";

describe("project UI copy", () => {
  it("includes project and task labels", () => {
    expect(UI_COPY.en.actions.saveProject).toBe("Save project");
    expect(UI_COPY.en.labels.importWorkflow).toBe("Import workflow");
  });
});
```

- [ ] **Step 2: Run tests to verify missing copy is surfaced**

Run: `npm run test -- src/features/project/store.spec.ts src/features/export/export.spec.ts`

Expected: PASS for store/export and FAIL only if project UI copy is missing.

- [ ] **Step 3: Create `frontend/src/features/project/ProjectToolbar.tsx`**

```tsx
type Props = {
  title: string;
  onTitleChange: (value: string) => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  onCreateTask: () => void;
  labels: {
    saveProject: string;
    loadProject: string;
    newTask: string;
  };
};

export function ProjectToolbar(props: Props) {
  return <div className="project-toolbar">...</div>;
}
```

- [ ] **Step 4: Create `frontend/src/features/project/TaskListPanel.tsx`**

```tsx
type Props = {
  tasks: Array<{ id: string; title: string; status: string; updatedAt: string }>;
  currentTaskId: string;
  onSelectTask: (taskId: string) => void;
  onCreateTask: () => void;
};

export function TaskListPanel(props: Props) {
  return <div className="task-list-panel">...</div>;
}
```

- [ ] **Step 5: Add styles for project toolbar and task list**

```css
.project-toolbar {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: minmax(0, 1fr) auto auto auto;
}

.task-list-panel {
  display: grid;
  gap: var(--space-2);
}

.task-list-item.is-active {
  border-color: var(--color-selection);
}
```

- [ ] **Step 6: Run the frontend test and build check**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/project/ProjectToolbar.tsx frontend/src/features/project/TaskListPanel.tsx frontend/src/copy.ts frontend/src/styles.css
git commit -m "feat: add project toolbar and task list modules"
```

### Task 4: Replace scene-only recovery with project-level recovery

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/features/project/store.ts`
- Modify: `frontend/src/features/import-session/types.ts`
- Modify: `frontend/src/features/import-session/state.ts`

- [ ] **Step 1: Add a failing test for project serialization round-trip**

```ts
import { describe, expect, it } from "vitest";

import { createProject, deserializeProject, serializeProject } from "./store";

describe("project persistence", () => {
  it("round-trips a project through JSON", () => {
    const project = createProject("Paper Figures");
    const restored = deserializeProject(serializeProject(project));
    expect(restored.title).toBe("Paper Figures");
    expect(restored.tasks).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/project/store.spec.ts`

Expected: FAIL because serialization helpers do not exist yet.

- [ ] **Step 3: Add serialization helpers in `frontend/src/features/project/store.ts`**

```ts
export function serializeProject(project: FigureProject): string {
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(raw: string): FigureProject {
  return JSON.parse(raw) as FigureProject;
}
```

- [ ] **Step 4: Update `App.tsx` to persist the whole project in localStorage**

```tsx
const PROJECT_STORAGE_KEY = "medical-figure-workbench:project";

function handleSaveProject() {
  if (!project) return;
  window.localStorage.setItem(PROJECT_STORAGE_KEY, serializeProject(project));
}

function handleLoadProject() {
  const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
  if (!raw) return;
  setProject(deserializeProject(raw));
}
```

- [ ] **Step 5: Run tests and build to verify recovery works**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/features/project/store.ts frontend/src/features/import-session/types.ts frontend/src/features/import-session/state.ts
git commit -m "feat: persist full project state locally"
```

### Task 5: Wire active-task switching into the workbench

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/features/project/store.ts`
- Modify: `frontend/src/features/project/TaskListPanel.tsx`

- [ ] **Step 1: Extend store tests for task updates**

```ts
import { describe, expect, it } from "vitest";

import { createProject, updateTaskScene } from "./store";

describe("task scene updates", () => {
  it("updates only the active task scene", () => {
    const project = createProject("Paper Figures");
    const updated = updateTaskScene(project, project.currentTaskId, { id: "scene_1", nodes: [] } as any);
    expect(updated.tasks[0]?.scene?.id).toBe("scene_1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/project/store.spec.ts`

Expected: FAIL because `updateTaskScene` does not exist yet.

- [ ] **Step 3: Add task-update helpers in `frontend/src/features/project/store.ts`**

```ts
export function updateTaskScene(project: FigureProject, taskId: string, scene: SceneGraph | null): FigureProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    tasks: project.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            updatedAt: new Date().toISOString(),
            scene,
          }
        : task,
    ),
  };
}
```

- [ ] **Step 4: Wire the active project/task into `App.tsx`**

```tsx
const [project, setProject] = useState(() => createProject("Medical Figure Project"));
const activeTask = project.tasks.find((task) => task.id === project.currentTaskId) ?? project.tasks[0];

function handleSelectTask(taskId: string) {
  setProject((current) => switchActiveTask(current, taskId));
}
```

- [ ] **Step 5: Render project toolbar and task list**

```tsx
<ProjectToolbar ... />
<TaskListPanel ... />
```

- [ ] **Step 6: Run tests and build to verify task switching integration**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/features/project/store.ts frontend/src/features/project/TaskListPanel.tsx
git commit -m "feat: add active task switching workflow"
```

### Task 6: Add project file save/open and document the workflow

**Files:**
- Modify: `frontend/src/features/export/ExportCenter.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `README.md`

- [ ] **Step 1: Update export center to distinguish task export from project export**

```tsx
<button ...>{taskJsonLabel}</button>
<button ...>{taskPngLabel}</button>
<button ...>{saveProjectFileLabel}</button>
<button ...>{openProjectFileLabel}</button>
```

- [ ] **Step 2: Add project file import/export handlers in `App.tsx`**

```tsx
function handleExportProjectFile() {
  const payload = buildProjectExportPayload(project);
  ...
}

function handleOpenProjectFile(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  ...
}
```

- [ ] **Step 3: Update README with the Phase 2 workflow**

```md
## Phase 2 Workflow

1. Create a project
2. Add multiple figure tasks
3. Work on each task independently
4. Save or reopen the project file later
```
```

- [ ] **Step 4: Run full verification**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`

Expected:
- create a project
- create a second task
- switch tasks
- save project locally
- export project file
- reopen project file
- verify both tasks restore correctly

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/export/ExportCenter.tsx frontend/src/App.tsx README.md
git commit -m "feat: add project file persistence workflow"
```

## Self-Review

- Spec coverage: project file model, figure task model, save/load behavior, task list, project toolbar, task switching, and project export are all covered.
- Placeholder scan: no TODO/TBD-style placeholders remain in the task instructions.
- Type consistency: `FigureProject`, `FigureTask`, `createProject`, `createTask`, `switchActiveTask`, `serializeProject`, `deserializeProject`, and `updateTaskScene` are introduced in a consistent progression.

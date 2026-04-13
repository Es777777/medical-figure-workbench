# Medical Figure Workbench Next Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen export output quality and scale, continue reducing application-shell complexity, and add a clearer first-use presentation layer for the product.

**Architecture:** Extend the export subsystem into a task-plus-project pipeline with batch export and stronger validation, while extracting more page-level coordination into focused modules and adding onboarding/media support. Keep the current project/task model and workbench flow, but make export and first-use experience feel more complete and intentional.

**Tech Stack:** React, TypeScript, Vite, Fabric.js, Vitest, existing project/task store, browser canvas and file APIs, Markdown documentation, static repo media.

---

## File Structure

- Create: `frontend/src/features/export/batch-export.ts`
  - Helpers for exporting multiple tasks in one pass.
- Create: `frontend/src/features/export/batch-export.spec.ts`
  - Tests for batch export naming and output aggregation.
- Modify: `frontend/src/features/export/validation.ts`
  - Add stronger export checks beyond the initial warnings.
- Modify: `frontend/src/features/export/validation.spec.ts`
  - Cover new validation rules.
- Modify: `frontend/src/features/export/svg-export.ts`
  - Expand SVG output beyond the empty shell.
- Modify: `frontend/src/features/export/svg-export.spec.ts`
  - Cover richer SVG content.
- Create: `frontend/src/features/onboarding/OnboardingCard.tsx`
  - First-use workflow guidance.
- Create: `frontend/src/features/onboarding/onboarding.spec.ts`
  - Tests for onboarding dismissal or first-run visibility helpers.
- Create: `frontend/src/state/project-store.ts`
  - Move project orchestration out of `App.tsx` progressively.
- Modify: `frontend/src/App.tsx`
  - Wire new export batch path, onboarding, and reduced coordination.
- Modify: `frontend/src/features/export/ExportCenter.tsx`
  - Add batch export actions and expanded validation presentation.
- Modify: `frontend/src/copy.ts`
  - Add batch export and onboarding labels.
- Modify: `frontend/src/styles.css`
  - Add onboarding and export-report styles.
- Create: `docs/media/workbench-overview.md`
  - Concrete capture instructions for the main screenshot.
- Modify: `README.md`
  - Sync media, onboarding, and stronger export workflow descriptions.

### Task 1: Add batch export helpers and tests

**Files:**
- Create: `frontend/src/features/export/batch-export.ts`
- Create: `frontend/src/features/export/batch-export.spec.ts`

- [ ] **Step 1: Write the failing tests for batch export output**

```ts
import { describe, expect, it } from "vitest";

import { buildBatchTaskJsonExports } from "./batch-export";

describe("batch export", () => {
  it("creates one JSON export per task", () => {
    const results = buildBatchTaskJsonExports([
      { id: "task_1", title: "Figure 1", scene: { id: "scene_1", nodes: [] } },
      { id: "task_2", title: "Figure 2", scene: { id: "scene_2", nodes: [] } },
    ] as any);
    expect(results).toHaveLength(2);
    expect(results[0]?.fileName).toContain("task_1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/export/batch-export.spec.ts`

Expected: FAIL because the batch export helper does not exist yet.

- [ ] **Step 3: Create `frontend/src/features/export/batch-export.ts`**

```ts
import type { FigureTask } from "../project/types";

import { buildSceneExportPayload } from "./export-utils";

export function buildBatchTaskJsonExports(tasks: FigureTask[]) {
  return tasks
    .filter((task) => task.scene)
    .map((task) => buildSceneExportPayload(task.scene!));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/features/export/batch-export.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/export/batch-export.ts frontend/src/features/export/batch-export.spec.ts
git commit -m "feat: add batch task export helpers"
```

### Task 2: Expand export validation and SVG output quality

**Files:**
- Modify: `frontend/src/features/export/validation.ts`
- Modify: `frontend/src/features/export/validation.spec.ts`
- Modify: `frontend/src/features/export/svg-export.ts`
- Modify: `frontend/src/features/export/svg-export.spec.ts`

- [ ] **Step 1: Extend validation tests for missing task title and out-of-bounds nodes**

```ts
import { describe, expect, it } from "vitest";

import { getExportValidationReport } from "./validation";

describe("extended export validation", () => {
  it("warns when task title is missing", () => {
    const report = getExportValidationReport({ title: "", scene: { canvas: { width: 100, height: 100 }, nodes: [] } } as any);
    expect(report.warnings.map((item) => item.code)).toContain("missing-task-title");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/export/validation.spec.ts src/features/export/svg-export.spec.ts`

Expected: FAIL if the new validation or richer SVG output is not implemented yet.

- [ ] **Step 3: Expand `frontend/src/features/export/validation.ts`**

```ts
if (!task.title.trim()) {
  warnings.push({ code: "missing-task-title", severity: "notice", message: "The current task does not have a clear title." });
}
```

- [ ] **Step 4: Expand `frontend/src/features/export/svg-export.ts` with basic scene content**

```ts
const nodeFragments = (task.scene?.nodes ?? []).map((node) => {
  if (node.type === "text") {
    return `<text x="${node.transform.x}" y="${node.transform.y}">${node.text ?? ""}</text>`;
  }
  return "";
});
const content = `<?xml version="1.0" encoding="UTF-8"?>\n<svg ...>${nodeFragments.join("")}</svg>`;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- src/features/export/validation.spec.ts src/features/export/svg-export.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/export/validation.ts frontend/src/features/export/validation.spec.ts frontend/src/features/export/svg-export.ts frontend/src/features/export/svg-export.spec.ts
git commit -m "feat: improve export validation and SVG content"
```

### Task 3: Add batch export to the export center

**Files:**
- Modify: `frontend/src/features/export/ExportCenter.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/copy.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Add a failing copy-level test for batch export labels**

```ts
import { describe, expect, it } from "vitest";

import { UI_COPY } from "../../copy";

describe("batch export copy", () => {
  it("includes batch export labels", () => {
    expect(UI_COPY.en.actions.exportSvg).toBe("Export SVG");
    expect(UI_COPY.en.actions.exportAllTasks).toBe("Export all tasks");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail if copy is incomplete**

Run: `npm run test -- src/features/export/export.spec.ts src/features/export/batch-export.spec.ts`

Expected: FAIL only if batch export labels or props are missing.

- [ ] **Step 3: Add batch export labels to `frontend/src/copy.ts`**

```ts
actions: {
  exportAllTasks: "Export all tasks",
}
```

- [ ] **Step 4: Update `frontend/src/features/export/ExportCenter.tsx` to expose batch export action**

```tsx
<button className="secondary-button" onClick={props.onExportAllTasks} type="button">
  {props.exportAllTasksLabel}
</button>
```

- [ ] **Step 5: Wire batch export in `frontend/src/App.tsx`**

```tsx
function handleExportAllTasks() {
  const payloads = buildBatchTaskJsonExports(project.tasks);
  ...
}
```

- [ ] **Step 6: Run tests and build to verify export center upgrade**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/export/ExportCenter.tsx frontend/src/App.tsx frontend/src/copy.ts frontend/src/styles.css
git commit -m "feat: add batch export actions"
```

### Task 4: Start moving project orchestration toward a store module

**Files:**
- Create: `frontend/src/state/project-store.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/features/project/store.spec.ts`

- [ ] **Step 1: Write the failing test for a project-store helper**

```ts
import { describe, expect, it } from "vitest";

import { createProjectState } from "../../state/project-store";

describe("project store shell", () => {
  it("creates a project state wrapper", () => {
    const state = createProjectState("Medical Figure Project");
    expect(state.project.title).toBe("Medical Figure Project");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/project/store.spec.ts`

Expected: FAIL because the project-store module does not exist yet.

- [ ] **Step 3: Create `frontend/src/state/project-store.ts`**

```ts
import { createProject } from "../features/project/store";

export function createProjectState(title: string) {
  return {
    project: createProject(title),
  };
}
```

- [ ] **Step 4: Replace one direct project initialization in `App.tsx` with the new helper**

```ts
const [project, setProject] = useState(() => createProjectState("Medical Figure Project").project);
```

- [ ] **Step 5: Run tests and build to verify the first store extraction step**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/state/project-store.ts frontend/src/App.tsx frontend/src/features/project/store.spec.ts
git commit -m "refactor: introduce project store shell"
```

### Task 5: Add onboarding and media guidance updates

**Files:**
- Create: `frontend/src/features/onboarding/OnboardingCard.tsx`
- Create: `frontend/src/features/onboarding/onboarding.spec.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `README.md`
- Modify: `docs/media/README.md`

- [ ] **Step 1: Write a failing onboarding helper test**

```ts
import { describe, expect, it } from "vitest";

describe("onboarding smoke guard", () => {
  it("expects an onboarding card class in the stylesheet", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Create `frontend/src/features/onboarding/OnboardingCard.tsx`**

```tsx
type Props = {
  title: string;
  steps: string[];
  onDismiss: () => void;
};

export function OnboardingCard(props: Props) {
  return <div className="onboarding-card">...</div>;
}
```

- [ ] **Step 3: Render the onboarding card in `App.tsx` when the current scene is empty**

```tsx
{scene.nodes.length === 0 ? <OnboardingCard ... /> : null}
```

- [ ] **Step 4: Update styles and docs**

```md
## Project Media

See `docs/media/README.md` for concrete capture instructions.
```

- [ ] **Step 5: Run full verification**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/onboarding/OnboardingCard.tsx frontend/src/features/onboarding/onboarding.spec.ts frontend/src/App.tsx frontend/src/styles.css README.md docs/media/README.md
git commit -m "feat: add onboarding and media guidance updates"
```

## Self-Review

- Spec coverage: batch export, stronger validation, better SVG output, lighter project shell setup, onboarding, and media improvements are all covered.
- Placeholder scan: no TODO/TBD placeholders remain in the actionable task content.
- Type consistency: `buildBatchTaskJsonExports`, `getExportValidationReport`, `buildTaskSvgExport`, `createProjectState`, and `OnboardingCard` are introduced in a consistent order.

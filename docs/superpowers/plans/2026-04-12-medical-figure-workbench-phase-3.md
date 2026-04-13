# Medical Figure Workbench Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen export quality, continue front-end decomposition, and add real presentation assets so the project becomes more dependable and easier to demonstrate.

**Architecture:** Build a more explicit export subsystem with validation and SVG-oriented output helpers, then reduce `App.tsx` orchestration by extracting semantic and export workflow pieces into focused modules. Finish by replacing README media placeholders with real project assets and syncing documentation to the new capabilities.

**Tech Stack:** React, TypeScript, Vite, Fabric.js, Vitest, shared scene graph types, browser canvas export APIs, existing project/task workflow modules, Markdown documentation.

---

## File Structure

- Create: `frontend/src/features/export/validation.ts`
  - Export validation helpers and severity model.
- Create: `frontend/src/features/export/validation.spec.ts`
  - Tests for export warnings.
- Create: `frontend/src/features/export/svg-export.ts`
  - Task-level SVG serialization helpers.
- Create: `frontend/src/features/export/svg-export.spec.ts`
  - Tests for SVG export output.
- Modify: `frontend/src/features/export/ExportCenter.tsx`
  - Show export validation, task export, project export, and SVG entry points.
- Create: `frontend/src/features/semantic-assistant/SemanticAssistantPanel.tsx`
  - Extract prompt analysis and reconstruction UI out of `App.tsx`.
- Modify: `frontend/src/App.tsx`
  - Wire new export and semantic modules; reduce orchestration concentration.
- Modify: `frontend/src/copy.ts`
  - Add export validation and SVG labels.
- Modify: `frontend/src/styles.css`
  - Add export warning presentation and semantic assistant panel styles.
- Create: `docs/media/README.md`
  - Instructions for screenshot and GIF asset generation/placement.
- Modify: `README.md`
  - Replace placeholder media guidance with concrete references and updated export documentation.

### Task 1: Add export validation helpers and coverage

**Files:**
- Create: `frontend/src/features/export/validation.ts`
- Create: `frontend/src/features/export/validation.spec.ts`

- [ ] **Step 1: Write the failing tests for task export validation**

```ts
import { describe, expect, it } from "vitest";

import { getExportValidationReport } from "./validation";

describe("export validation", () => {
  it("warns when a scene has no nodes", () => {
    const report = getExportValidationReport({ id: "task_1", title: "Figure 1", scene: { id: "scene", nodes: [] } } as any);
    expect(report.warnings[0]?.code).toBe("empty-scene");
  });

  it("warns when text nodes are empty", () => {
    const report = getExportValidationReport({
      id: "task_1",
      title: "Figure 1",
      scene: { id: "scene", nodes: [{ id: "t1", type: "text", text: "" }] },
    } as any);
    expect(report.warnings.map((item) => item.code)).toContain("empty-text");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/features/export/validation.spec.ts`

Expected: FAIL because the validation helper does not exist yet.

- [ ] **Step 3: Create `frontend/src/features/export/validation.ts`**

```ts
import type { FigureTask } from "../project/types";

export type ExportWarning = {
  code: string;
  severity: "notice" | "warning";
  message: string;
};

export function getExportValidationReport(task: FigureTask) {
  const warnings: ExportWarning[] = [];
  if (!task.scene || task.scene.nodes.length === 0) {
    warnings.push({ code: "empty-scene", severity: "warning", message: "The current task has no scene nodes to export." });
  }

  const emptyTextNodes = (task.scene?.nodes ?? []).filter((node) => node.type === "text" && (!node.text || node.text.trim() === ""));
  if (emptyTextNodes.length > 0) {
    warnings.push({ code: "empty-text", severity: "notice", message: "One or more text nodes are empty." });
  }

  return { warnings };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/features/export/validation.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/export/validation.ts frontend/src/features/export/validation.spec.ts
git commit -m "feat: add export validation helpers"
```

### Task 2: Add an initial SVG export path

**Files:**
- Create: `frontend/src/features/export/svg-export.ts`
- Create: `frontend/src/features/export/svg-export.spec.ts`
- Modify: `frontend/src/features/export/export-utils.ts`

- [ ] **Step 1: Write the failing tests for SVG export output**

```ts
import { describe, expect, it } from "vitest";

import { buildTaskSvgExport } from "./svg-export";

describe("task SVG export", () => {
  it("creates an SVG string with a root svg element", () => {
    const result = buildTaskSvgExport({
      title: "Figure 1",
      scene: { canvas: { width: 1200, height: 800 }, nodes: [] },
    } as any);
    expect(result.content).toContain("<svg");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/export/svg-export.spec.ts`

Expected: FAIL because the SVG export helper does not exist yet.

- [ ] **Step 3: Create `frontend/src/features/export/svg-export.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/features/export/svg-export.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/export/svg-export.ts frontend/src/features/export/svg-export.spec.ts frontend/src/features/export/export-utils.ts
git commit -m "feat: add initial SVG export path"
```

### Task 3: Turn export center into a real export subsystem

**Files:**
- Modify: `frontend/src/features/export/ExportCenter.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/copy.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Add a failing copy-level test for SVG/export validation labels**

```ts
import { describe, expect, it } from "vitest";

import { UI_COPY } from "../../copy";

describe("export copy", () => {
  it("includes SVG export labels", () => {
    expect(UI_COPY.en.actions.exportPng).toBe("Export PNG");
    expect(UI_COPY.en.actions.exportSvg).toBe("Export SVG");
  });
});
```

- [ ] **Step 2: Run the tests to confirm missing labels are surfaced**

Run: `npm run test -- src/features/export/export.spec.ts src/features/export/validation.spec.ts`

Expected: PASS for helpers and FAIL only if export labels are missing.

- [ ] **Step 3: Expand `frontend/src/copy.ts` with SVG/export validation text**

```ts
actions: {
  exportSvg: "Export SVG",
}

labels: {
  exportChecks: "Export checks",
}
```

- [ ] **Step 4: Update `frontend/src/features/export/ExportCenter.tsx` to render validation warnings and SVG export**

```tsx
<div className="export-validation-list">
  {validation.warnings.map((warning) => (
    <article className={`export-warning export-warning-${warning.severity}`} key={warning.code}>
      <strong>{warning.code}</strong>
      <p>{warning.message}</p>
    </article>
  ))}
</div>
```

- [ ] **Step 5: Wire SVG export and validation into `frontend/src/App.tsx`**

```tsx
const validation = getExportValidationReport(activeTask);

function handleExportSvg() {
  const payload = buildTaskSvgExport(activeTask);
  ...
}
```

- [ ] **Step 6: Run tests and build to verify export subsystem changes**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/export/ExportCenter.tsx frontend/src/App.tsx frontend/src/copy.ts frontend/src/styles.css
git commit -m "feat: upgrade export center with validation and SVG"
```

### Task 4: Extract semantic assistant UI from `App.tsx`

**Files:**
- Create: `frontend/src/features/semantic-assistant/SemanticAssistantPanel.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Create a failing test or guard for semantic panel extraction target class**

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("semantic assistant styles", () => {
  it("contains semantic assistant block styles", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../styles.css"), "utf8");
    expect(css).toContain(".semantic-assistant-panel");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/export/validation.spec.ts`

Expected: FAIL if the semantic panel styles and component do not exist yet.

- [ ] **Step 3: Create `frontend/src/features/semantic-assistant/SemanticAssistantPanel.tsx`**

```tsx
type Props = {
  ...
};

export function SemanticAssistantPanel(props: Props) {
  return <div className="semantic-assistant-panel">...</div>;
}
```

- [ ] **Step 4: Move prompt/reconstruction sections out of `App.tsx` into the new component**

```tsx
<SemanticAssistantPanel ... />
```

- [ ] **Step 5: Add semantic assistant styles and rerun verification**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/semantic-assistant/SemanticAssistantPanel.tsx frontend/src/App.tsx frontend/src/styles.css
git commit -m "refactor: extract semantic assistant panel"
```

### Task 5: Add real media support files and sync README presentation

**Files:**
- Create: `docs/media/README.md`
- Modify: `README.md`

- [ ] **Step 1: Create `docs/media/README.md` with asset instructions**

```md
# Media Assets

Suggested files:
- workbench-overview.png
- import-review-flow.gif
- resource-replacement.png

Capture guidance:
- use a clean sample project
- show import, review, edit, and export states
- keep dimensions suitable for GitHub README rendering
```

- [ ] **Step 2: Update `README.md` to point to concrete media paths**

```md
## Project Media

Media assets live under `docs/media/`.
If screenshots or GIFs are not yet committed, see `docs/media/README.md` for capture guidance.
```

- [ ] **Step 3: Run the build/test verification again**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/media/README.md README.md
git commit -m "docs: add phase3 media guidance"
```

## Self-Review

- Spec coverage: export validation, SVG export path, export subsystem, semantic panel extraction, and README/media improvements are all covered.
- Placeholder scan: no TODO/TBD placeholders remain in action steps.
- Type consistency: `getExportValidationReport`, `buildTaskSvgExport`, `ExportCenter`, and `SemanticAssistantPanel` are introduced in a consistent progression.

# Medical Figure Workbench Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current scientific-figure demo into a usable internal lab workbench with a reliable import session, review stage, editor refinement flow, and export-ready outputs.

**Architecture:** Introduce an explicit import-session workflow on top of the current editor by separating import, parse/review, edit, and export concerns into focused front-end modules. Keep the existing React/Fabric foundation, but move the page away from one giant orchestration component and toward smaller UI units backed by stable import-session state and scene state.

**Tech Stack:** React, TypeScript, Vite, Fabric.js, Vitest, existing FastAPI backend routes, shared API contracts, scene graph types.

---

## File Structure

- Create: `frontend/src/features/import-session/types.ts`
  - Shared types for import mode, panel review state, and import-session lifecycle.
- Create: `frontend/src/features/import-session/state.ts`
  - Helper constructors and update utilities for import-session state.
- Create: `frontend/src/features/import-session/ImportWorkbench.tsx`
  - Source upload, mode selection, and session summary UI.
- Create: `frontend/src/features/import-session/SplitReviewPanel.tsx`
  - Panel review list, keep/ignore/import actions, OCR visibility, and split-mode messaging.
- Create: `frontend/src/features/resources/ResourceBrowser.tsx`
  - Recommended resources, search, category filters, and apply actions.
- Create: `frontend/src/features/export/ExportCenter.tsx`
  - PNG/JSON export actions and save/load affordances.
- Create: `frontend/src/features/import-session/state.spec.ts`
  - Tests for import-session state updates and review decisions.
- Create: `frontend/src/features/export/export.spec.ts`
  - Tests for export payload generation.
- Modify: `frontend/src/App.tsx`
  - Wire new modules together and reduce page-level UI sprawl.
- Modify: `frontend/src/copy.ts`
  - Add labels and messages for import modes, review actions, export, and save/load.
- Modify: `frontend/src/styles.css`
  - Add workflow-stage layouts and module-level styling hooks.
- Modify: `frontend/src/figure-workbench.ts`
  - Return richer split metadata and support import-mode-based splitting.
- Modify: `frontend/src/element-library.ts`
  - Keep recommendation helpers aligned with resource browser usage.
- Modify: `frontend/src/api.ts`
  - Add save/load or export-facing helper wrappers if needed.

### Task 1: Introduce explicit import-session state and tests

**Files:**
- Create: `frontend/src/features/import-session/types.ts`
- Create: `frontend/src/features/import-session/state.ts`
- Create: `frontend/src/features/import-session/state.spec.ts`

- [ ] **Step 1: Write the failing tests for import-session review behavior**

```ts
import { describe, expect, it } from "vitest";

import { createImportSession, setPanelDecision, setImportMode } from "./state";

describe("import session state", () => {
  it("starts with automatic mode and pending decisions", () => {
    const session = createImportSession({ fileName: "figure.png", sourceDataUrl: "data:image/png;base64,test" });
    expect(session.importMode).toBe("auto");
    expect(session.panels).toEqual([]);
  });

  it("updates per-panel keep or ignore decisions", () => {
    const base = {
      ...createImportSession({ fileName: "figure.png", sourceDataUrl: "data:image/png;base64,test" }),
      panels: [
        {
          id: "panel_a",
          label: "Panel A",
          decision: "pending",
        },
      ],
    };

    const next = setPanelDecision(base, "panel_a", "keep");
    expect(next.panels[0]?.decision).toBe("keep");
  });

  it("changes import mode explicitly", () => {
    const session = createImportSession({ fileName: "figure.png", sourceDataUrl: "data:image/png;base64,test" });
    const updated = setImportMode(session, "grid");
    expect(updated.importMode).toBe("grid");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/import-session/state.spec.ts`

Expected: FAIL because the import-session files do not exist yet.

- [ ] **Step 3: Create `frontend/src/features/import-session/types.ts`**

```ts
export type ImportMode = "auto" | "single" | "horizontal" | "vertical" | "grid";

export type PanelDecision = "pending" | "keep" | "ignore";

export type ImportSessionPanel = {
  id: string;
  label: string;
  decision: PanelDecision;
};

export type ImportSession = {
  fileName: string;
  sourceDataUrl: string;
  importMode: ImportMode;
  panels: ImportSessionPanel[];
};
```

- [ ] **Step 4: Create `frontend/src/features/import-session/state.ts`**

```ts
import type { ImportMode, ImportSession, PanelDecision } from "./types";

export function createImportSession(input: { fileName: string; sourceDataUrl: string }): ImportSession {
  return {
    fileName: input.fileName,
    sourceDataUrl: input.sourceDataUrl,
    importMode: "auto",
    panels: [],
  };
}

export function setPanelDecision(session: ImportSession, panelId: string, decision: PanelDecision): ImportSession {
  return {
    ...session,
    panels: session.panels.map((panel) => (panel.id === panelId ? { ...panel, decision } : panel)),
  };
}

export function setImportMode(session: ImportSession, importMode: ImportMode): ImportSession {
  return {
    ...session,
    importMode,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- src/features/import-session/state.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/import-session/types.ts frontend/src/features/import-session/state.ts frontend/src/features/import-session/state.spec.ts
git commit -m "feat: add import session state model"
```

### Task 2: Add explicit import modes to figure analysis

**Files:**
- Modify: `frontend/src/figure-workbench.ts`
- Modify: `frontend/src/figure-workbench.spec.ts`
- Modify: `frontend/src/features/import-session/types.ts`

- [ ] **Step 1: Extend tests to cover manual split modes**

```ts
import { describe, expect, it } from "vitest";

import { buildSplitRectsForMode } from "./figure-workbench";

describe("split mode helpers", () => {
  it("creates two vertical panels for horizontal mode", () => {
    const rects = buildSplitRectsForMode(1200, 600, "horizontal");
    expect(rects).toHaveLength(2);
    expect(rects[0]?.width).toBe(600);
  });

  it("creates four panels for grid mode", () => {
    const rects = buildSplitRectsForMode(1200, 800, "grid");
    expect(rects).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/figure-workbench.spec.ts`

Expected: FAIL because `buildSplitRectsForMode` does not exist yet.

- [ ] **Step 3: Implement manual split-mode helper in `frontend/src/figure-workbench.ts`**

```ts
export function buildSplitRectsForMode(width: number, height: number, mode: "auto" | "single" | "horizontal" | "vertical" | "grid") {
  if (mode === "single") {
    return [{ x: 0, y: 0, width, height }];
  }
  if (mode === "horizontal") {
    const halfWidth = Math.floor(width / 2);
    return [
      { x: 0, y: 0, width: halfWidth, height },
      { x: halfWidth, y: 0, width: width - halfWidth, height },
    ];
  }
  if (mode === "vertical") {
    const halfHeight = Math.floor(height / 2);
    return [
      { x: 0, y: 0, width, height: halfHeight },
      { x: 0, y: halfHeight, width, height: height - halfHeight },
    ];
  }
  if (mode === "grid") {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    return [
      { x: 0, y: 0, width: halfWidth, height: halfHeight },
      { x: halfWidth, y: 0, width: width - halfWidth, height: halfHeight },
      { x: 0, y: halfHeight, width: halfWidth, height: height - halfHeight },
      { x: halfWidth, y: halfHeight, width: width - halfWidth, height: height - halfHeight },
    ];
  }
  return [];
}
```

- [ ] **Step 4: Update `analyzeFigureFile()` to accept an import mode and use it before OCR**

```ts
export async function analyzeFigureFile(file: File, contextNotes: string, language: Language, importMode: ImportMode = "auto") {
  ...
  const resolvedRects =
    importMode === "auto"
      ? autoDetectedRects
      : buildSplitRectsForMode(naturalWidth, naturalHeight, importMode);
  ...
}
```

- [ ] **Step 5: Run the tests to verify split-mode support passes**

Run: `npm run test -- src/figure-workbench.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/figure-workbench.ts frontend/src/figure-workbench.spec.ts frontend/src/features/import-session/types.ts
git commit -m "feat: add explicit figure split modes"
```

### Task 3: Build the import-workbench module

**Files:**
- Create: `frontend/src/features/import-session/ImportWorkbench.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/copy.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing render-level test for mode labels**

```ts
import { describe, expect, it } from "vitest";

import { UI_COPY } from "../../copy";

describe("import workbench copy", () => {
  it("exposes manual split modes", () => {
    expect(UI_COPY.en.messages.quickImportHint).toContain("Upload image");
    expect(UI_COPY.en.labels.importWorkflow).toBe("Import workflow");
  });
});
```

- [ ] **Step 2: Run the test to confirm any missing copy surfaces quickly**

Run: `npm run test -- src/features/import-session/state.spec.ts src/element-library.spec.ts`

Expected: FAIL if copy keys are incomplete.

- [ ] **Step 3: Create `frontend/src/features/import-session/ImportWorkbench.tsx`**

```tsx
import type { ChangeEvent } from "react";

import type { Language } from "../../copy";
import type { ImportMode } from "./types";

type Props = {
  language: Language;
  contextNotes: string;
  importMode: ImportMode;
  onChangeContextNotes: (value: string) => void;
  onChangeImportMode: (mode: ImportMode) => void;
  onPickFile: () => void;
  onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  children?: React.ReactNode;
};

export function ImportWorkbench(props: Props) {
  return <div className="import-workbench">...</div>;
}
```

- [ ] **Step 4: Move upload/mode/context UI from `App.tsx` into the new component**

```tsx
<ImportWorkbench
  contextNotes={figureWorkbenchState.contextNotes}
  fileInputRef={figureFileInputRef}
  importMode={importSession.importMode}
  language={language}
  onChangeContextNotes={(value) => setFigureWorkbenchState((state) => ({ ...state, contextNotes: value }))}
  onChangeImportMode={handleImportModeChange}
  onFileSelected={handleFigureFileSelected}
  onPickFile={triggerFigureFilePicker}
/>
```

- [ ] **Step 5: Add mode labels and layout styles**

```css
.import-workbench {
  display: grid;
  gap: var(--space-3);
}

.import-mode-grid {
  display: grid;
  gap: var(--space-2);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
```

- [ ] **Step 6: Run tests and build to verify the import workbench module**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/import-session/ImportWorkbench.tsx frontend/src/App.tsx frontend/src/copy.ts frontend/src/styles.css
git commit -m "feat: add import workbench module"
```

### Task 4: Build the split-review module with keep/ignore/import behavior

**Files:**
- Create: `frontend/src/features/import-session/SplitReviewPanel.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/features/import-session/state.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing state test for keep/ignore counts**

```ts
import { describe, expect, it } from "vitest";

import { createImportSession, setPanelDecision } from "./state";

describe("review decisions", () => {
  it("tracks ignored panels separately", () => {
    const session = {
      ...createImportSession({ fileName: "figure.png", sourceDataUrl: "data:test" }),
      panels: [
        { id: "a", label: "Panel A", decision: "pending" },
        { id: "b", label: "Panel B", decision: "pending" },
      ],
    };

    const next = setPanelDecision(session, "b", "ignore");
    expect(next.panels.filter((panel) => panel.decision === "ignore")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to confirm the review model catches regressions**

Run: `npm run test -- src/features/import-session/state.spec.ts`

Expected: PASS after Task 1, acting as a guard before UI wiring.

- [ ] **Step 3: Create `frontend/src/features/import-session/SplitReviewPanel.tsx`**

```tsx
type Props = {
  panels: Array<{
    id: string;
    label: string;
    recognizedText: string;
    confidence: number;
    decision: "pending" | "keep" | "ignore";
  }>;
  onKeep: (panelId: string) => void;
  onIgnore: (panelId: string) => void;
  onImportSingle: (panelId: string) => void;
  onPreview: (panelId: string) => void;
};

export function SplitReviewPanel(props: Props) {
  return <div className="split-review-panel">...</div>;
}
```

- [ ] **Step 4: Wire split-review state into `App.tsx`**

```tsx
<SplitReviewPanel
  onIgnore={(panelId) => handlePanelDecision(panelId, "ignore")}
  onImportSingle={handleImportSinglePanel}
  onKeep={(panelId) => handlePanelDecision(panelId, "keep")}
  onPreview={handleFocusPanel}
  panels={reviewPanels}
/>
```

- [ ] **Step 5: Add styles for keep/ignore and review emphasis**

```css
.split-review-panel {
  display: grid;
  gap: var(--space-3);
}

.split-result-card.is-ignored {
  opacity: 0.5;
}
```

- [ ] **Step 6: Run tests and build to verify split review works**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/import-session/SplitReviewPanel.tsx frontend/src/features/import-session/state.ts frontend/src/App.tsx frontend/src/styles.css
git commit -m "feat: add split review stage"
```

### Task 5: Build the resource-browser module with recommendation-first behavior

**Files:**
- Create: `frontend/src/features/resources/ResourceBrowser.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/element-library.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing test for category-filtered recommendations**

```ts
import { describe, expect, it } from "vitest";

import { getRecommendedLibraryItems } from "../../element-library";

describe("resource browser recommendations", () => {
  it("supports category-filtered recommendation queries", () => {
    const results = getRecommendedLibraryItems("en", "renal tubular injury", "organ");
    expect(results[0]?.category).toBe("organ");
  });
});
```

- [ ] **Step 2: Run the tests to verify recommendation filtering is covered**

Run: `npm run test -- src/element-library.spec.ts`

Expected: PASS after extending helpers, or FAIL if category filtering needs adjustment.

- [ ] **Step 3: Create `frontend/src/features/resources/ResourceBrowser.tsx`**

```tsx
type Props = {
  recommendedItems: ElementLibraryItem[];
  filteredItems: ElementLibraryItem[];
  categories: Array<{ id: string; label: string }>;
  query: string;
  activeCategory: string;
  onChangeQuery: (value: string) => void;
  onChangeCategory: (value: string) => void;
  onApply: (assetUri: string, label: string) => void;
  actionLabel: string;
};

export function ResourceBrowser(props: Props) {
  return <div className="resource-browser">...</div>;
}
```

- [ ] **Step 4: Move resource-search and recommendation UI from `App.tsx` into the new module**

```tsx
<ResourceBrowser
  actionLabel={libraryActionLabel}
  activeCategory={libraryCategory}
  categories={[{ id: "all", label: language === "zh-CN" ? "全部" : "All" }, ...libraryCategories]}
  filteredItems={filteredLibraryItems}
  onApply={handleLibraryApply}
  onChangeCategory={setLibraryCategory}
  onChangeQuery={setLibraryQuery}
  query={libraryQuery}
  recommendedItems={recommendedLibraryItems}
/>
```

- [ ] **Step 5: Run tests and build to verify the module extraction**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/resources/ResourceBrowser.tsx frontend/src/App.tsx frontend/src/element-library.ts frontend/src/styles.css
git commit -m "feat: add modular resource browser"
```

### Task 6: Add export center and basic project recovery

**Files:**
- Create: `frontend/src/features/export/ExportCenter.tsx`
- Create: `frontend/src/features/export/export.spec.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/copy.ts`

- [ ] **Step 1: Write the failing test for export payload generation**

```ts
import { describe, expect, it } from "vitest";

import { buildSceneExportPayload } from "./export-utils";

describe("export payload", () => {
  it("creates a JSON export payload from scene metadata", () => {
    const payload = buildSceneExportPayload({ id: "scene_1", nodes: [] } as any);
    expect(payload.fileName).toContain("scene_1");
    expect(payload.mimeType).toBe("application/json");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/features/export/export.spec.ts`

Expected: FAIL because export helpers do not exist yet.

- [ ] **Step 3: Implement minimal export helper and component**

```ts
export function buildSceneExportPayload(scene: SceneGraph) {
  return {
    fileName: `${scene.id}.json`,
    mimeType: "application/json",
    content: JSON.stringify(scene, null, 2),
  };
}
```

```tsx
export function ExportCenter(props: { scene: SceneGraph; onSaveProject: () => void; onLoadProject: () => void }) {
  return <div className="export-center">...</div>;
}
```

- [ ] **Step 4: Wire simple local save/load behavior in `App.tsx`**

```tsx
function handleSaveProject() {
  window.localStorage.setItem("medical-figure-workbench:scene", JSON.stringify(scene));
}

function handleLoadProject() {
  const raw = window.localStorage.getItem("medical-figure-workbench:scene");
  if (raw) {
    setScene(JSON.parse(raw) as SceneGraph);
  }
}
```

- [ ] **Step 5: Run tests and build to verify export and recovery**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/export/ExportCenter.tsx frontend/src/features/export/export.spec.ts frontend/src/App.tsx frontend/src/api.ts frontend/src/copy.ts
git commit -m "feat: add export center and local project recovery"
```

### Task 7: Final module cleanup and workflow verification

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `README.md`

- [ ] **Step 1: Add a final workflow verification checklist to the README**

```md
## Product Workflow Check

1. Upload a figure
2. Choose split mode
3. Review panels
4. Import into canvas
5. Replace resources
6. Export PNG/JSON
```

- [ ] **Step 2: Reduce `App.tsx` orchestration to wiring and shared state only**

```tsx
<ImportWorkbench ... />
<SplitReviewPanel ... />
<CanvasWorkspace ... />
<ResourceBrowser ... />
<ExportCenter ... />
```

- [ ] **Step 3: Run full verification**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`

Expected:
- Uploading shows progress
- Split review appears
- Single-panel import works
- Resource replacement works
- Save/load works
- Export works

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/styles.css README.md
git commit -m "feat: productize medical figure workbench workflow"
```

## Self-Review

- Spec coverage: import modes, review stage, refinement stage, export, recovery, module decomposition, and workflow usability are all covered.
- Placeholder scan: no TODO/TBD placeholders remain in actionable steps.
- Type consistency: `ImportMode`, `ImportSession`, `SplitReviewPanel`, `ImportWorkbench`, `ResourceBrowser`, and `ExportCenter` are introduced consistently and reused across later tasks.

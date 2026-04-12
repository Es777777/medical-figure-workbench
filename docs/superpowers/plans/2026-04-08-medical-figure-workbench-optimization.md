# Medical Figure Workbench Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the medical figure editor feel like an import-first paper-figure workbench with a clearer primary workflow, easier panel-splitting discovery, stronger canvas presentation, and a richer guided resource system.

**Architecture:** Keep the current React + Fabric editor structure, but reorganize the page around a top-level workflow bar, a left import/split cockpit, a stronger central canvas workspace, and a right refinement/resources column. Implement most UX changes in `frontend/src/App.tsx`, `frontend/src/styles.css`, and `frontend/src/figure-workbench.ts`, while enriching resource metadata in `frontend/src/element-library.ts` and validating behavior with focused Vitest coverage.

**Tech Stack:** React, TypeScript, Vite, Fabric.js, Vitest, existing shared API contracts and scene graph types.

---

## File Structure

- Modify: `frontend/package.json`
  - Add `vitest`, `jsdom`, and a `test` script for lightweight UI/helper verification.
- Create: `frontend/vitest.config.ts`
  - Minimal Vitest config for DOM-like tests.
- Create: `frontend/src/figure-workbench.spec.ts`
  - Test import recommendation helpers and split-panel import behavior.
- Create: `frontend/src/element-library.spec.ts`
  - Test resource category coverage and keyword matching expectations.
- Modify: `frontend/src/App.tsx`
  - Reorganize primary workflow, split results actions, resource discovery area, and advanced tool placement.
- Modify: `frontend/src/styles.css`
  - Add workflow-bar, empty-state, split-result list, category filter, search, and refined canvas styles.
- Modify: `frontend/src/copy.ts`
  - Add workflow labels, helper copy, filter labels, and clearer status strings.
- Modify: `frontend/src/element-library.ts`
  - Add richer categories, grouping helpers, recommendation helpers, and search/filter support.
- Modify: `frontend/src/figure-workbench.ts`
  - Add per-panel import helpers, panel selection linkage, recommended resource lookup, and import-mode helpers.

### Task 1: Add lightweight test harness for UI helper logic

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/element-library.spec.ts`

- [ ] **Step 1: Write the failing tests for resource grouping expectations**

```ts
import { describe, expect, it } from "vitest";

import { getElementLibrary, getLibraryCategories, searchLibraryItems } from "./element-library";

describe("element library organization", () => {
  it("exposes stable medical categories", () => {
    expect(getLibraryCategories("en")).toEqual([
      { id: "organ", label: "Organs" },
      { id: "cell", label: "Cells" },
      { id: "signal", label: "Signals & Pathways" },
      { id: "container", label: "Structures" },
      { id: "outcome", label: "Injury & Outcomes" },
      { id: "process", label: "Processes" },
    ]);
  });

  it("finds renal-related assets with keyword search", () => {
    const results = searchLibraryItems(getElementLibrary("en"), "renal injury");
    expect(results.map((item) => item.id)).toContain("kidney-clean");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- element-library.spec.ts`

Expected: FAIL because `vitest` is not installed and helper exports do not exist yet.

- [ ] **Step 3: Add test tooling in `frontend/package.json`**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "test": "vitest run"
  },
  "devDependencies": {
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 4: Create `frontend/vitest.config.ts`**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const rootDir = path.resolve(currentDir, "..");

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(rootDir, "ts"),
      "@examples": path.resolve(rootDir, "examples"),
    },
  },
});
```

- [ ] **Step 5: Run the tests again to verify they still fail on missing exports**

Run: `npm install && npm run test -- element-library.spec.ts`

Expected: FAIL with messages like `getLibraryCategories is not exported`.

- [ ] **Step 6: Implement minimal library helpers in `frontend/src/element-library.ts`**

```ts
export type LibraryCategoryId = ElementLibraryItem["category"];

export function getLibraryCategories(language: Language): Array<{ id: LibraryCategoryId; label: string }> {
  return [
    { id: "organ", label: language === "zh-CN" ? "器官" : "Organs" },
    { id: "cell", label: language === "zh-CN" ? "细胞" : "Cells" },
    { id: "signal", label: language === "zh-CN" ? "信号与通路" : "Signals & Pathways" },
    { id: "container", label: language === "zh-CN" ? "结构" : "Structures" },
    { id: "outcome", label: language === "zh-CN" ? "损伤与结果" : "Injury & Outcomes" },
    { id: "process", label: language === "zh-CN" ? "过程" : "Processes" },
  ];
}

export function searchLibraryItems(items: ElementLibraryItem[], query: string): ElementLibraryItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return [...items].sort((left, right) => {
    const leftScore = [left.label, ...left.keywords].reduce((score, token) => score + (token.toLowerCase().includes(normalized) ? 1 : 0), 0);
    const rightScore = [right.label, ...right.keywords].reduce((score, token) => score + (token.toLowerCase().includes(normalized) ? 1 : 0), 0);
    return rightScore - leftScore || left.label.localeCompare(right.label);
  });
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test -- element-library.spec.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/vitest.config.ts frontend/src/element-library.ts frontend/src/element-library.spec.ts
git commit -m "test: add resource library helper coverage"
```

### Task 2: Add import-workflow helper coverage and panel import utilities

**Files:**
- Create: `frontend/src/figure-workbench.spec.ts`
- Modify: `frontend/src/figure-workbench.ts`

- [ ] **Step 1: Write failing tests for recommendation and single-panel import helpers**

```ts
import { describe, expect, it } from "vitest";

import type { SceneGraph } from "@shared/scene-graph";

import { buildPanelResourceRecommendations, insertSingleFigurePanelIntoScene } from "./figure-workbench";

const scene = {
  id: "scene_test",
  version: 1,
  kind: "scientific-figure",
  canvas: { width: 1200, height: 800, backgroundColor: "#fff" },
  source: {
    assetId: "src",
    originalUri: "/original.png",
    normalizedUri: "/normalized.png",
    originalDetectedFormat: "png",
    normalizedMimeType: "image/png",
    width: 1200,
    height: 800,
  },
  nodes: [],
} satisfies SceneGraph;

describe("figure workbench helpers", () => {
  it("recommends relevant assets from panel hints", () => {
    const results = buildPanelResourceRecommendations(
      {
        label: "Panel A",
        recognizedText: "renal tubular injury",
        semanticHints: [{ id: "kidney-clean", label: "Kidney", category: "organ", score: 3 }],
      },
      "en",
    );

    expect(results[0]?.id).toBe("kidney-clean");
  });

  it("imports only one chosen panel into the scene", () => {
    const result = insertSingleFigurePanelIntoScene(
      scene,
      {
        sourceName: "figure.png",
        sourceDataUrl: "data:image/png;base64,test",
        width: 1200,
        height: 800,
        summary: "summary",
        recommendedPrompt: "prompt",
        detectedKeywords: [],
        mergedRecognizedText: "",
        backendDrafts: null,
        panels: [
          {
            id: "panel_a",
            label: "Panel A",
            roleHint: "entity",
            bbox: { x: 0, y: 0, width: 200, height: 120 },
            previewUri: "data:image/png;base64,a",
            confidence: 0.9,
            semanticHints: [],
            recognizedText: "",
            textConfidence: null,
          },
        ],
      },
      "panel_a",
      "en",
    );

    expect(result.scene.nodes).toHaveLength(2);
    expect(result.selectedNodeId).toContain("img");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- figure-workbench.spec.ts`

Expected: FAIL because the helper functions do not exist yet.

- [ ] **Step 3: Implement minimal helpers in `frontend/src/figure-workbench.ts`**

```ts
export function buildPanelResourceRecommendations(panel: Pick<DetectedFigurePanel, "label" | "recognizedText" | "semanticHints">, language: Language) {
  const libraryItems = getElementLibrary(language);
  const combined = `${panel.label} ${panel.recognizedText} ${panel.semanticHints.map((hint) => hint.label).join(" ")}`.toLowerCase();

  return libraryItems
    .map((item) => ({ item, score: item.keywords.reduce((sum, keyword) => sum + (combined.includes(keyword.toLowerCase()) ? 1 : 0), 0) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label))
    .slice(0, 6)
    .map((entry) => entry.item);
}

export function insertSingleFigurePanelIntoScene(
  scene: SceneGraph,
  analysis: FigureWorkbenchAnalysis,
  panelId: string,
  language: Language,
) {
  const panel = analysis.panels.find((item) => item.id === panelId);
  if (!panel) {
    return { scene, selectedNodeId: null };
  }

  return insertFigurePanelsIntoScene(
    scene,
    {
      ...analysis,
      panels: [panel],
    },
    language,
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- figure-workbench.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/figure-workbench.ts frontend/src/figure-workbench.spec.ts
git commit -m "test: cover workbench recommendation helpers"
```

### Task 3: Reorganize the page around the primary import workflow

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/copy.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing UI state test for workflow labels**

```ts
import { describe, expect, it } from "vitest";

import { UI_COPY } from "./copy";

describe("workflow copy", () => {
  it("exposes explicit import-first labels", () => {
    expect(UI_COPY.en.actions.parseAndSplitFigure).toBe("Parse and split figure");
    expect(UI_COPY.en.labels.importWorkflow).toBe("Import workflow");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails if copy is incomplete**

Run: `npm run test -- figure-workbench.spec.ts element-library.spec.ts`

Expected: FAIL if any required workflow copy keys are missing.

- [ ] **Step 3: Implement the top workflow bar and import-first sidebar layout in `frontend/src/App.tsx`**

```tsx
<section className="workflow-bar panel">
  <button className="primary-button" onClick={triggerFigureFilePicker} type="button">{copy.actions.uploadFigure}</button>
  <button className="primary-button" onClick={triggerFigureFilePicker} type="button">{copy.actions.parseAndSplitFigure}</button>
  <button className="secondary-button" disabled={!figureWorkbenchState.analysis} onClick={handleImportDetectedPanels} type="button">
    {figureWorkbenchState.analysis?.backendDrafts ? copy.actions.autoImport : copy.actions.importPanels}
  </button>
  <button className="secondary-button" disabled={!figureWorkbenchState.analysis} onClick={handleAnalyzeImportedSemantics} type="button">
    {copy.actions.analyzeImportedSemantics}
  </button>
</section>

<aside className="panel sidebar-panel import-panel">
  <div className="property-block figure-workbench-block">...</div>
  <div className="property-block split-results-block">...</div>
</aside>
```

- [ ] **Step 4: Add split-result actions and empty-state messaging in `frontend/src/App.tsx`**

```tsx
{figureWorkbenchState.analysis?.panels.map((panel) => (
  <article className="split-result-card" key={panel.id}>
    <img alt={panel.label} className="figure-panel-preview" src={panel.previewUri} />
    <div className="figure-panel-meta">
      <strong>{panel.label}</strong>
      <span>{panel.recognizedText || "No OCR text"}</span>
    </div>
    <div className="prompt-actions-row">
      <button className="secondary-button" onClick={() => handleImportSinglePanel(panel.id)} type="button">Import only this panel</button>
      <button className="secondary-button" onClick={() => handleFocusPanel(panel.id)} type="button">Preview focus</button>
    </div>
  </article>
))}

{scene.nodes.length === 0 ? (
  <div className="canvas-empty-state">
    <strong>{copy.actions.parseAndSplitFigure}</strong>
    <p>{copy.messages.quickImportHint}</p>
  </div>
) : null}
```

- [ ] **Step 5: Add the related labels and copy in `frontend/src/copy.ts`**

```ts
actions: {
  uploadFigure: "Upload figure image",
  parseAndSplitFigure: "Parse and split figure",
  importPanels: "Import split panels",
  autoImport: "Auto-import analyzed scene",
}

labels: {
  importWorkflow: "Import workflow",
}

messages: {
  quickImportHint: "1) Upload image  2) Browser parses and splits panels  3) Auto-import the analyzed scene into the canvas.",
}
```

- [ ] **Step 6: Add layout styles in `frontend/src/styles.css`**

```css
.workflow-bar {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: var(--space-4);
}

.split-result-card {
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
}

.canvas-empty-state {
  align-items: center;
  color: var(--color-muted);
  display: grid;
  gap: var(--space-2);
  justify-items: center;
  min-height: 14rem;
}
```

- [ ] **Step 7: Run tests and build to verify the UI reorganization**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx frontend/src/copy.ts frontend/src/styles.css
git commit -m "feat: reorganize editor around import workflow"
```

### Task 4: Add guided medical resource discovery and selection-aware recommendations

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/element-library.ts`
- Modify: `frontend/src/figure-workbench.ts`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing test for recommendation ranking**

```ts
import { describe, expect, it } from "vitest";

import { getRecommendedLibraryItems } from "./element-library";

describe("recommended library items", () => {
  it("prefers macrophage-like assets for immune context", () => {
    const results = getRecommendedLibraryItems("en", "immune macrophage activation");
    expect(results[0]?.id).toBe("macrophage");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- element-library.spec.ts`

Expected: FAIL because `getRecommendedLibraryItems` is not implemented.

- [ ] **Step 3: Implement recommendation and filtering helpers in `frontend/src/element-library.ts`**

```ts
export function getRecommendedLibraryItems(language: Language, context: string, category?: LibraryCategoryId): ElementLibraryItem[] {
  const items = getElementLibrary(language).filter((item) => (category ? item.category === category : true));
  const normalized = context.toLowerCase();

  return items
    .map((item) => ({ item, score: item.keywords.reduce((sum, keyword) => sum + (normalized.includes(keyword.toLowerCase()) ? 1 : 0), 0) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label))
    .map((entry) => entry.item);
}
```

- [ ] **Step 4: Wire search, category filters, and recommended strip into `frontend/src/App.tsx`**

```tsx
const [libraryQuery, setLibraryQuery] = useState("");
const [libraryCategory, setLibraryCategory] = useState<LibraryCategoryId | "all">("all");

const recommendedItems = useMemo(() => {
  const context = `${selectedNode?.name ?? ""} ${figureWorkbenchState.analysis?.mergedRecognizedText ?? ""}`;
  return getRecommendedLibraryItems(language, context).slice(0, 6);
}, [language, selectedNode, figureWorkbenchState.analysis]);

const filteredLibraryItems = useMemo(() => {
  const base = libraryCategory === "all" ? libraryItems : libraryItems.filter((item) => item.category === libraryCategory);
  return searchLibraryItems(base, libraryQuery);
}, [libraryItems, libraryCategory, libraryQuery]);
```

- [ ] **Step 5: Add filter/search styles in `frontend/src/styles.css`**

```css
.library-toolbar {
  display: grid;
  gap: var(--space-2);
}

.library-filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.recommended-strip {
  display: grid;
  gap: var(--space-3);
}
```

- [ ] **Step 6: Run tests and build to verify guided resource discovery**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/element-library.ts frontend/src/figure-workbench.ts frontend/src/styles.css
git commit -m "feat: add guided medical resource discovery"
```

### Task 5: Polish canvas presentation and advanced tool placement

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing style expectation test as a configuration guard**

```ts
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("canvas polish styles", () => {
  it("contains workflow and empty-state classes", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "styles.css"), "utf8");
    expect(css).toContain(".workflow-bar");
    expect(css).toContain(".canvas-empty-state");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails before the final polish lands**

Run: `npm run test -- figure-workbench.spec.ts`

Expected: FAIL if the classes are not present yet.

- [ ] **Step 3: Finalize the canvas and advanced-tool layout in `frontend/src/App.tsx`**

```tsx
<section className="panel canvas-panel">
  <div className="panel-heading canvas-heading">...</div>
  <div className={`canvas-scroll${targetLocalization ? " is-localizing" : ""}`} ref={canvasViewportRef}>
    <div className="canvas-stage">
      {scene.nodes.length === 0 ? <div className="canvas-empty-state">...</div> : null}
      <EditorCanvas ... />
    </div>
  </div>
</section>

<div className="property-block advanced-tools-block">
  <details>
    <summary>{copy.sections.promptPlanner}</summary>
    ...
  </details>
  <details>
    <summary>{copy.sections.reconstruction}</summary>
    ...
  </details>
</div>
```

- [ ] **Step 4: Finalize canvas treatment in `frontend/src/styles.css`**

```css
.canvas-scroll {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(240, 235, 226, 0.7)),
    linear-gradient(90deg, rgba(12, 143, 138, 0.04) 1px, transparent 1px),
    linear-gradient(rgba(12, 143, 138, 0.04) 1px, transparent 1px);
  background-size: auto, 24px 24px, 24px 24px;
}

.canvas-stage canvas {
  background: #ffffff;
  border: 1px solid rgba(141, 127, 111, 0.32);
  box-shadow: 0 22px 44px rgba(31, 42, 53, 0.12);
}
```

- [ ] **Step 5: Run the full verification**

Run: `npm run test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/styles.css
git commit -m "feat: polish canvas workspace and advanced tool layout"
```

## Self-Review

- Spec coverage: covered workflow visibility, split panel discoverability, canvas polish, resource discovery, and advanced-tool de-emphasis.
- Placeholder scan: no TODO/TBD placeholders remain in tasks.
- Type consistency: helper names are consistent across test and implementation tasks (`getLibraryCategories`, `searchLibraryItems`, `buildPanelResourceRecommendations`, `insertSingleFigurePanelIntoScene`, `getRecommendedLibraryItems`).

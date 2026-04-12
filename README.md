# Medical Figure Workbench

Medical Figure Workbench is an internal-lab web tool for turning manuscript figures, graphical abstracts, and scientific mechanism diagrams into editable figure scenes.

It is built for the real workflow that many research teams actually need:

1. Upload a source figure
2. Split likely panels
3. Review and correct what the system found
4. Refine the figure on a canvas
5. Replace content with medical resources
6. Export usable outputs

## Project Media

This repository is ready for a richer GitHub front page, but media files are not checked in yet.

Recommended future additions:
- `docs/media/workbench-overview.png` - full UI screenshot
- `docs/media/import-review-flow.gif` - short import-to-review demo
- `docs/media/resource-replacement.png` - resource suggestion and replacement example

Suggested placement once media exists:

```md
![Workbench overview](docs/media/workbench-overview.png)
```

```md
![Import review flow](docs/media/import-review-flow.gif)
```

## Why This Project Exists

Most scientific figure tools are either:
- general design tools with no manuscript-specific workflow, or
- highly automated pipelines that are hard to correct when they get things wrong

This project takes a more practical middle path:

- use browser-side splitting and OCR to accelerate figure editing
- allow users to review and correct intermediate results
- keep a canvas for manual refinement
- provide medically relevant resource suggestions for faster cleanup

The goal is not to replace a full design suite. The goal is to make paper-figure cleanup and reworking faster for internal lab use.

## Current Highlights

- Browser-side figure splitting with fallback split strategies
- OCR on detected panels using `tesseract.js`
- Backend draft analysis support through `analyze-asset`
- Panel-by-panel review actions: keep, ignore, import individually, preview
- Editable scientific figure canvas based on Fabric.js
- Medical resource recommendations with category filters and search
- Local save/load for project recovery
- JSON export and PNG export

## Product Workflow

### 1. Import

- Upload a manuscript figure or graphical abstract
- Choose an import mode:
  - `Automatic`
  - `Single image`
  - `Left / right split`
  - `Top / bottom split`
  - `Grid split`
- Add context notes for better semantic suggestions

### 2. Parse and Review

- The browser analyzes the uploaded image
- OCR runs on the detected panels
- If the backend is available, draft nodes are requested from `analyze-asset`
- Review each panel and:
  - keep it
  - ignore it
  - import it individually
  - preview its focus in the canvas

### 3. Edit

- Auto-import the analyzed scene or import a single panel
- Move, resize, and edit figure nodes on the canvas
- Replace current content with suggested medical resources
- Continue using prompt analysis and reconstruction tools when needed

### 4. Export and Recovery

- Save the project to local browser storage
- Reload a previous session later
- Export the current scene as JSON
- Export the current canvas as PNG

## Quick Start

### Backend

```bash
python -m pip install --user fastapi uvicorn pillow
python -m uvicorn python.backend.main:app --reload
```

Backend health check:

```text
http://127.0.0.1:8000/healthz
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:5173
```

### One-click startup

From the project root:

```bat
start_all.bat
```

## Repository Structure

```text
.
├─ README.md
├─ docs/
│  └─ superpowers/
├─ examples/
├─ frontend/
│  ├─ package.json
│  ├─ vite.config.ts
│  └─ src/
│     ├─ App.tsx
│     ├─ EditorCanvas.tsx
│     ├─ api.ts
│     ├─ copy.ts
│     ├─ element-library.ts
│     ├─ figure-workbench.ts
│     ├─ features/
│     │  ├─ export/
│     │  ├─ import-session/
│     │  └─ resources/
│     ├─ scene-data.ts
│     └─ styles.css
├─ python/
│  ├─ backend/
│  ├─ image_normalize.py
│  └─ tests/
└─ ts/
   ├─ api-contracts.ts
   └─ scene-graph.ts
```

## Frontend Modules

- `frontend/src/features/import-session/ImportWorkbench.tsx`
  - Upload, import mode selection, and import-session guidance
- `frontend/src/features/import-session/SplitReviewPanel.tsx`
  - Panel review actions such as keep, ignore, import, and preview
- `frontend/src/features/resources/ResourceBrowser.tsx`
  - Recommended resources, category filters, and search
- `frontend/src/features/export/ExportCenter.tsx`
  - Save/load and export actions
- `frontend/src/figure-workbench.ts`
  - Panel detection, OCR, split-mode helpers, and scene insertion helpers

## Verification

### Frontend

```bash
cd frontend
npm run test
npm run build
```

### Python

```bash
python -m unittest discover python/tests
```

## Known Boundaries

- Panel splitting is still heuristic rather than model-based segmentation
- OCR uses `tesseract.js`, so dense formulas and rotated text remain challenging
- PNG export currently captures the active canvas surface, not a publishing-grade compositor pipeline
- Local save/load uses browser storage, not shared team persistence

## Roadmap

### Near-term

1. Continue shrinking `App.tsx` by extracting more canvas-side refinement blocks
2. Improve split-review decisions so bulk import respects keep/ignore states directly
3. Strengthen export with cleaner PNG/SVG output
4. Add import/export for saved sessions beyond browser-local storage

### Longer-term

1. Improve backend-side visual analysis quality
2. Add stronger OCR handling for dense scientific labels and formulas
3. Add team-friendly persistence instead of browser-only recovery
4. Support more robust publication-oriented export formatting

## Good First Improvements

If you want to continue productizing this project, the most useful next changes are:

- extract more workflow state out of `frontend/src/App.tsx`
- add explicit bulk import of only kept panels
- add project session file import/export
- improve README with screenshots or a short animated demo

## Suggested GitHub Milestones

- `v0.2 Workflow Stabilization`
  - manual split modes
  - keep/ignore-aware bulk import
  - clearer progress and recovery states
- `v0.3 Productized Editing`
  - more module extraction from `App.tsx`
  - stronger export quality
  - improved scene save/load behavior
- `v0.4 Analysis Quality`
  - better backend analysis accuracy
  - stronger OCR handling for scientific labels
  - improved semantic reconstruction support

## Status

This project has moved beyond a pure prototype, but it is still in the internal-tool productization phase rather than being a finished public product.

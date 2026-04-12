# Medical Figure Workbench

Medical Figure Workbench is an internal-lab web tool for turning manuscript figures and graphical abstracts into editable scientific figure scenes.

It is designed for a practical workflow:

1. Import a source figure
2. Parse and split likely panels
3. Review and correct the detected results
4. Refine the scene on a canvas
5. Replace content with medical resources
6. Export JSON or PNG output

## What It Does

- Normalizes source images into a stable backend-friendly format
- Splits composite figures into editable panel candidates in the browser
- Runs browser OCR on detected panels
- Requests backend draft structure analysis when the backend is available
- Converts panels and draft nodes into an editable scene graph
- Provides a scientific-figure canvas for text, image, and relation refinement
- Suggests medical resources using OCR text, semantic hints, and current selection context
- Saves and reloads the scene state locally
- Exports scene JSON and canvas PNG

## Product Workflow

### 1. Import

- Upload a manuscript figure
- Choose an import mode:
  - `Automatic`
  - `Single image`
  - `Left / right split`
  - `Top / bottom split`
  - `Grid split`
- Add context notes to help semantic suggestions

### 2. Parse and Review

- The browser analyzes the uploaded image
- OCR is run on split panels
- If the backend is running, draft nodes are also requested from `analyze-asset`
- Review each panel and:
  - keep it
  - ignore it
  - import it individually
  - preview its focus in the canvas

### 3. Edit

- Auto-import the analyzed scene or import one panel at a time
- Move, resize, and edit nodes on the canvas
- Replace current images with recommended medical resources
- Continue refining prompts and reconstruction guidance when needed

### 4. Export and Recovery

- Save the current project to local browser storage
- Reload a saved project state later
- Export the current scene as JSON
- Export the current canvas as PNG

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

## Current Frontend Modules

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

## Known Boundaries

- Panel splitting is still heuristic rather than model-based segmentation
- OCR uses `tesseract.js`, so dense formulas and rotated text remain challenging
- PNG export currently captures the active canvas surface, not a publishing-grade compositor pipeline
- Local save/load uses browser storage, not shared team persistence

## Recommended Next Steps

1. Continue shrinking `App.tsx` by extracting canvas-side refinement blocks
2. Add a stronger export pipeline for cleaner PNG/SVG generation
3. Add session import/export beyond browser-local recovery
4. Improve split-review decisions so bulk import respects keep/ignore states directly
5. Add more robust backend-side visual analysis when higher accuracy is needed

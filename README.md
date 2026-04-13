# Medical Figure Workbench

Medical Figure Workbench is an internal-lab web tool for turning manuscript figures, graphical abstracts, and scientific mechanism diagrams into editable figure scenes.

It now supports a two-layer workflow:

1. Figure-level import, split review, editing, and export
2. Project-level persistence for multiple figure tasks in one working project

## What Changed in Phase 2

Phase 2 moves the tool beyond a single-session editor by adding a project shell around the figure workbench.

New capabilities include:
- a project model with multiple figure tasks
- project toolbar and task list UI
- project-level save/load recovery
- project file export and import
- active-task switching for multi-figure workflows
- export validation warnings
- task-level SVG export path

This is the foundation for using the tool repeatedly across a whole manuscript instead of only one temporary browser session.

## Project Media

Repository media assets should live under `docs/media/`.

Planned assets:
- `docs/media/workbench-overview.png`
- `docs/media/import-review-flow.gif`
- `docs/media/resource-replacement.png`

If those files are not committed yet, see `docs/media/README.md` for capture guidance.

## Workflow

### Figure Workflow

1. Upload a source figure
2. Choose an import mode
3. Review panel splitting and OCR results
4. Import selected content into the canvas
5. Refine and replace assets
6. Export JSON or PNG for the current figure

### Project Workflow

1. Create or open a project
2. Add multiple figure tasks
3. Switch between tasks while preserving each task's state
4. Save project progress locally
5. Export the project file as JSON
6. Reopen the project file later and resume work
7. Review export validation before PNG/SVG output

## Quick Start

### Backend

```bash
python -m pip install --user fastapi uvicorn pillow
python -m uvicorn python.backend.main:app --reload
```

Health check:

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

```bat
start_all.bat
```

## Project-Level Features

- `Save project`
  - stores the current project in browser-local storage
- `Load project`
  - restores the current project from browser-local storage
- `Save project file`
  - downloads the full project as JSON
- `Open project file`
  - loads a previously exported project JSON file
- `Export SVG`
  - produces an initial task-level SVG output path
- `New task`
  - creates a new figure task inside the current project

## Repository Structure

```text
.
├─ README.md
├─ docs/
│  └─ superpowers/
├─ frontend/
│  └─ src/
│     ├─ features/
│     │  ├─ editor/
│     │  ├─ export/
│     │  ├─ import-session/
│     │  ├─ project/
│     │  └─ resources/
│     ├─ figure-workbench.ts
│     ├─ scene-data.ts
│     └─ App.tsx
├─ python/
└─ ts/
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

## Known Boundaries

- Panel splitting is still heuristic rather than model-based segmentation
- OCR still depends on browser-side `tesseract.js`
- Project persistence is local-first, not shared across users
- Project files are JSON-based and currently optimized for internal workflow rather than compact distribution

## Current Roadmap

### Next priority

1. Improve SVG export fidelity beyond the initial path
2. Add real screenshots and GIFs under `docs/media/`
3. Continue reducing `App.tsx` orchestration pressure

### Later

1. Better backend visual analysis quality
2. Stronger OCR handling for dense scientific labels and formulas
3. Shared persistence beyond browser-local storage

## Status

The project is now in a reusable internal-tool phase: more than a prototype, but still evolving toward a stronger long-term manuscript-figure workflow.

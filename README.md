# Medical Figure Workbench

Medical Figure Workbench is an internal-lab web tool for turning manuscript figures, graphical abstracts, and scientific mechanism diagrams into editable figure scenes.

## 中文简介

Medical Figure Workbench 是一个面向实验室内部使用的科研图处理工具，目标是把论文配图、graphical abstract 和机制图快速转换成可编辑的科研图场景。

它当前支持的核心流程包括：

1. 上传论文图或科研配图
2. 自动或手动拆分分图 panel
3. 复核 OCR、分图和语义建议
4. 导入到画布继续编辑
5. 替换医学资源、调整文字和结构
6. 导出 task / project 结果

目前项目已经具备：
- figure 级导入、拆分、编辑和导出
- project / task 级保存、切换和恢复
- export validation
- task PNG / SVG / JSON
- project JSON
- batch task JSON / SVG / PNG contract

如果你主要是中文用户，可以先看本节快速了解项目定位，再继续阅读下面的英文 README 获取完整的启动方式、模块结构和路线图。

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
- batch task JSON and SVG export helpers

This is the foundation for using the tool repeatedly across a whole manuscript instead of only one temporary browser session.

## Project Media

Repository media assets should live under `docs/media/`.

Planned assets:
- `docs/media/workbench-overview.png`
- `docs/media/import-review-flow.gif`
- `docs/media/resource-replacement.png`

If those files are not committed yet, see `docs/media/README.md` for capture guidance.

The recommended capture set now also includes a first-use onboarding state, so future screenshots and GIFs can show how a new user enters the workflow.

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

1. Improve SVG export fidelity for image, panel, and arrow content even further
2. Add batch PNG export with a reliable render path
3. Add real screenshots and GIFs under `docs/media/`
4. Continue reducing `App.tsx` orchestration pressure

### Later

1. Better backend visual analysis quality
2. Stronger OCR handling for dense scientific labels and formulas
3. Shared persistence beyond browser-local storage

## Status

The project is now in a reusable internal-tool phase: more than a prototype, but still evolving toward a stronger long-term manuscript-figure workflow.

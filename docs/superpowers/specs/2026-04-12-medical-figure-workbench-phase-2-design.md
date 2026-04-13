# Medical Figure Workbench Phase 2 Design

Date: 2026-04-12

## Goal

Advance Medical Figure Workbench from a usable single-session internal tool into a reusable internal workflow tool with persistent project files, recoverable import sessions, and multi-task figure management.

## Phase 2 Focus

Phase 1 established a working import-review-edit-export loop.

Phase 2 focuses on making the tool sustainable for repeated lab use by improving:
- project persistence
- save/load workflow
- multi-figure task management
- recovery after interruption

This phase is explicitly about making the tool feel reliable and reusable, not just functional in a single browser session.

## Problem Statement

The current tool now supports import, split review, canvas refinement, and export. However, it still behaves primarily like a session-oriented editor.

Current limitations:
- the main editable scene can be saved to browser storage, but the broader workflow context is not modeled as a durable project
- import-session details such as split results, OCR summaries, prompt suggestions, and review decisions are not yet treated as first-class recoverable data
- users still operate primarily on one figure at a time without a proper project-level task list
- a manuscript or lab workflow often involves multiple figures, multiple revisions, and interrupted work across sessions

For an internal lab tool, these limitations are more important than additional AI features.

## Product Direction

Introduce a project layer above the current figure editor.

The product should support:
- one project containing multiple figure tasks
- durable save/load of project state
- recovery of both scene state and import/review state
- smooth switching between figure tasks without re-uploading or rebuilding context manually

This phase does not require a cloud backend or collaboration model. It should remain local-first and internal-tool oriented.

## Core User Outcomes

At the end of Phase 2, a user should be able to:
- start a project for one paper
- create multiple figure tasks inside that project
- save progress and reopen it later
- switch between figure tasks without losing state
- continue editing where they left off after refresh or restart

## Data Model

Phase 2 should introduce a structured project file model.

### Project file

The top-level saved object should represent the whole working project.

Recommended fields:
- project id
- project title
- createdAt
- updatedAt
- currentTaskId
- tasks
- settings

### Figure task

Each figure task should represent one source figure and its downstream work.

Recommended fields:
- task id
- task title
- createdAt
- updatedAt
- status
- source image metadata
- import mode
- panel results
- OCR results
- backend draft results
- review decisions
- recommended prompt
- scene graph
- export history or export metadata

### Why this matters

This structure gives the product a stable boundary between:
- project management
- import/review workflow
- editing workflow
- export workflow

It also creates a clean path toward future batch processing and richer persistence.

## Workflow Design

### Project layer

The interface should gain a project-level layer without destroying the existing workbench layout.

Users should be able to:
- create a new project
- rename a project
- save project file
- open project file
- create a new figure task
- switch between existing tasks

### Task list

The product should expose a visible task list for figures within the current project.

Each task should display:
- figure title
- status
- last updated time
- whether it has a saved scene

Statuses can remain simple in Phase 2:
- pending import
- parsed
- in review
- editing
- exported

### Current task workspace

The existing workbench remains the active-task workspace.

When switching tasks, the app should restore that task's:
- source preview
- import mode
- split results
- review decisions
- OCR text
- prompt suggestions
- canvas scene

The key product requirement is that task switching should feel like loading another working draft, not restarting the tool.

## Persistence Strategy

Phase 2 should remain local-first.

### Level 1: browser recovery

Continue supporting browser-local recovery so users do not lose current work on refresh or accidental close.

This should evolve from storing only the scene to storing the full project object.

### Level 2: project file import/export

Add support for:
- Save Project File
- Open Project File

Preferred format:
- JSON project file

This enables:
- moving work between machines
- sharing drafts between lab members manually
- archival of figure work outside the browser

## Scope of Saved Data

The project file should include enough information to restore a useful working state.

At minimum, this includes:
- project metadata
- task metadata
- scene graph
- import mode
- split review decisions
- OCR summaries
- prompt suggestions

If raw image data is stored as data URLs, that is acceptable in Phase 2 as long as the file size remains manageable for internal use.

If raw image storage becomes too large, that can be optimized in a later phase.

## Batch and Multi-Task Design

Phase 2 should not attempt a full processing queue system.

Instead, it should introduce a multi-task shell that prepares for future batching.

Required task operations:
- create task
- duplicate task
- delete task
- rename task
- switch active task

This is enough to support a paper with multiple figure variants and revisions.

## Export Design

Export should be aligned with the new project model.

Phase 2 export actions should distinguish between:
- export current task as JSON
- export current task as PNG
- export entire project file

This keeps task-level outputs and project-level persistence separate and easy to understand.

## UI Structure Changes

The current layout can be preserved, but a project/task layer must be added.

### Top bar additions

Add project controls to the top strip or header area:
- project title
- save project
- open project
- create task

### Left column additions

Add a task list panel alongside or below import/review controls.

The left side then becomes:
- import controls
- split review
- task list

### Center column

The center remains the active task's canvas workspace.

### Right column

The right remains refinement and export focused, now with export controls tied to the active task and project.

## Code Structure Direction

Phase 2 should continue the existing modularization path.

Recommended additions:
- `frontend/src/features/project/`
  - project file types
  - project save/load helpers
  - task list UI
- `frontend/src/state/project-store.ts`
  - project-level state orchestration
- updates to import-session and export modules so they operate per task rather than as page-global assumptions

This should reduce pressure on `frontend/src/App.tsx` and move the app toward a workflow shell backed by a clearer project model.

## Non-Goals for Phase 2

To keep this phase focused, the following are out of scope:
- cloud sync
- team collaboration
- user authentication
- server-side project persistence
- complex distributed batch execution
- publication-grade SVG compositor pipeline

Those can come later if the internal tool proves valuable enough.

## Verification Requirements

Phase 2 should be considered successful only if the following are verified:

- create a project and add multiple figure tasks
- save a project and reopen it from a file
- refresh the page and recover the current project state
- switch between tasks and confirm each task restores its own scene and import context
- export current task JSON and PNG
- build and tests continue to pass

## Success Criteria

Phase 2 succeeds when:
- the tool no longer feels like a single temporary session
- work can be safely resumed after interruption
- one paper with multiple figures can be managed in a single project
- users can trust that review, edit, and export progress will persist

## Recommended Implementation Priority

1. Define project file and figure task types
2. Replace scene-only local recovery with project-level recovery
3. Add project file save/open
4. Add visible task list and active-task switching
5. Align export actions with task-level and project-level outputs

## Long-Term Role of Phase 2

This phase is the bridge between a useful prototype and a durable internal application.

Once complete, later work can safely focus on:
- better export fidelity
- better analysis quality
- stronger OCR and segmentation
- optional shared persistence

Without Phase 2, those future improvements would still sit on top of a fragile session-only foundation.

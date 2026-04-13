# Medical Figure Workbench Next Phase Design

Date: 2026-04-12

## Goal

Advance Medical Figure Workbench beyond the current Phase 3 state by improving export quality, reducing architecture pressure in the application shell, and turning the repository and product experience into something more complete and self-explanatory.

## Context

The project has already progressed through three meaningful stages:

- Phase 1: usable figure import, split, edit, and export workflow
- Phase 2: reusable project and multi-task workflow
- Phase 3: stronger export structure, semantic-panel extraction, and better repository documentation

The next phase should not repeat those steps. It should build on them by focusing on the things that now limit the product from feeling mature.

## Main Problems to Solve

### 1. Export quality is still only partially mature

The export subsystem is now much stronger than before, but there are still important gaps:
- SVG export is only an initial path, not yet a strong output format
- export remains mostly task-by-task rather than helping with real multi-task project output
- export validation is present, but still limited to a small set of obvious warnings

### 2. Application structure still carries too much central coordination

`frontend/src/App.tsx` is smaller than it was, but still owns too many responsibilities.

Remaining pressure points include:
- project/task orchestration
- workbench session state
- export coordination
- onboarding-level user guidance

This increases implementation cost for future features and keeps behavior harder to reason about than necessary.

### 3. Presentation is documented but not yet fully demonstrated

The repository is documented clearly, but the project still lacks:
- real screenshots committed to the repo
- real GIF or short workflow media
- lightweight in-app onboarding for first-time users
- a more direct first-use path for people opening the tool for the first time

## Product Direction

The next phase should follow a three-track model, with a clear priority order.

### Track 1: Delivery quality

Strengthen the final outputs users rely on:
- task PNG
- task SVG
- task JSON
- project JSON
- batch export for projects with multiple figure tasks

### Track 2: Architectural hardening

Continue moving logic out of `App.tsx` and into explicit workflow layers.

### Track 3: Presentation and onboarding

Make the project easier to understand at a glance, both in the repository and inside the application itself.

## Export Design

### Task export enhancements

Task export should become more deliberate and presentation-ready.

Required upgrades:
- better task-based naming for exported files
- clearer output identity for PNG and SVG
- stronger SVG serialization for basic scene content

### Project export enhancements

The current product already has project JSON export.

This next phase should add:
- batch export of task PNG outputs
- batch export of task JSON outputs
- a clearer export entry point for the entire project

This matters because the current multi-task project model is only partially useful unless users can also export multiple tasks efficiently.

### Export validation expansion

The export validation system should grow beyond the initial warnings.

Useful additional checks include:
- tasks with pending split review decisions
- empty or whitespace-only text nodes
- tasks with no scene nodes
- tasks with nodes far outside the visible canvas
- project-level tasks that were never imported into the canvas

This validation should remain advisory, not excessively blocking.

## Architecture Direction

The next phase should continue the existing decomposition path.

### Recommended state layers

#### Project store

Owns:
- full project
- task list
- active task switching
- project save/load

#### Workbench session store

Owns:
- import-mode state
- split review state
- OCR/analysis snapshots
- semantic and review session state per task

#### Export pipeline layer

Owns:
- task export
- project export
- export validation
- batch export logic

### Target component direction

Further decomposition should focus on:
- project shell
- export workflow
- onboarding/demo helpers

The goal is not a large rewrite. The goal is to continue making future work safer and easier to reason about.

## Presentation Layer Design

### Repository media

The repository should now move from media guidance to actual media assets.

Recommended assets to commit:
- full workbench overview screenshot
- import-review-edit-export GIF
- resource replacement screenshot
- optional project/task switching screenshot

### In-app onboarding

Add a lightweight onboarding experience for first-time use.

This should explain:
- what the tool is for
- how to start
- the four main steps in the workflow

It should be small, dismissible, and practical.

### Demo entry

Add a clearer sample project or demo entry point so new users can inspect a working example without uploading their own image immediately.

## Batch Export Design

Batch export does not need to become a queueing system yet.

The minimal useful form is:
- user selects export all tasks
- app generates task outputs one-by-one
- output names are task-aware
- export report shows what succeeded and what produced warnings

This is enough to make the project-level workflow much more useful in practice.

## Verification Requirements

This next phase should be considered successful only if the following are verified:

- task PNG export still works
- task SVG export produces a usable file
- project JSON export still works
- project batch export runs across multiple tasks
- export validation surfaces additional useful warnings
- build and tests continue to pass after architectural extraction
- README includes real media assets or a clearly improved media integration path
- in-app onboarding helps a new user understand the first workflow steps

## Success Criteria

This phase succeeds when:
- exported outputs are more dependable and more scalable to multi-task projects
- the codebase is less dependent on a single oversized application shell
- the repository and first-use product experience become easier to understand without explanation

## Non-Goals

This phase should still avoid:
- cloud collaboration
- user accounts
- multi-user project sync
- full publishing-grade SVG fidelity for every complex node type
- server-side job orchestration

## Recommended Implementation Order

1. Improve export pipeline and batch export
2. Expand export validation
3. Continue decomposing state and app shell logic
4. Add onboarding and media assets

## Why This Phase Matters

The earlier phases made the project usable, reusable, and more credible.

This phase is about making the product feel more complete in the two places people judge it most quickly:
- the quality of what it exports
- the ease of understanding what it is and how it works

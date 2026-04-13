# Medical Figure Workbench Phase 3 Design

Date: 2026-04-12

## Goal

Advance Medical Figure Workbench from a reusable internal workflow tool into a stronger product-quality workbench by improving export reliability, reducing architectural pressure in the front-end, and adding real project presentation assets.

## Phase 3 Focus

Phase 1 established the core import-review-edit-export loop.

Phase 2 established a project shell with task switching and persistent project files.

Phase 3 focuses on three linked priorities:
- stronger export quality
- cleaner front-end architecture
- more complete public-facing presentation of the project

This phase is where the tool starts to feel less like a well-organized internal prototype and more like a mature internal product that is also easier to explain publicly.

## Problem Statement

The current system now supports project files and multiple figure tasks, but there are still three major weaknesses.

### 1. Export is functional but not yet strong enough

Current export supports:
- task JSON
- project JSON
- PNG canvas export

However, the export layer is still relatively thin:
- PNG export is tied to the current canvas surface
- SVG is not yet a first-class, reliable output path
- there is no strong export validation step before generating outputs

### 2. App-level orchestration remains too concentrated

Even after modularization work, `frontend/src/App.tsx` still carries too much product orchestration.

It currently still coordinates:
- project state selection
- import workflow
- review flow
- semantic tooling
- canvas state
- export flow

This creates long-term maintenance risk and makes future features harder to implement safely.

### 3. Presentation is still incomplete

The repository README is much better than it was, but the project still lacks:
- real screenshots
- real demo GIFs
- stronger first-glance visual explanation for outside viewers

This matters because even an internal product benefits from being understandable to collaborators, maintainers, and future contributors.

## Product Direction

Phase 3 should treat export as the main value path, and architecture as the stabilizing layer underneath it.

The presentation layer should be improved after export and structural work are stable enough to produce media worth showing.

Recommended implementation sequence:

1. Export quality and export validation
2. App-level architectural decomposition
3. README media and presentation polish

## Export System Design

Phase 3 should turn export into a more explicit subsystem rather than a few output buttons.

### Export levels

The system should expose three export scopes clearly.

#### Task-level export

For the currently active figure task:
- export PNG
- export SVG
- export task JSON

#### Project-level export

For the full project:
- export project JSON file

#### Validation layer

Before export, the system should be able to warn about obvious quality issues such as:
- empty text nodes
- no imported panels
- unresolved resource placeholders
- pending or ignored review states that may mean export is incomplete
- missing task title or project title

This validation does not need to block export absolutely, but it should clearly surface likely problems.

### PNG export improvement

PNG export should be made more intentional than simply saving the visible canvas state.

Desired improvements:
- stable export naming based on task title
- task-aware export metadata
- cleaner task identity in exported file names
- clearer user feedback after export

### SVG export path

SVG does not need to be perfect in this phase, but it should move from “possible later” to “structured output path under construction.”

Recommended scope for Phase 3:
- introduce a task-level SVG export entry point
- serialize the current scene into an SVG-oriented representation
- support basic image/text/panel output, even if some advanced features still need later refinement

## Export Validation Design

Phase 3 should introduce a lightweight export validation report for the active task.

### Validation categories

- content completeness
- visual completeness
- workflow completeness

### Example checks

- zero nodes in the scene
- text nodes with empty text
- image nodes with missing assets
- tasks that were never imported into the canvas
- review states still pending when export is attempted

### UX behavior

The validation report should appear inside the export panel and help users correct issues before final export.

It should support:
- warning list
- severity categories such as notice / warning
- exporting anyway after review

## Architecture Refactor Direction

The most important structural goal in Phase 3 is not abstract purity. It is lowering the coordination burden on `App.tsx`.

### Target architectural units

#### `features/project-shell/`

Owns:
- current project
- active task selection
- project toolbar wiring
- task list wiring

#### `features/semantic-assistant/`

Owns:
- analyze prompt workflow
- reconstruction workflow
- review queue UI for planner actions

This is one of the highest-value extractions because it currently introduces a lot of orchestration complexity.

#### `features/canvas-workspace/`

Owns:
- canvas container
- zoom actions
- canvas empty state
- selected-node interaction scaffolding

#### `features/export/`

Should evolve from a button strip into a real export subsystem with:
- task export
- project export
- export validation

### Refactor principle

Do not rewrite the app. Extract purpose-built seams that reduce page-level coordination and keep behavior consistent.

## Presentation Layer Design

Phase 3 should make the repository and product more self-explanatory to humans.

### README media

Replace media placeholders with real assets.

Recommended media set:
- workbench overview screenshot
- import-review-edit-export GIF
- resource replacement screenshot

### In-app onboarding

If low effort, add a subtle first-run onboarding block or helper area that explains:
- what the product does
- the primary workflow in 3-4 steps
- where to start

This should remain lightweight and not turn the app into a marketing page.

### GitHub presentation

The repository should better communicate:
- what the project is
- who it is for
- what workflow it supports
- where the current roadmap stands

Issue templates and roadmap structure already exist; Phase 3 should align README media and presentation with the real product state.

## Verification Requirements

Phase 3 should be considered successful only if the following are verified:

- active task export works for PNG and JSON
- project export still works after export subsystem changes
- SVG export path produces usable output for at least basic task content
- export validation surfaces obvious missing-content issues
- build and tests continue to pass after module extraction
- README includes real media or a clearly updated media section aligned with reality

## Success Criteria

Phase 3 succeeds when:
- exported outputs feel more intentional and reliable
- the front-end architecture is less dependent on one oversized page component
- the repository is easier to understand and demonstrate visually

## Non-Goals for Phase 3

To keep this phase contained, it should not attempt:
- cloud storage
- collaboration
- public-user workflows
- full publication-grade SVG compositor parity
- model-based export optimization

These may matter later, but they are not necessary to complete the product-quality improvements targeted here.

## Recommended Implementation Priority

1. Build export validation and task/project export structure
2. Add the initial SVG export path
3. Extract semantic assistant and export workflow orchestration from `App.tsx`
4. Add screenshots/GIFs and update README media sections

## Why Phase 3 Matters

Phase 1 made the tool usable.

Phase 2 made it reusable.

Phase 3 makes it more credible, maintainable, and presentation-ready.

It is the point where the product starts to feel not just helpful, but dependable.

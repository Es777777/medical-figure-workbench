# Medical Figure Workbench Productization Design

Date: 2026-04-12

## Goal

Turn the current scientific figure demo into a genuinely usable internal lab tool for importing manuscript figures, splitting them into editable panels, refining them with medical assets, and exporting usable outputs with minimal training.

## Target Product

This product is not intended to be a fully public SaaS or a general-purpose drawing application.

It is intended to be a semi-productized internal lab tool for:
- graduate students preparing figures
- researchers revising mechanism diagrams or graphical abstracts
- lab members helping unify style across manuscript figures

The core promise is:

> Upload a paper figure, let the system split and interpret it, correct the result quickly, refine it in an editor, and export something usable.

## Current Problems

The current app has meaningful functionality, but it still behaves more like a technical prototype than a usable internal tool.

Main gaps:
- import and split actions are still not reliable enough in user perception
- the app lacks a strong workflow structure
- too many advanced tools compete with the primary task
- upload, OCR, split, and backend draft analysis do not yet feel like one coherent session
- the editor supports refinement, but the product does not yet support a complete “import -> review -> edit -> export” lab workflow
- state is still concentrated in a large page-level component, which makes maintenance and future growth risky

## Product Direction

Adopt a workflow-first internal tool model with five stages:

1. Import
2. Parse
3. Review
4. Edit
5. Export

This preserves the current browser editor, but reframes it as one stage inside a larger figure-processing workflow.

The product should optimize for:
- low onboarding friction
- visible progress and recoverability
- explicit user correction paths when automatic analysis is imperfect
- repeatable manuscript-figure handling for internal teams

## Core User Journey

### Stage 1: Import

The user uploads a source figure and immediately sees:
- source preview
- file metadata
- import mode options
- current processing status

Import modes must not rely solely on automatic splitting.

Required modes:
- automatic detection
- single-image mode
- horizontal split
- vertical split
- grid split

This is essential because many manuscript figures do not have reliable whitespace boundaries.

### Stage 2: Parse

The system analyzes the source figure and generates:
- panel candidates
- OCR text candidates
- backend draft structure
- recommended prompt and semantic hints

This stage must make progress visible. Users should always know whether the app is:
- loading image
- splitting panels
- running OCR
- querying backend draft analysis

### Stage 3: Review

Before entering the main editor, users should be able to review and adjust what the system found.

Each panel should support:
- keep
- ignore
- import individually
- preview/focus
- quick resource replacement suggestion

This review step is critical to internal-tool usability because the tool does not need to be perfect if it is easy to correct.

### Stage 4: Edit

Once the user confirms the result, the editable scene becomes the main workspace.

The canvas must support:
- node repositioning and resizing
- text editing
- panel-level image replacement
- arrow/relation cleanup
- medically relevant asset replacement

At this stage, the canvas is the primary workspace, but it should still remain connected to the import session and split results.

### Stage 5: Export

The user must be able to leave the tool with usable output.

Minimum export outputs:
- PNG
- scene JSON

Secondary export target:
- SVG

The export stage should also support project recovery mechanisms such as save/load of session state.

## Information Architecture

The interface should be reorganized around clear workflow responsibility.

### Top workflow strip

The main workflow strip should expose the most important actions in sequence:
- Upload image
- Parse and split
- Review/import
- Analyze semantics
- Export

These actions should show lightweight state feedback, not just buttons.

### Left column: import and parse session

The left column should own the import session.

It should contain:
- source image preview
- import mode controls
- processing state
- split panel review list
- OCR and draft-analysis summaries

This area answers: what did the system ingest, and what did it find?

### Center column: editing workspace

The center column should be a proper editing space, visually dominant and clearly connected to the reviewed import.

It should contain:
- canvas workspace
- canvas empty state before import
- selected-import linkage when reviewing panel results

This area answers: what am I editing now?

### Right column: refinement tools

The right column should contain refinement and enhancement, not initial discovery.

It should contain:
- node properties
- recommended resources for current selection
- searchable resource browser
- advanced semantic and reconstruction tools in lower-priority containers

This area answers: how do I improve the current scene?

## Product Modules

To make this project maintainable, responsibilities must be separated into focused modules.

### ImportWorkbench

Responsible for:
- file upload
- import mode selection
- source preview
- import session lifecycle

### SplitReviewPanel

Responsible for:
- showing panel candidates
- showing OCR snippets
- showing backend draft status
- panel-level keep/ignore/import actions

### CanvasWorkspace

Responsible for:
- main canvas rendering
- selection state
- viewport and zoom
- empty-state guidance

### ResourceBrowser

Responsible for:
- recommended assets
- category filters
- search
- quick replacement actions

### SemanticAssistant

Responsible for:
- prompt planning
- semantic analysis results
- reconstruction suggestions

This module should be supportive, not primary.

### ExportCenter

Responsible for:
- export actions
- output format choices
- project save/load affordances

### ProjectStateStore

Responsible for:
- import session state
- editable scene state
- draft-analysis state
- save/load serialization boundary

## Required Product-Level Capabilities

The following items are mandatory for this to be considered a usable internal lab tool.

### 1. Visible status and error reporting

Every long-running step must have visible feedback.

Minimum tracked states:
- uploading
- parsing
- OCR in progress
- backend draft in progress
- import complete
- export in progress
- error state with readable message

No action should appear to “do nothing”.

### 2. Manual correction paths

Users must be able to recover from imperfect automation.

Required correction paths:
- choose a split mode manually
- ignore false positive panels
- import only selected panels
- swap auto-selected resources
- rewrite OCR-derived text manually

### 3. Project recovery

At minimum, the tool must support saving and reloading a working session.

Minimum recovery target:
- save scene JSON and session metadata locally
- reopen a saved session later

This matters more for internal usability than additional AI features.

### 4. Stable export

Users must be able to get a reproducible result out of the tool.

Required first-class outputs:
- PNG export
- scene JSON export

Secondary output:
- SVG export when reliable

## De-prioritized or Secondary Capabilities

To keep the project focused, some capabilities should remain secondary during productization.

### Advanced semantic assistance

Prompt planner and reconstruction are useful, but should not dominate the primary workflow.
They should help refine, not block import and editing.

### Fully automatic intelligence

The product does not need perfect automatic panel detection or OCR to be useful internally.
It needs reliable fallback paths and clear correction tools.

### General-purpose design-tool ambitions

This should not drift into a Figma-like application.
The product is a figure-import and figure-refinement workbench, not a broad design platform.

## Data Flow

The product should explicitly separate import processing from editing.

### Import session model

An import session should track:
- source image metadata
- chosen import mode
- panel results
- OCR results
- backend draft results
- user keep/ignore decisions
- generated prompt suggestions

### Editable scene model

Only after review should the scene become the editable canonical structure used by the canvas.

This separation makes it easier to:
- retry parsing without corrupting the editor
- save and restore sessions
- expose review tools without entangling editor logic
- debug failures in the import pipeline

## Codebase Direction

The current codebase already contains useful foundations, but it needs structural refinement.

### Current issues

- `frontend/src/App.tsx` owns too much orchestration
- import, parse, review, edit, and resource behaviors are not yet separated enough
- product states are visible in the UI, but not yet modeled as stable workflow state

### Recommended direction

Refactor incrementally toward smaller responsibility-driven units:
- import workflow components
- review workflow components
- refinement-side components
- a shared store for import session + scene

This is not an invitation to rewrite everything. It is a targeted decomposition plan to prevent future instability.

## Testing and Verification Standards

This project becomes “usable” only when behavior is validated around the actual workflow, not just unit helpers.

Required validation targets:
- upload a figure and see clear progress
- split results appear or a clear fallback explanation appears
- import selected panels into canvas successfully
- replace a node resource successfully
- edit text and geometry successfully
- export a usable output successfully
- reload a saved project successfully once project recovery is added

## Success Criteria

This project should be considered a good usable internal tool when:
- a new lab member can complete one import-to-export workflow with minimal explanation
- upload and parse steps never feel silent or broken
- imperfect splits can be corrected quickly without leaving the app
- the editor feels like a refinement stage, not a technical demo surface
- outputs are stable enough to use in manuscript preparation workflows

## Implementation Priorities

Recommended priority order:

1. Stabilize import session UX and manual split modes
2. Add review-stage controls for panel confirmation
3. Strengthen project save/load and export
4. Decompose the front-end structure into focused modules
5. Improve semantic assistant as a secondary enhancement layer

## Non-Goals for This Productization Phase

The following are explicitly not required in this phase:
- public-user authentication
- multi-user collaboration
- billing
- production-grade cloud deployment workflows
- replacing heuristics with a large model-based vision stack

These may matter later, but they should not distract from making the internal tool genuinely usable first.

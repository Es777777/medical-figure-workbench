# Medical Figure Workbench Optimization Design

Date: 2026-04-08

## Goal

Optimize the current medical figure workbench so the primary workflow is obvious, the canvas feels like a real editing surface, panel splitting is easy to discover, and medical resources are easier to browse and apply.

## Scope

This design focuses on the existing browser-based editor and import workflow.

In scope:
- Reorganize the page around a clearer primary workflow
- Improve the canvas presentation and empty states
- Make image parsing and panel splitting easier to find and use
- Improve split-panel interaction and import affordances
- Expand and organize the medical resource library
- Preserve existing OCR, backend draft analysis, semantic planning, and reconstruction capabilities while reducing visual clutter

Out of scope:
- Replacing the heuristic segmentation pipeline with a model-based system
- Replacing OCR with a new engine
- Rebuilding the editor architecture from scratch
- Adding persistence, authentication, or collaboration

## User Problems

The current interface works, but the main actions are not discoverable enough.

- Users do not immediately see where to start the import flow
- The split-panel feature exists but is not visually framed as the main action
- The canvas looks functional but not like a central, confident work surface
- Resource browsing is richer than before, but still feels like a flat wall of assets instead of a guided figure-building system
- Advanced tools such as prompt planning and reconstruction compete with first-run import actions for attention

## Product Direction

Adopt a paper-figure workbench layout with a strong import-first workflow:

1. Upload source figure
2. Parse and split figure
3. Auto-import analyzed scene
4. Refine with semantic planning, properties, and resources

This keeps the page friendly for first-time use while preserving a productive editing loop for repeated use.

## Information Architecture

### Top workflow bar

Create a visible primary workflow strip for the four key actions:
- Upload image
- Parse and split figure
- Auto-import analyzed scene
- Analyze semantics

Each action should show lightweight state feedback nearby, such as uploaded, split count detected, imported, or semantic plan ready.

### Left column: import and analysis

The left sidebar should become the import cockpit, ordered by user intent rather than internal subsystem names.

Sections:
- Source figure and context notes
- Import workflow helper card
- Split results panel list
- OCR text and recommended prompt summary

This column should answer: what was uploaded, what was detected, and what can be imported next.

### Center column: main canvas workspace

The center area remains the main editor surface, but should feel more intentional.

Changes:
- Stronger paper-on-desk visual treatment
- Subtle grid background behind the canvas, not on the canvas itself
- More confident frame, spacing, and shadow
- A helpful empty state when no import has happened yet
- Canvas-level quick access to parse-and-split action

This column should answer: what am I editing right now?

### Right column: properties and resources

The right sidebar should prioritize node properties first, then guided resource replacement.

Sections:
- Selected node properties
- Recommended resources for current node
- Searchable and filterable resource library
- Secondary advanced tools if room permits

This column should answer: how do I refine what is already on the canvas?

## Split-Panel Experience

The panel splitting feature needs to become explicit and actionable.

### Split result cards

Each detected panel card should show:
- Panel preview image
- Panel label
- OCR snippet
- Semantic hint chips
- Confidence
- Actions: preview, import only this panel, replace with resource

### Import behavior

Support three import paths:
- Auto-import all analyzed content
- Import all split panels without backend draft preference
- Import a single selected panel

Default behavior should prefer backend drafts when available, then supplement with front-end split and OCR metadata.

### Canvas linkage

Selecting a split result should highlight the matching imported node when one exists.
If it has not yet been imported, the system should still visually indicate which panel the user is acting on.

## Resource System

The resource library should feel curated and task-oriented.

### Resource groups

Organize internal assets into categories that match common medical figure tasks:
- Organs
- Cells
- Signals and pathways
- Structures and containers
- Injury and outcomes
- Interventions

### Resource discovery

Add:
- Search input
- Category filter chips or tabs
- Recommended-for-selection strip based on OCR text, semantic hints, and node type

### Resource application rules

- When the current node is an imported image region, show the most relevant assets first
- When auto-import already applied a recommended asset, allow users to quickly switch back to the original extracted panel
- Keep external resource links available, but visually secondary to built-in asset application

## Advanced Tools Placement

Prompt planning and reconstruction remain valuable, but should no longer distract from first-run importing.

Design rule:
- Keep them available
- Reduce their visual priority compared to import, split results, and resource replacement
- Consider collapsible sections or lower placement in the sidebars

## Error Handling and States

The import workflow should degrade gracefully.

- If OCR fails, still show split panels and allow manual import
- If backend draft analysis is unavailable, clearly state that browser-local analysis is being used
- If no panels are found, fall back to single-image import mode
- If semantic analysis has not run yet, the UI should still feel complete and not appear broken

## Accessibility and Responsiveness

- Keep action labels explicit rather than icon-only for the main workflow
- Preserve keyboard-focus visibility on buttons and cards
- Keep desktop-first layout, but ensure narrower widths still expose the parse/split workflow without horizontal confusion
- Avoid hiding the main workflow behind collapsed navigation on common laptop sizes

## Implementation Structure

The work should stay aligned with the existing codebase.

Planned file focus:
- `frontend/src/App.tsx`: layout reorganization, workflow strip, split results actions, advanced tool placement
- `frontend/src/styles.css`: canvas treatment, workflow layout, resource filters, split result UI, empty states
- `frontend/src/copy.ts`: updated labels, hints, and workflow text
- `frontend/src/element-library.ts`: richer metadata and category coverage for resource filtering
- `frontend/src/figure-workbench.ts`: support per-panel import actions, selection linkage, and recommendation helpers

## Verification

Minimum verification after implementation:
- `npm run build`
- Manual check of upload -> parse/split -> auto-import -> semantic analysis flow
- Manual check that resource discovery is easier for a newly selected imported node
- Manual check that the canvas feels visually centered and not boxed awkwardly

## Success Criteria

The optimization is successful when:
- A first-time user can find parse-and-split immediately without searching side panels
- The canvas feels like the main workspace rather than an awkward placeholder frame
- Split results are visible, understandable, and directly actionable
- Medical resources feel richer and easier to apply
- The page keeps advanced features without overwhelming the primary workflow

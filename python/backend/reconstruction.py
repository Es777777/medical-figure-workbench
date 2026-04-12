from __future__ import annotations

from typing import Any

from .models import PlannerActionModel, PlannerTargetRefModel, ReconstructFigureResponseModel, ReconstructionIssueModel
from .prompt_analysis import analyze_prompt


def _extract_scene_labels(scene: dict[str, Any]) -> set[str]:
    labels: set[str] = set()
    for node in scene.get("nodes", []):
        name = node.get("name")
        if isinstance(name, str) and name.strip():
            labels.add(name.strip().lower())
        text = node.get("text")
        if isinstance(text, str) and text.strip():
            labels.add(text.strip().lower())
    return labels


def reconstruct_figure(request_id: str, prompt: str, scene: dict[str, Any], document_id: str | None = None, preferred_language: str | None = None, problem_notes: str | None = None) -> ReconstructFigureResponseModel:
    analysis = analyze_prompt(request_id=request_id, prompt=prompt, preferred_language=preferred_language, document_id=document_id)
    scene_labels = _extract_scene_labels(scene)
    issues: list[ReconstructionIssueModel] = []
    actions: list[PlannerActionModel] = []

    for entity in analysis.entities:
        if entity.label.lower() not in scene_labels:
            issues.append(
                ReconstructionIssueModel(
                    code="missing_node",
                    severity="warning",
                    message=f"Missing entity in current scene: {entity.label}",
                    entityId=entity.id,
                    targetRefs=[PlannerTargetRefModel(kind="entity", id=entity.id, label=entity.label)],
                )
            )
            actions.append(
                PlannerActionModel(
                    id=f"rebuild_entity_{entity.id}",
                    bucket="applyable",
                    operation="create_node",
                    label=f"Add missing node {entity.label}",
                    reason="The current scene is missing an entity that appears in the intended structure.",
                    expectedVisualResult=f"Create a new editable node for {entity.label}.",
                    confidence=entity.confidence or 0.66,
                    targetRefs=[PlannerTargetRefModel(kind="entity", id=entity.id, label=entity.label)],
                )
            )

    existing_arrow_semantics = {
        str(node.get("semantics"))
        for node in scene.get("nodes", [])
        if isinstance(node, dict) and node.get("type") == "arrow"
    }
    for relation in analysis.relations:
        if relation.semantics not in existing_arrow_semantics:
            issues.append(
                ReconstructionIssueModel(
                    code="missing_relation",
                    severity="warning",
                    message=f"Missing relation semantics in scene: {relation.semantics}",
                    relationId=relation.id,
                    targetRefs=[
                        PlannerTargetRefModel(kind="relation", id=relation.id, label=relation.semantics),
                        PlannerTargetRefModel(kind="entity", id=relation.sourceId, label=relation.sourceId),
                        PlannerTargetRefModel(kind="entity", id=relation.targetId, label=relation.targetId),
                    ],
                )
            )
            actions.append(
                PlannerActionModel(
                    id=f"rebuild_relation_{relation.id}",
                    bucket="applyable",
                    operation="create_relation",
                    label=f"Restore {relation.semantics} relation",
                    reason="The intended relation is not represented in the current scene.",
                    expectedVisualResult=f"Add a {relation.semantics} arrow between the related elements.",
                    confidence=relation.confidence or 0.64,
                    targetRefs=[
                        PlannerTargetRefModel(kind="relation", id=relation.id, label=relation.semantics),
                        PlannerTargetRefModel(kind="entity", id=relation.sourceId, label=relation.sourceId),
                        PlannerTargetRefModel(kind="entity", id=relation.targetId, label=relation.targetId),
                    ],
                )
            )

    for node in scene.get("nodes", []):
        if not isinstance(node, dict) or node.get("type") != "image":
            continue
        raw_asset = node.get("asset")
        if not isinstance(raw_asset, dict):
            continue
        uri_value = raw_asset.get("uri")
        uri = uri_value if isinstance(uri_value, str) else ""
        if uri.startswith("data:image"):
            issues.append(
                ReconstructionIssueModel(
                    code="weak_asset_match",
                    severity="info",
                    message=f"Image node still uses inline placeholder data: {node.get('name', node.get('id', 'unknown'))}",
                    targetRefs=[PlannerTargetRefModel(kind="node", id=str(node.get("id", "unknown")), label=str(node.get("name", node.get("id", "unknown"))))],
                )
            )
            actions.append(
                PlannerActionModel(
                    id=f"replace_asset_{node.get('id', 'unknown')}",
                    bucket="needs_confirmation",
                    operation="replace_asset",
                    label=f"Replace weak asset for {node.get('name', node.get('id', 'unknown'))}",
                    reason="The node still uses a generic placeholder asset rather than a stronger library match.",
                    expectedVisualResult="Swap the placeholder for a more specific scientific icon.",
                    confidence=0.58,
                    targetRefs=[PlannerTargetRefModel(kind="node", id=str(node.get("id", "unknown")), label=str(node.get("name", node.get("id", "unknown"))))],
                )
            )

    warnings = list(analysis.warnings)
    if problem_notes:
        warnings.append(f"Problem notes considered: {problem_notes}")

    return ReconstructFigureResponseModel(
        requestId=request_id,
        documentId=document_id,
        mode=analysis.mode,
        correctedSummary=f"Prepared a corrected structure with {len(analysis.entities)} entities and {len(issues)} flagged issues.",
        entities=analysis.entities,
        relations=analysis.relations,
        issues=issues,
        actions=actions,
        warnings=warnings,
    )

from __future__ import annotations

import re
from typing import Iterable, Literal

from pydantic import BaseModel, Field

from .llm_client import request_structured_output
from .models import AnalyzePromptResponseModel, PlannerActionModel, PlannerTargetRefModel, PromptEntityDraftModel, PromptLayoutHintsModel, PromptRelationDraftModel


RoleLiteral = Literal["entity", "process", "outcome", "context", "annotation", "panel"]
SemanticLiteral = Literal["promote", "inhibit", "associate", "contains", "annotates", "flows_to", "unknown"]


LIBRARY_INDEX: list[tuple[str, list[str]]] = [
    ("kidney-clean", ["kidney", "renal", "aki", "nephro", "肾"]),
    ("mitochondria", ["mitochondria", "mitochondrial", "线粒体"]),
    ("bacteria", ["bacteria", "bacterial", "infection", "sepsis", "细菌", "感染"]),
    ("immune-cell", ["immune", "macrophage", "neutrophil", "免疫"]),
    ("inflammation", ["inflammation", "inflam", "cytokine", "炎症"]),
    ("protective-shield", ["protect", "barrier", "shield", "repair", "保护"]),
]


class PromptAnalysisPayloadModel(BaseModel):
    summary: str
    entities: list[PromptEntityDraftModel]
    relations: list[PromptRelationDraftModel]
    layoutHints: PromptLayoutHintsModel | None = None
    actions: list[PlannerActionModel] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


RELATION_PATTERNS: list[tuple[re.Pattern[str], SemanticLiteral]] = [
    (re.compile(r"(.+?)\s*(?:-\||inhibits|blocks|suppresses|reduces)\s*(.+)", re.IGNORECASE), "inhibit"),
    (re.compile(r"(.+?)\s*(?:activates|promotes|induces|enhances|triggers)\s*(.+)", re.IGNORECASE), "promote"),
    (re.compile(r"(.+?)\s*(?:contains|includes)\s*(.+)", re.IGNORECASE), "contains"),
    (re.compile(r"(.+?)\s*(?:annotates|notes)\s*(.+)", re.IGNORECASE), "annotates"),
    (re.compile(r"(.+?)\s*(?:->|→|leads to|causes|results in|flows to)\s*(.+)", re.IGNORECASE), "flows_to"),
    (re.compile(r"(.+?)\s*(?:associated with|with)\s*(.+)", re.IGNORECASE), "associate"),
]


def _normalize_label(label: str) -> str:
    return re.sub(r"\s+", " ", label).strip(" -:;,.。；，")


def _guess_role(label: str) -> RoleLiteral:
    lowered = label.lower()
    if any(token in lowered for token in ["injury", "damage", "repair", "outcome", "死亡", "损伤", "修复"]):
        return "outcome"
    if any(token in lowered for token in ["activation", "signaling", "response", "inflammation", "炎症", "激活"]):
        return "process"
    if any(token in lowered for token in ["sepsis", "infection", "context", "感染", "脓毒症"]):
        return "context"
    return "entity"


def _match_library_item(label: str) -> str | None:
    lowered = label.lower()
    for item_id, keywords in LIBRARY_INDEX:
        if any(keyword in lowered for keyword in keywords):
            return item_id
    return None


def _dedupe_ordered(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        normalized = _normalize_label(value)
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def _build_entity(label: str, index: int) -> PromptEntityDraftModel:
    return PromptEntityDraftModel(
        id=f"ent_{index + 1}",
        label=label,
        role=_guess_role(label),
        libraryItemId=_match_library_item(label),
        confidence=0.72,
    )


def _fallback_parse(prompt: str) -> PromptAnalysisPayloadModel:
    relations: list[PromptRelationDraftModel] = []
    entity_labels: list[str] = []

    for raw_clause in re.split(r"\r?\n|[；;。.]", prompt):
        clause = _normalize_label(raw_clause)
        if not clause:
            continue
        matched = False
        for pattern, semantics in RELATION_PATTERNS:
            match = pattern.fullmatch(clause)
            if not match:
                continue
            left = _normalize_label(match.group(1))
            right = _normalize_label(match.group(2))
            entity_labels.extend([left, right])
            matched = True
            break
        if not matched:
            entity_labels.append(clause)

    entity_labels = _dedupe_ordered(entity_labels)
    if len(entity_labels) < 2:
        entity_labels = _dedupe_ordered(re.split(r"\r?\n|->|→|,|，|;|；", prompt))

    entities = [_build_entity(label, index) for index, label in enumerate(entity_labels[:6])]
    entity_id_by_label = {entity.label.lower(): entity.id for entity in entities}

    relation_index = 0
    for raw_clause in re.split(r"\r?\n|[；;。.]", prompt):
        clause = _normalize_label(raw_clause)
        if not clause:
            continue
        for pattern, semantics in RELATION_PATTERNS:
            match = pattern.fullmatch(clause)
            if not match:
                continue
            left = _normalize_label(match.group(1)).lower()
            right = _normalize_label(match.group(2)).lower()
            if left in entity_id_by_label and right in entity_id_by_label:
                relation_index += 1
                relations.append(
                    PromptRelationDraftModel(
                        id=f"rel_{relation_index}",
                        sourceId=entity_id_by_label[left],
                        targetId=entity_id_by_label[right],
                        semantics=semantics,
                        confidence=0.68,
                    )
                )
            break

    if not relations and len(entities) > 1:
        for index in range(len(entities) - 1):
            relations.append(
                PromptRelationDraftModel(
                    id=f"rel_{index + 1}",
                    sourceId=entities[index].id,
                    targetId=entities[index + 1].id,
                    semantics="flows_to",
                    confidence=0.55,
                )
            )

    actions: list[PlannerActionModel] = []
    for entity in entities:
        actions.append(
            PlannerActionModel(
                id=f"action_entity_{entity.id}",
                bucket="applyable",
                operation="create_node",
                label=f"Create {entity.label}",
                reason="The planner identified this entity as part of the figure structure.",
                expectedVisualResult=f"Add an editable node for {entity.label}.",
                confidence=entity.confidence or 0.6,
                targetRefs=[PlannerTargetRefModel(kind="entity", id=entity.id, label=entity.label)],
            )
        )

    for relation in relations:
        actions.append(
            PlannerActionModel(
                id=f"action_relation_{relation.id}",
                bucket="applyable" if relation.confidence and relation.confidence >= 0.6 else "needs_confirmation",
                operation="create_relation",
                label=f"Add {relation.semantics} relation",
                reason="The planner found a directed relation in the prompt.",
                expectedVisualResult=f"Create a {relation.semantics} arrow between the planned entities.",
                confidence=relation.confidence or 0.55,
                targetRefs=[
                    PlannerTargetRefModel(kind="relation", id=relation.id, label=relation.semantics),
                    PlannerTargetRefModel(kind="entity", id=relation.sourceId, label=relation.sourceId),
                    PlannerTargetRefModel(kind="entity", id=relation.targetId, label=relation.targetId),
                ],
            )
        )

    if len(entities) <= 1:
        actions.append(
            PlannerActionModel(
                id="action_clarify_scope",
                bucket="blocked",
                operation="clarify",
                label="Clarify missing structure",
                reason="The prompt does not contain enough distinct figure units.",
                expectedVisualResult="Ask for one more process or outcome to anchor the layout.",
                confidence=0.25,
                targetRefs=[],
                blockingAmbiguity="Need at least two distinct entities or processes to form a useful scientific figure.",
            )
        )

    summary = f"Structured {len(entities)} entities and {len(relations)} relations from the prompt."
    return PromptAnalysisPayloadModel(
        summary=summary,
        entities=entities,
        relations=relations,
        layoutHints=PromptLayoutHintsModel(readingOrder="left-to-right", emphasizeIds=[entities[-1].id] if entities else None),
        actions=actions,
        warnings=[] if relations else ["Used sequential fallback because explicit relations were unclear."],
    )


def analyze_prompt(request_id: str, prompt: str, preferred_language: str | None = None, document_id: str | None = None) -> AnalyzePromptResponseModel:
    system_prompt = (
        "You are a scientific figure planner. Convert the user's prompt into a small typed JSON plan for an editable scene graph. "
        "Return only concise scientific entities, process nodes, and directed relations. Do not render SVG. Keep the output bounded and editable."
    )
    user_prompt = f"Preferred language: {preferred_language or 'zh-CN'}\nPrompt: {prompt}"

    llm_result = request_structured_output("prompt_analysis", PromptAnalysisPayloadModel, system_prompt, user_prompt)
    if llm_result.mode == "live" and llm_result.payload is not None:
        payload = llm_result.payload
        assert isinstance(payload, PromptAnalysisPayloadModel)
        return AnalyzePromptResponseModel(
            requestId=request_id,
            documentId=document_id,
            mode="live",
            summary=payload.summary,
            entities=payload.entities,
            relations=payload.relations,
            layoutHints=payload.layoutHints,
            actions=payload.actions,
            warnings=payload.warnings + llm_result.warnings,
        )

    fallback = _fallback_parse(prompt)
    return AnalyzePromptResponseModel(
        requestId=request_id,
        documentId=document_id,
        mode="fallback",
        summary=fallback.summary,
        entities=fallback.entities,
        relations=fallback.relations,
        layoutHints=fallback.layoutHints,
        actions=fallback.actions,
        warnings=fallback.warnings + llm_result.warnings,
    )

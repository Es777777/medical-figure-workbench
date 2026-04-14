from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class ValidationIssueModel(BaseModel):
    path: str
    message: str
    code: str | None = None


class ErrorPayloadModel(BaseModel):
    code: str
    message: str
    issues: list[ValidationIssueModel] | None = None


class ApiErrorModel(BaseModel):
    error: ErrorPayloadModel


class NormalizeAssetRequestModel(BaseModel):
    requestId: str = Field(min_length=1)
    sourcePath: str = Field(min_length=1)
    outputDir: str = Field(min_length=1)
    outputName: str | None = None
    frameIndex: int = Field(default=0, ge=0)
    preferAlpha: bool = True


class NormalizeAssetSourceModel(BaseModel):
    originalUri: str
    normalizedUri: str
    originalDetectedFormat: str
    normalizedMimeType: Literal["image/png"]
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class NormalizeAssetResponseModel(BaseModel):
    requestId: str
    documentId: str
    source: NormalizeAssetSourceModel
    warnings: list[str]


class AnalyzeAssetRequestModel(BaseModel):
    requestId: str = Field(min_length=1)
    documentId: str = Field(min_length=1)
    normalizedUri: str = Field(min_length=1)
    runOcr: bool
    detectRegions: bool
    detectConnectors: bool = False


class RectModel(BaseModel):
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class DraftNodeModel(BaseModel):
    id: str
    type: Literal["image", "text", "arrow", "panel"]
    bbox: RectModel
    confidence: float | None = None
    text: str | None = None


class AnalyzeAssetResponseModel(BaseModel):
    requestId: str
    documentId: str
    draftNodes: list[DraftNodeModel]
    warnings: list[str]


class TransformModel(BaseModel):
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    rotation: float | None = None
    scaleX: float | None = None
    scaleY: float | None = None
    opacity: float | None = None


class PointModel(BaseModel):
    x: float
    y: float


class AssetRefModel(BaseModel):
    assetId: str
    uri: str
    mimeType: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    sourceKind: Literal["upload", "normalized", "generated", "extracted"]


class SourceAssetRefModel(BaseModel):
    assetId: str
    originalUri: str
    normalizedUri: str
    originalDetectedFormat: str
    normalizedMimeType: Literal["image/png"]
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class BaseNodeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str | None = None
    parentId: str | None = None
    zIndex: int
    transform: TransformModel
    bbox: RectModel
    createdAt: str
    updatedAt: str
    locked: bool | None = None
    hidden: bool | None = None
    tags: list[str] | None = None


class PanelNodeModel(BaseNodeModel):
    type: Literal["panel"]
    title: str | None = None
    layout: Literal["free", "row", "column"] | None = None


class ImageEditableModeModel(BaseModel):
    move: Literal[True]
    resize: Literal[True]
    crop: Literal[True]
    regenerate: Literal[True]
    replaceAsset: Literal[True]


class ImageNodeModel(BaseNodeModel):
    type: Literal["image"]
    asset: AssetRefModel
    crop: RectModel | None = None
    maskUri: str | None = None
    editableMode: ImageEditableModeModel


class TextStyleModel(BaseModel):
    fontFamily: str
    fontSize: float = Field(gt=0)
    fontWeight: int | None = None
    fontStyle: Literal["normal", "italic"] | None = None
    color: str
    align: Literal["left", "center", "right"] | None = None
    lineHeight: float | None = None
    letterSpacing: float | None = None
    strokeColor: str | None = None
    strokeWidth: float | None = None
    backgroundColor: str | None = None


class TextEditableModeModel(BaseModel):
    move: Literal[True]
    resize: Literal[True]
    editText: Literal[True]
    editStyle: Literal[True]
    regenerate: Literal[False]


class TextNodeModel(BaseNodeModel):
    type: Literal["text"]
    text: str
    style: TextStyleModel
    editableMode: TextEditableModeModel


class ArrowStyleModel(BaseModel):
    stroke: str
    strokeWidth: float = Field(gt=0)
    dashArray: list[float] | None = None
    headStart: Literal["none", "circle", "bar"] | None = None
    headEnd: Literal["none", "arrow", "tee", "circle"] | None = None


class ArrowEditableModeModel(BaseModel):
    move: Literal[True]
    reshape: Literal[True]
    editStyle: Literal[True]
    regenerate: Literal[False]


class ArrowNodeModel(BaseNodeModel):
    type: Literal["arrow"]
    points: list[PointModel]
    semantics: Literal["promote", "inhibit", "associate", "contains", "annotates", "flows_to", "unknown"] | None = None
    sourceNodeId: str | None = None
    targetNodeId: str | None = None
    relationLabel: str | None = None
    style: ArrowStyleModel
    editableMode: ArrowEditableModeModel


class ShapeStyleModel(BaseModel):
    fill: str
    stroke: str
    strokeWidth: float = Field(gt=0)
    dashArray: list[float] | None = None


class ShapeEditableModeModel(BaseModel):
    move: Literal[True]
    resize: Literal[True]
    editStyle: Literal[True]
    regenerate: Literal[False]


class ShapeNodeModel(BaseNodeModel):
    type: Literal["shape"]
    shape: Literal["rectangle", "ellipse", "diamond"]
    style: ShapeStyleModel
    editableMode: ShapeEditableModeModel


class GroupNodeModel(BaseNodeModel):
    type: Literal["group"]
    childIds: list[str]


SceneNodeModel = Annotated[
    PanelNodeModel | ImageNodeModel | TextNodeModel | ArrowNodeModel | ShapeNodeModel | GroupNodeModel,
    Field(discriminator="type"),
]


class CanvasModel(BaseModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    backgroundColor: str | None = None


class SceneGraphModel(BaseModel):
    id: str
    version: int = Field(ge=1)
    kind: Literal["scientific-figure"]
    canvas: CanvasModel
    source: SourceAssetRefModel
    nodes: list[SceneNodeModel]


class ComposeFigureRequestModel(BaseModel):
    requestId: str = Field(min_length=1)
    documentId: str = Field(min_length=1)
    scene: SceneGraphModel
    exportFormats: list[Literal["png", "svg", "json"]]


class ComposeFigureResponseModel(BaseModel):
    requestId: str
    documentId: str
    accepted: bool
    sceneVersion: int


class RegenerateNodeConstraintsModel(BaseModel):
    keepPosition: bool | None = None
    keepSize: bool | None = None
    preserveThemeColor: bool | None = None


class RegenerateNodeRequestModel(BaseModel):
    requestId: str = Field(min_length=1)
    documentId: str = Field(min_length=1)
    nodeId: str = Field(min_length=1)
    prompt: str = Field(min_length=1)
    feedback: str | None = None
    constraints: RegenerateNodeConstraintsModel | None = None


class RegenerateNodeVariantModel(BaseModel):
    id: str
    previewUri: str
    asset: AssetRefModel


class RegenerateNodeResponseModel(BaseModel):
    requestId: str
    documentId: str
    nodeId: str
    variants: list[RegenerateNodeVariantModel]


class PromptEntityDraftModel(BaseModel):
    id: str
    label: str
    role: Literal["entity", "process", "outcome", "context", "annotation", "panel"]
    libraryItemId: str | None = None
    confidence: float | None = None
    notes: str | None = None


class PromptRelationDraftModel(BaseModel):
    id: str
    sourceId: str
    targetId: str
    semantics: Literal["promote", "inhibit", "associate", "contains", "annotates", "flows_to", "unknown"]
    label: str | None = None
    confidence: float | None = None


class PromptLayoutHintsModel(BaseModel):
    readingOrder: Literal["left-to-right", "top-to-bottom"] | None = None
    groups: list[list[str]] | None = None
    emphasizeIds: list[str] | None = None


class PlannerTargetRefModel(BaseModel):
    kind: Literal["entity", "relation", "node", "edge", "region"]
    id: str
    label: str


class PlannerActionModel(BaseModel):
    id: str
    bucket: Literal["applyable", "needs_confirmation", "blocked"]
    operation: Literal["create_node", "create_relation", "replace_asset", "retarget_relation", "clarify"]
    label: str
    reason: str
    expectedVisualResult: str
    confidence: float = Field(ge=0, le=1)
    targetRefs: list[PlannerTargetRefModel]
    blockingAmbiguity: str | None = None


class AnalyzePromptEditorContextModel(BaseModel):
    canvas: CanvasModel | None = None
    existingNodeCount: int | None = Field(default=None, ge=0)
    notes: str | None = None


class AnalyzePromptRequestModel(BaseModel):
    requestId: str = Field(min_length=1)
    documentId: str | None = None
    prompt: str = Field(min_length=1)
    preferredLanguage: Literal["en", "zh-CN"] | None = None
    editorContext: AnalyzePromptEditorContextModel | None = None


class AnalyzePromptResponseModel(BaseModel):
    requestId: str
    documentId: str | None = None
    mode: Literal["live", "fallback"]
    summary: str
    entities: list[PromptEntityDraftModel]
    relations: list[PromptRelationDraftModel]
    layoutHints: PromptLayoutHintsModel | None = None
    actions: list[PlannerActionModel]
    warnings: list[str]


class ReconstructionIssueModel(BaseModel):
    code: Literal["missing_node", "missing_relation", "wrong_semantics", "weak_asset_match"]
    severity: Literal["info", "warning", "error"]
    message: str
    entityId: str | None = None
    relationId: str | None = None
    targetRefs: list[PlannerTargetRefModel] | None = None


class ReconstructFigureRequestModel(BaseModel):
    requestId: str = Field(min_length=1)
    documentId: str | None = None
    prompt: str = Field(min_length=1)
    scene: SceneGraphModel
    problemNotes: str | None = None
    preferredLanguage: Literal["en", "zh-CN"] | None = None


class ReconstructFigureResponseModel(BaseModel):
    requestId: str
    documentId: str | None = None
    mode: Literal["live", "fallback"]
    correctedSummary: str
    entities: list[PromptEntityDraftModel]
    relations: list[PromptRelationDraftModel]
    issues: list[ReconstructionIssueModel]
    actions: list[PlannerActionModel]
    warnings: list[str]


class ExportSceneRequestModel(BaseModel):
    requestId: str = Field(min_length=1)
    documentId: str = Field(min_length=1)
    scene: SceneGraphModel
    formats: list[Literal["png", "svg", "json"]]


class ExportSceneResponseModel(BaseModel):
    requestId: str
    documentId: str
    pngUri: str | None = None
    svgUri: str | None = None
    jsonUri: str | None = None


class HealthResponseModel(BaseModel):
    status: Literal["ok"]


class ExternalResourceItemModel(BaseModel):
    id: str
    providerId: Literal["servier", "bioicons", "wikimedia", "cdc-phil"]
    providerLabel: str
    title: str
    description: str | None = None
    previewUrl: str
    sourcePageUrl: str
    assetUrl: str
    mimeType: str
    license: str | None = None
    attribution: str | None = None
    tags: list[str] = []


class ExternalResourceSearchResponseModel(BaseModel):
    query: str
    items: list[ExternalResourceItemModel]
    warnings: list[str]


class ImportExternalResourceRequestModel(BaseModel):
    requestId: str = Field(min_length=1)
    item: ExternalResourceItemModel


class ImportExternalResourceResponseModel(BaseModel):
    requestId: str
    providerId: Literal["servier", "bioicons", "wikimedia", "cdc-phil"]
    providerLabel: str
    title: str
    assetUri: str
    previewUri: str
    mimeType: str
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    sourcePageUrl: str | None = None
    license: str | None = None
    attribution: str | None = None

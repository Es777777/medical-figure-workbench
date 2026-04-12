from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .errors import BackendError, ContractViolation, DocumentNotFound, NodeNotFound
from .analyze_asset import analyze_normalized_asset
from .models import (
    AnalyzePromptRequestModel,
    AnalyzePromptResponseModel,
    AnalyzeAssetRequestModel,
    AnalyzeAssetResponseModel,
    ApiErrorModel,
    AssetRefModel,
    ComposeFigureRequestModel,
    ComposeFigureResponseModel,
    ErrorPayloadModel,
    ExportSceneRequestModel,
    ExportSceneResponseModel,
    HealthResponseModel,
    NormalizeAssetRequestModel,
    NormalizeAssetResponseModel,
    NormalizeAssetSourceModel,
    ReconstructFigureRequestModel,
    ReconstructFigureResponseModel,
    RegenerateNodeRequestModel,
    RegenerateNodeResponseModel,
    RegenerateNodeVariantModel,
    ValidationIssueModel,
)
from .prompt_analysis import analyze_prompt
from .reconstruction import reconstruct_figure
from .store import DocumentRecord, store
from ..image_normalize import NormalizationError, normalize_to_png


app = FastAPI(title="OCR SVG Builder Backend", version="0.1.0")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_PUBLIC = PROJECT_ROOT / "frontend" / "public"
GENERATED_STATIC_DIR = FRONTEND_PUBLIC / "generated"
ASSETS_STATIC_DIR = FRONTEND_PUBLIC / "assets"
LIBRARY_STATIC_DIR = FRONTEND_PUBLIC / "library"

GENERATED_STATIC_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_STATIC_DIR.mkdir(parents=True, exist_ok=True)
LIBRARY_STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/generated", StaticFiles(directory=str(GENERATED_STATIC_DIR)), name="generated")
app.mount("/assets", StaticFiles(directory=str(ASSETS_STATIC_DIR)), name="assets")
app.mount("/library", StaticFiles(directory=str(LIBRARY_STATIC_DIR)), name="library")


def _api_error_response(status_code: int, code: str, message: str, issues: list[dict[str, str]] | None = None) -> JSONResponse:
    issue_models = [ValidationIssueModel(**issue) for issue in issues] if issues else None
    payload = ApiErrorModel(error=ErrorPayloadModel(code=code, message=message, issues=issue_models))
    return JSONResponse(status_code=status_code, content=payload.model_dump(exclude_none=True))


def _path_to_uri(path: str | Path) -> str:
    candidate = Path(path)
    try:
        relative = candidate.resolve().relative_to(Path.cwd().resolve())
        return "/" + relative.as_posix()
    except ValueError:
        return "/" + candidate.name.replace("\\", "/")


def _require_document(document_id: str) -> DocumentRecord:
    record = store.get_document(document_id)
    if record is None:
        raise DocumentNotFound(document_id)
    return record


def _find_node(scene: dict, node_id: str) -> dict:
    for node in scene.get("nodes", []):
        if node.get("id") == node_id:
            return node
    raise NodeNotFound(node_id)


def _pick_variant_seeds(node_id: str, prompt: str, feedback: str | None) -> list[tuple[str, str]]:
    context = f"{node_id} {prompt} {feedback or ''}".lower()

    if "kidney" in context or "肾" in context:
        return [
            ("kidney-clean", "/library/kidney-clean.svg"),
            ("protection", "/library/protective-shield.svg"),
            ("inflammation", "/library/inflammation.svg"),
            ("variant-a", "/generated/mock-variant-1.svg"),
        ]

    if "mito" in context or "线粒体" in context:
        return [
            ("mitochondria", "/library/mitochondria.svg"),
            ("immune-cell", "/library/immune-cell.svg"),
            ("variant-a", "/generated/mock-variant-1.svg"),
            ("variant-b", "/generated/mock-variant-2.svg"),
        ]

    if "bacteria" in context or "细菌" in context or "sepsis" in context:
        return [
            ("bacteria", "/library/bacteria.svg"),
            ("inflammation", "/library/inflammation.svg"),
            ("immune-cell", "/library/immune-cell.svg"),
            ("variant-b", "/generated/mock-variant-2.svg"),
        ]

    return [
        ("variant-a", "/generated/mock-variant-1.svg"),
        ("variant-b", "/generated/mock-variant-2.svg"),
        ("immune-cell", "/library/immune-cell.svg"),
        ("protection", "/library/protective-shield.svg"),
    ]


@app.exception_handler(BackendError)
async def backend_error_handler(_: Request, exc: BackendError) -> JSONResponse:
    issues = exc.issues if exc.issues else None
    return _api_error_response(exc.status_code, exc.code, exc.message, issues)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    issues = [
        {
            "path": ".".join(str(item) for item in err["loc"]),
            "message": err["msg"],
            "code": err["type"],
        }
        for err in exc.errors()
    ]
    return _api_error_response(422, "request_validation_error", "Request validation failed", issues)


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, exc: Exception) -> JSONResponse:
    return _api_error_response(500, "internal_error", f"Unexpected server error: {exc}")


@app.get("/healthz", response_model=HealthResponseModel)
def healthz() -> HealthResponseModel:
    return HealthResponseModel(status="ok")


@app.post("/normalize-asset", response_model=NormalizeAssetResponseModel)
def normalize_asset(payload: NormalizeAssetRequestModel) -> NormalizeAssetResponseModel:
    try:
        meta = normalize_to_png(
            src=payload.sourcePath,
            out_dir=payload.outputDir,
            output_name=payload.outputName,
            frame_index=payload.frameIndex,
            prefer_alpha=payload.preferAlpha,
        )
    except NormalizationError as exc:
        raise ContractViolation(str(exc)) from exc

    document_id = f"doc_{uuid4().hex[:12]}"
    source = NormalizeAssetSourceModel(
        originalUri=_path_to_uri(payload.sourcePath),
        normalizedUri=_path_to_uri(meta.output_path),
        originalDetectedFormat=meta.detected_format,
        normalizedMimeType="image/png",
        width=meta.width,
        height=meta.height,
    )
    store.save_document(
        DocumentRecord(
            document_id=document_id,
            source=source.model_dump(),
            normalize_request=payload.model_dump(),
            normalize_meta=asdict(meta),
        )
    )
    return NormalizeAssetResponseModel(
        requestId=payload.requestId,
        documentId=document_id,
        source=source,
        warnings=meta.warnings,
    )


@app.post("/analyze-asset", response_model=AnalyzeAssetResponseModel)
def analyze_asset(payload: AnalyzeAssetRequestModel) -> AnalyzeAssetResponseModel:
    record = _require_document(payload.documentId)
    if payload.normalizedUri != record.source["normalizedUri"]:
        raise ContractViolation("normalizedUri does not match the stored normalized asset for this document")

    normalized_path = Path(record.normalize_meta.get("output_path", ""))
    if not normalized_path.exists() and payload.normalizedUri.startswith("/"):
        normalized_path = PROJECT_ROOT / payload.normalizedUri.lstrip("/")
    if not normalized_path.exists():
        raise ContractViolation(f"Normalized asset not found on disk: {normalized_path}")

    draft_nodes, warnings = analyze_normalized_asset(
        normalized_path=normalized_path,
        run_ocr=payload.runOcr,
        detect_regions=payload.detectRegions,
        detect_connectors=payload.detectConnectors,
    )
    response = AnalyzeAssetResponseModel(
        requestId=payload.requestId,
        documentId=payload.documentId,
        draftNodes=draft_nodes,
        warnings=warnings,
    )
    record.analysis = response.model_dump()
    return response


@app.post("/analyze-prompt", response_model=AnalyzePromptResponseModel)
def analyze_prompt_route(payload: AnalyzePromptRequestModel) -> AnalyzePromptResponseModel:
    response = analyze_prompt(
        request_id=payload.requestId,
        prompt=payload.prompt,
        preferred_language=payload.preferredLanguage,
        document_id=payload.documentId,
    )
    if payload.documentId:
        record = store.get_document(payload.documentId)
        if record is not None:
            record.prompt_analysis = response.model_dump()
    return response


@app.post("/reconstruct-figure", response_model=ReconstructFigureResponseModel)
def reconstruct_figure_route(payload: ReconstructFigureRequestModel) -> ReconstructFigureResponseModel:
    response = reconstruct_figure(
        request_id=payload.requestId,
        prompt=payload.prompt,
        scene=payload.scene.model_dump(),
        document_id=payload.documentId,
        preferred_language=payload.preferredLanguage,
        problem_notes=payload.problemNotes,
    )
    if payload.documentId:
        record = store.get_document(payload.documentId)
        if record is not None:
            record.reconstruction = response.model_dump()
    return response


@app.post("/compose-figure", response_model=ComposeFigureResponseModel)
def compose_figure(payload: ComposeFigureRequestModel) -> ComposeFigureResponseModel:
    record = _require_document(payload.documentId)
    if payload.scene.source.normalizedMimeType != "image/png":
        raise ContractViolation("scene.source.normalizedMimeType must be image/png")
    if payload.scene.source.normalizedUri != record.source["normalizedUri"]:
        raise ContractViolation("scene.source.normalizedUri must match the stored normalized asset for this document")

    record.scene = payload.scene.model_dump()
    return ComposeFigureResponseModel(
        requestId=payload.requestId,
        documentId=payload.documentId,
        accepted=True,
        sceneVersion=payload.scene.version,
    )


@app.post("/regenerate-node", response_model=RegenerateNodeResponseModel)
def regenerate_node(payload: RegenerateNodeRequestModel) -> RegenerateNodeResponseModel:
    record = _require_document(payload.documentId)
    if record.scene is None:
        raise ContractViolation("No composed scene is stored for this document yet")

    node = _find_node(record.scene, payload.nodeId)
    if node.get("type") != "image":
        raise ContractViolation("Only image nodes support regenerate-node in this scaffold")

    variants = [
        RegenerateNodeVariantModel(
            id=f"var_{payload.nodeId}_{seed_id}_{index + 1}",
            previewUri=uri,
            asset=AssetRefModel(
                assetId=f"asset_{payload.nodeId}_{seed_id}_{index + 1}",
                uri=uri,
                mimeType="image/svg+xml",
                width=320,
                height=220,
                sourceKind="generated",
            ),
        )
        for index, (seed_id, uri) in enumerate(_pick_variant_seeds(payload.nodeId, payload.prompt, payload.feedback))
    ]
    return RegenerateNodeResponseModel(
        requestId=payload.requestId,
        documentId=payload.documentId,
        nodeId=payload.nodeId,
        variants=variants,
    )


@app.post("/export-scene", response_model=ExportSceneResponseModel, response_model_exclude_none=True)
def export_scene(payload: ExportSceneRequestModel) -> ExportSceneResponseModel:
    record = _require_document(payload.documentId)
    if payload.scene.source.normalizedUri != record.source["normalizedUri"]:
        raise ContractViolation("export scene source does not match the stored document source")

    response = ExportSceneResponseModel(
        requestId=payload.requestId,
        documentId=payload.documentId,
        pngUri=f"/exports/{payload.documentId}.png" if "png" in payload.formats else None,
        svgUri=f"/exports/{payload.documentId}.svg" if "svg" in payload.formats else None,
        jsonUri=f"/exports/{payload.documentId}.json" if "json" in payload.formats else None,
    )
    record.exports = response.model_dump(exclude_none=True)
    return response

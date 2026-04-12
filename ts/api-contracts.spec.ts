import type {
  AnalyzePromptRequest,
  AnalyzePromptResponse,
  ComposeFigureRequest,
  NormalizeAssetResponse,
  ReconstructFigureRequest,
  ReconstructFigureResponse,
  RegenerateNodeRequest,
} from "./api-contracts";

const normalizeResponse: NormalizeAssetResponse = {
  requestId: "req_001",
  documentId: "doc_001",
  source: {
    originalUri: "/uploads/original/source.tif",
    normalizedUri: "/uploads/normalized/source.png",
    originalDetectedFormat: "TIFF",
    normalizedMimeType: "image/png",
    width: 1270,
    height: 852,
  },
  warnings: [],
};

void normalizeResponse;

const composeRequest: ComposeFigureRequest = {
  requestId: "req_002",
  documentId: "doc_001",
  scene: {
    id: "scene_001",
    version: 1,
    kind: "scientific-figure",
    canvas: { width: 100, height: 100 },
    source: {
      assetId: "asset_001",
      originalUri: "/uploads/original/source.tif",
      normalizedUri: "/uploads/normalized/source.png",
      originalDetectedFormat: "TIFF",
      normalizedMimeType: "image/png",
      width: 100,
      height: 100,
    },
    nodes: [],
  },
  exportFormats: ["png", "json"],
};

void composeRequest;

const regenerateRequest: RegenerateNodeRequest = {
  requestId: "req_003",
  documentId: "doc_001",
  nodeId: "node_001",
  prompt: "simplify this kidney icon, flat scientific style",
  feedback: "上一版太复杂",
  constraints: {
    keepPosition: true,
    keepSize: true,
  },
};

void regenerateRequest;

const analyzePromptRequest: AnalyzePromptRequest = {
  requestId: "req_prompt_001",
  prompt: "Sepsis triggers inflammation and leads to kidney injury",
  preferredLanguage: "en",
  editorContext: {
    canvas: { width: 1270, height: 852 },
    existingNodeCount: 4,
  },
};

void analyzePromptRequest;

const analyzePromptResponse: AnalyzePromptResponse = {
  requestId: "req_prompt_001",
  mode: "fallback",
  summary: "A simple inflammatory progression.",
  entities: [
    { id: "ent_1", label: "Sepsis", role: "context", confidence: 0.8 },
    { id: "ent_2", label: "Inflammation", role: "process", confidence: 0.82 },
  ],
  relations: [
    { id: "rel_1", sourceId: "ent_1", targetId: "ent_2", semantics: "flows_to", confidence: 0.78 },
  ],
  layoutHints: { readingOrder: "left-to-right" },
  warnings: [],
};

void analyzePromptResponse;

const reconstructFigureRequest: ReconstructFigureRequest = {
  requestId: "req_reconstruct_001",
  documentId: "doc_001",
  prompt: "Repair a flawed sepsis mechanism figure",
  scene: composeRequest.scene,
  problemNotes: "Missing inhibitory arrow and weak kidney icon.",
  preferredLanguage: "en",
};

void reconstructFigureRequest;

const reconstructFigureResponse: ReconstructFigureResponse = {
  requestId: "req_reconstruct_001",
  documentId: "doc_001",
  mode: "fallback",
  correctedSummary: "Adds the missing inhibitory relation and strengthens the kidney outcome.",
  entities: [{ id: "ent_fix_1", label: "Kidney injury", role: "outcome" }],
  relations: [{ id: "rel_fix_1", sourceId: "ent_fix_1", targetId: "ent_fix_1", semantics: "inhibit" }],
  issues: [{ code: "missing_relation", severity: "warning", message: "One inhibitory edge is missing." }],
  warnings: [],
};

void reconstructFigureResponse;

// @ts-expect-error invalid export format
const badComposeRequest: ComposeFigureRequest = {
  ...composeRequest,
  exportFormats: ["pdf"],
};

void badComposeRequest;

// @ts-expect-error normalizedMimeType must be image/png
const badNormalizeResponse: NormalizeAssetResponse = {
  ...normalizeResponse,
  source: {
    ...normalizeResponse.source,
    normalizedMimeType: "image/jpeg",
  },
};

void badNormalizeResponse;

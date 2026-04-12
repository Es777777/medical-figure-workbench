import type { ArrowSemantic, ID, SceneGraph } from "./scene-graph";

export interface ValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    issues?: ValidationIssue[];
  };
}

export interface NormalizeAssetRequest {
  requestId: ID;
  sourcePath: string;
  outputDir: string;
  outputName?: string;
  frameIndex?: number;
  preferAlpha?: boolean;
}

export interface NormalizeAssetResponse {
  requestId: ID;
  documentId: ID;
  source: {
    originalUri: string;
    normalizedUri: string;
    originalDetectedFormat: string;
    normalizedMimeType: "image/png";
    width: number;
    height: number;
  };
  warnings: string[];
}

export interface AnalyzeAssetRequest {
  requestId: ID;
  documentId: ID;
  normalizedUri: string;
  runOcr: boolean;
  detectRegions: boolean;
  detectConnectors?: boolean;
}

export interface DraftNode {
  id: ID;
  type: "image" | "text" | "arrow" | "panel";
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
  text?: string;
}

export interface AnalyzeAssetResponse {
  requestId: ID;
  documentId: ID;
  draftNodes: DraftNode[];
  warnings: string[];
}

export interface ComposeFigureRequest {
  requestId: ID;
  documentId: ID;
  scene: SceneGraph;
  exportFormats: Array<"png" | "svg" | "json">;
}

export interface ComposeFigureResponse {
  requestId: ID;
  documentId: ID;
  accepted: boolean;
  sceneVersion: number;
}

export interface RegenerateNodeRequest {
  requestId: ID;
  documentId: ID;
  nodeId: ID;
  prompt: string;
  feedback?: string;
  constraints?: {
    keepPosition?: boolean;
    keepSize?: boolean;
    preserveThemeColor?: boolean;
  };
}

export interface RegenerateNodeVariant {
  id: ID;
  previewUri: string;
  asset: {
    assetId: ID;
    uri: string;
    mimeType: string;
    width: number;
    height: number;
    sourceKind: "generated" | "upload" | "normalized" | "extracted";
  };
}

export interface RegenerateNodeResponse {
  requestId: ID;
  documentId: ID;
  nodeId: ID;
  variants: RegenerateNodeVariant[];
}

export type AnalysisMode = "live" | "fallback";
export type PromptEntityRole = "entity" | "process" | "outcome" | "context" | "annotation" | "panel";

export interface PromptEntityDraft {
  id: ID;
  label: string;
  role: PromptEntityRole;
  libraryItemId?: ID;
  confidence?: number;
  notes?: string;
}

export interface PromptRelationDraft {
  id: ID;
  sourceId: ID;
  targetId: ID;
  semantics: ArrowSemantic;
  label?: string;
  confidence?: number;
}

export interface PromptLayoutHints {
  readingOrder?: "left-to-right" | "top-to-bottom";
  groups?: ID[][];
  emphasizeIds?: ID[];
}

export interface PlannerTargetRef {
  kind: "entity" | "relation" | "node" | "edge" | "region";
  id: ID;
  label: string;
}

export interface PlannerAction {
  id: ID;
  bucket: "applyable" | "needs_confirmation" | "blocked";
  operation: "create_node" | "create_relation" | "replace_asset" | "retarget_relation" | "clarify";
  label: string;
  reason: string;
  expectedVisualResult: string;
  confidence: number;
  targetRefs: PlannerTargetRef[];
  blockingAmbiguity?: string;
}

export interface AnalyzePromptRequest {
  requestId: ID;
  documentId?: ID;
  prompt: string;
  preferredLanguage?: "en" | "zh-CN";
  editorContext?: {
    canvas?: {
      width: number;
      height: number;
    };
    existingNodeCount?: number;
    notes?: string;
  };
}

export interface AnalyzePromptResponse {
  requestId: ID;
  documentId?: ID;
  mode: AnalysisMode;
  summary: string;
  entities: PromptEntityDraft[];
  relations: PromptRelationDraft[];
  layoutHints?: PromptLayoutHints;
  actions: PlannerAction[];
  warnings: string[];
}

export interface ReconstructionIssue {
  code: "missing_node" | "missing_relation" | "wrong_semantics" | "weak_asset_match";
  severity: "info" | "warning" | "error";
  message: string;
  entityId?: ID;
  relationId?: ID;
  targetRefs?: PlannerTargetRef[];
}

export interface ReconstructFigureRequest {
  requestId: ID;
  documentId?: ID;
  prompt: string;
  scene: SceneGraph;
  problemNotes?: string;
  preferredLanguage?: "en" | "zh-CN";
}

export interface ReconstructFigureResponse {
  requestId: ID;
  documentId?: ID;
  mode: AnalysisMode;
  correctedSummary: string;
  entities: PromptEntityDraft[];
  relations: PromptRelationDraft[];
  issues: ReconstructionIssue[];
  actions: PlannerAction[];
  warnings: string[];
}

export interface ExportSceneRequest {
  requestId: ID;
  documentId: ID;
  scene: SceneGraph;
  formats: Array<"png" | "svg" | "json">;
}

export interface ExportSceneResponse {
  requestId: ID;
  documentId: ID;
  pngUri?: string;
  svgUri?: string;
  jsonUri?: string;
}

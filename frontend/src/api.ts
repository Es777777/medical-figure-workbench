import type {
  AnalyzeAssetRequest,
  AnalyzeAssetResponse,
  AnalyzePromptRequest,
  AnalyzePromptResponse,
  ReconstructFigureRequest,
  ReconstructFigureResponse,
  RegenerateNodeRequest,
  RegenerateNodeResponse,
} from "@shared/api-contracts";

export const API_ROUTES = {
  healthz: "/healthz",
  analyzeAsset: "/analyze-asset",
  analyzePrompt: "/analyze-prompt",
  composeFigure: "/compose-figure",
  reconstructFigure: "/reconstruct-figure",
  regenerateNode: "/regenerate-node",
} as const;

export interface RegenerateActionResult {
  mode: "live" | "mock";
  response: RegenerateNodeResponse;
  message: string;
}

export interface AnalyzePromptActionResult {
  mode: "live" | "fallback";
  response: AnalyzePromptResponse;
  message: string;
}

export interface ReconstructFigureActionResult {
  mode: "live" | "fallback";
  response: ReconstructFigureResponse;
  message: string;
}

export interface AnalyzeAssetActionResult {
  mode: "live" | "fallback";
  response: AnalyzeAssetResponse;
  message: string;
}

export function resolveAssetUrl(uri: string): string {
  if (/^(data:|https?:|blob:)/.test(uri)) {
    return uri;
  }

  const apiBaseUrl = getApiBaseUrl();
  if (uri.startsWith("/") && apiBaseUrl) {
    return `${apiBaseUrl}${uri}`;
  }

  return uri;
}

function getApiBaseUrl(): string | null {
  const configuredBase = import.meta.env.VITE_API_BASE_URL;
  if (!configuredBase) {
    return null;
  }

  return configuredBase.replace(/\/$/, "");
}

type VariantSeed = {
  id: string;
  uri: string;
};

function buildLocalAnalyzeResponse(payload: AnalyzePromptRequest): AnalyzePromptResponse {
  const parts = payload.prompt
    .split(/\r?\n|->|→|,|，|;|；/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 6);
  const entities = parts.map((label, index) => ({
    id: `ent_${index + 1}`,
    label,
    role: index === parts.length - 1 ? "outcome" : index === 0 ? "context" : "process",
    confidence: 0.7,
  })) as AnalyzePromptResponse["entities"];
  const relations = entities.slice(0, -1).map((entity, index) => ({
    id: `rel_${index + 1}`,
    sourceId: entity.id,
    targetId: entities[index + 1].id,
    semantics: "flows_to",
    confidence: 0.6,
  })) as AnalyzePromptResponse["relations"];
  return {
    requestId: payload.requestId,
    documentId: payload.documentId,
    mode: "fallback",
    summary: `Created a fallback structure with ${entities.length} entities.`,
    entities,
    relations,
    layoutHints: { readingOrder: "left-to-right" },
    actions: [
      ...entities.map((entity) => ({
        id: `action_${entity.id}`,
        bucket: "applyable" as const,
        operation: "create_node" as const,
        label: `Create ${entity.label}`,
        reason: "Fallback planner extracted this entity from the prompt.",
        expectedVisualResult: `Add an editable node for ${entity.label}.`,
        confidence: entity.confidence ?? 0.7,
        targetRefs: [{ kind: "entity" as const, id: entity.id, label: entity.label }],
      })),
      ...relations.map((relation) => ({
        id: `action_${relation.id}`,
        bucket: "applyable" as const,
        operation: "create_relation" as const,
        label: `Add ${relation.semantics} relation`,
        reason: "Fallback planner found a directed relation in the prompt.",
        expectedVisualResult: `Create a ${relation.semantics} arrow between planned entities.`,
        confidence: relation.confidence ?? 0.6,
        targetRefs: [
          { kind: "relation" as const, id: relation.id, label: relation.semantics },
          { kind: "entity" as const, id: relation.sourceId, label: relation.sourceId },
          { kind: "entity" as const, id: relation.targetId, label: relation.targetId },
        ],
      })),
    ],
    warnings: entities.length < 2 ? ["Prompt was too short, so the fallback structure is minimal."] : [],
  };
}

function buildLocalAnalyzeAssetResponse(payload: AnalyzeAssetRequest): AnalyzeAssetResponse {
  return {
    requestId: payload.requestId,
    documentId: payload.documentId,
    draftNodes: [
      {
        id: "draft_panel_local_001",
        type: "panel",
        bbox: { x: 0, y: 0, width: 1200, height: 700 },
        confidence: 0.7,
        text: "Panel 1",
      },
      {
        id: "draft_image_local_001",
        type: "image",
        bbox: { x: 32, y: 40, width: 1136, height: 620 },
        confidence: 0.75,
      },
      {
        id: "draft_text_local_001",
        type: "text",
        bbox: { x: 72, y: 54, width: 480, height: 56 },
        confidence: 0.52,
        text: "Detected text band",
      },
    ],
    warnings: ["Backend unavailable, using deterministic draft region fallback."],
  };
}

function buildLocalReconstructResponse(payload: ReconstructFigureRequest): ReconstructFigureResponse {
  const analysis = buildLocalAnalyzeResponse({
    requestId: payload.requestId,
    documentId: payload.documentId,
    prompt: payload.prompt,
    preferredLanguage: payload.preferredLanguage,
  });
  return {
    requestId: payload.requestId,
    documentId: payload.documentId,
    mode: "fallback",
    correctedSummary: `Prepared a fallback reconstruction using ${analysis.entities.length} entities.`,
    entities: analysis.entities,
    relations: analysis.relations,
    issues: [
      {
        code: "weak_asset_match",
        severity: "info",
        message: payload.problemNotes || "Fallback reconstruction used prompt-only reasoning.",
        targetRefs: [],
      },
    ],
    actions: [
      {
        id: "reconstruct_action_1",
        bucket: "needs_confirmation",
        operation: "replace_asset",
        label: "Replace weak assets",
        reason: "Fallback reconstruction detected that the current scene likely needs stronger matching icons.",
        expectedVisualResult: "Swap weak placeholders for more specific assets.",
        confidence: 0.55,
        targetRefs: [],
      },
    ],
    warnings: analysis.warnings,
  };
}

function pickVariantSeeds(payload: RegenerateNodeRequest): VariantSeed[] {
  const context = `${payload.nodeId} ${payload.prompt} ${payload.feedback ?? ""}`.toLowerCase();

  if (context.includes("kidney") || context.includes("肾")) {
    return [
      { id: "kidney-clean", uri: "/library/kidney-clean.svg" },
      { id: "protection", uri: "/library/protective-shield.svg" },
      { id: "inflammation", uri: "/library/inflammation.svg" },
      { id: "variant-a", uri: "/generated/mock-variant-1.svg" },
    ];
  }

  if (context.includes("mito") || context.includes("线粒体")) {
    return [
      { id: "mitochondria", uri: "/library/mitochondria.svg" },
      { id: "immune-cell", uri: "/library/immune-cell.svg" },
      { id: "variant-a", uri: "/generated/mock-variant-1.svg" },
      { id: "variant-b", uri: "/generated/mock-variant-2.svg" },
    ];
  }

  if (context.includes("bacteria") || context.includes("细菌") || context.includes("sepsis")) {
    return [
      { id: "bacteria", uri: "/library/bacteria.svg" },
      { id: "inflammation", uri: "/library/inflammation.svg" },
      { id: "immune-cell", uri: "/library/immune-cell.svg" },
      { id: "variant-b", uri: "/generated/mock-variant-2.svg" },
    ];
  }

  return [
    { id: "variant-a", uri: "/generated/mock-variant-1.svg" },
    { id: "variant-b", uri: "/generated/mock-variant-2.svg" },
    { id: "immune-cell", uri: "/library/immune-cell.svg" },
    { id: "protection", uri: "/library/protective-shield.svg" },
  ];
}

function buildMockRegenerateResponse(payload: RegenerateNodeRequest): RegenerateNodeResponse {
  return {
    requestId: payload.requestId,
    documentId: payload.documentId,
    nodeId: payload.nodeId,
    variants: pickVariantSeeds(payload).map((seed, index) => ({
      id: `mock_${payload.nodeId}_${seed.id}_${index + 1}`,
      previewUri: seed.uri,
      asset: {
        assetId: `asset_${payload.nodeId}_${seed.id}_${index + 1}`,
        uri: seed.uri,
        mimeType: "image/svg+xml",
        width: 320,
        height: 220,
        sourceKind: "generated",
      },
    })),
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed with status ${response.status}`;

  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function requestRegenerateNode(payload: RegenerateNodeRequest): Promise<RegenerateActionResult> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return {
      mode: "mock",
      response: buildMockRegenerateResponse(payload),
      message: "No API base configured for regenerate-node, showing mock variants instead.",
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}${API_ROUTES.regenerateNode}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const parsed = (await response.json()) as RegenerateNodeResponse;
    return {
      mode: "live",
      response: parsed,
      message: "Variants loaded from the backend regenerate-node route.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown request error";
    return {
      mode: "mock",
      response: buildMockRegenerateResponse(payload),
      message: `Backend unavailable for regenerate-node, showing mock variants instead: ${message}`,
    };
  }
}

export async function requestAnalyzePrompt(payload: AnalyzePromptRequest): Promise<AnalyzePromptActionResult> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return {
      mode: "fallback",
      response: buildLocalAnalyzeResponse(payload),
      message: "No API base configured for analyze-prompt, using deterministic fallback.",
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}${API_ROUTES.analyzePrompt}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return {
      mode: "live",
      response: (await response.json()) as AnalyzePromptResponse,
      message: "Prompt analysis loaded from backend.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown request error";
    return {
      mode: "fallback",
      response: buildLocalAnalyzeResponse(payload),
      message: `Backend unavailable for analyze-prompt, using deterministic fallback: ${message}`,
    };
  }
}

export async function requestAnalyzeAsset(payload: AnalyzeAssetRequest): Promise<AnalyzeAssetActionResult> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return {
      mode: "fallback",
      response: buildLocalAnalyzeAssetResponse(payload),
      message: "No API base configured for analyze-asset, using deterministic draft fallback.",
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}${API_ROUTES.analyzeAsset}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return {
      mode: "live",
      response: (await response.json()) as AnalyzeAssetResponse,
      message: "Asset analysis loaded from backend.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown request error";
    return {
      mode: "fallback",
      response: buildLocalAnalyzeAssetResponse(payload),
      message: `Backend unavailable for analyze-asset, using deterministic draft fallback: ${message}`,
    };
  }
}

export async function requestReconstructFigure(payload: ReconstructFigureRequest): Promise<ReconstructFigureActionResult> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return {
      mode: "fallback",
      response: buildLocalReconstructResponse(payload),
      message: "No API base configured for reconstruct-figure, using deterministic fallback.",
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl}${API_ROUTES.reconstructFigure}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    return {
      mode: "live",
      response: (await response.json()) as ReconstructFigureResponse,
      message: "Reconstruction plan loaded from backend.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown request error";
    return {
      mode: "fallback",
      response: buildLocalReconstructResponse(payload),
      message: `Backend unavailable for reconstruct-figure, using deterministic fallback: ${message}`,
    };
  }
}

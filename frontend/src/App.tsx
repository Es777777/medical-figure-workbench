import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

import type {
  AnalyzePromptResponse,
  ComposeFigureRequest,
  PlannerAction,
  PlannerTargetRef,
  ReconstructFigureResponse,
  RegenerateNodeResponse,
  RegenerateNodeVariant,
} from "@shared/api-contracts";
import type { SceneGraph, SceneNode } from "@shared/scene-graph";

import { requestAnalyzeAsset, requestAnalyzePrompt, requestReconstructFigure, requestRegenerateNode, resolveAssetUrl } from "./api";
import { UI_COPY, type Language } from "./copy";
import { getElementLibrary, getLibraryCategories, getRecommendedLibraryItems, searchLibraryItems, type LibraryCategoryId } from "./element-library";
import { EditorCanvas } from "./EditorCanvas";
import {
  attachBackendDrafts,
  analyzeFigureFile,
  buildRecommendedPromptFromSemantics,
  insertSingleFigurePanelIntoScene,
  insertBackendDraftsIntoScene,
  insertFigurePanelsIntoScene,
  type FigureWorkbenchAnalysis,
} from "./figure-workbench";
import {
  applyLibraryAsset,
  applyVariantToImageNode,
  buildFlowLayout,
  buildSceneFromPromptAnalysis,
  computeFitScale,
  describeNode,
  getInitialSelectionId,
  isImageNode,
  isTextNode,
  loadInitialComposeRequest,
  makeRequestId,
  moveNodeInStack,
  setNodeZIndex,
  sortNodesByZIndex,
  rebuildSceneFromReconstruction,
  updateNodeGeometry,
  updateNodeById,
} from "./scene-data";

type RegenerateState = {
  prompt: string;
  feedback: string;
  status: "idle" | "loading" | "done";
  mode: "live" | "mock" | null;
  message: string;
  response: RegenerateNodeResponse | null;
  appliedVariantId: string | null;
};

type AnalyzeState = {
  prompt: string;
  status: "idle" | "loading" | "done";
  mode: "live" | "fallback" | null;
  message: string;
  response: AnalyzePromptResponse | null;
  acceptedActionIds: string[];
  rejectedActionIds: string[];
  appliedActionIds: string[];
  staleActionIds: string[];
};

type ReconstructState = {
  problemNotes: string;
  status: "idle" | "loading" | "done";
  mode: "live" | "fallback" | null;
  message: string;
  response: ReconstructFigureResponse | null;
  acceptedActionIds: string[];
  rejectedActionIds: string[];
  appliedActionIds: string[];
  staleActionIds: string[];
};

type NumericField = "x" | "y" | "width" | "height" | "zIndex";
type NumericDraftState = Record<NumericField, string>;
type PlannerActionState = "pending" | "stale" | "accepted" | "rejected" | "applied";
type PlannerReviewDecision = "accept" | "reject" | "restore";

type BootstrapState = {
  composeRequest: ComposeFigureRequest | null;
  scene: SceneGraph | null;
  selectedNodeId: string | null;
  error: string | null;
};

type PlannerSource = "analysis" | "reconstruction";

type PlannerReviewSnapshot = {
  acceptedActionIds: string[];
  rejectedActionIds: string[];
  appliedActionIds: string[];
  staleActionIds: string[];
};

type TargetLocalizationState = {
  source: PlannerSource;
  originId: string;
  targetId: string;
  targetLabel: string;
  matchedNodeId: string | null;
  revealVersion: number;
};

type FigureWorkbenchState = {
  status: "idle" | "loading" | "ready" | "error";
  contextNotes: string;
  analysis: FigureWorkbenchAnalysis | null;
  recommendedPrompt: string;
  semanticStatus: "idle" | "loading" | "done";
  semanticMode: "live" | "fallback" | null;
  semanticMessage: string;
  error: string;
};

type MedicalResourceCard = {
  id: string;
  title: string;
  description: Record<Language, string>;
  bestFor: Record<Language, string>;
  license: string;
  url: string;
};

const DEFAULT_LANGUAGE: Language = "zh-CN";
const MIN_CANVAS_SCALE = 0.5;
const MAX_CANVAS_SCALE = 2;
const CANVAS_SCALE_STEP = 0.1;

const initialRegenerateState: RegenerateState = {
  prompt: "simplify this scientific icon while keeping the composition readable",
  feedback: "Prefer a cleaner silhouette and lower detail.",
  status: "idle",
  mode: null,
  message: "",
  response: null,
  appliedVariantId: null,
};

const initialAnalyzeState: AnalyzeState = {
  prompt: "Create a sepsis mechanism figure where infection triggers inflammation, then leads to kidney injury and a repair branch.",
  status: "idle",
  mode: null,
  message: "",
  response: null,
  acceptedActionIds: [],
  rejectedActionIds: [],
  appliedActionIds: [],
  staleActionIds: [],
};

const initialReconstructState: ReconstructState = {
  problemNotes: "The current generated figure is missing one important inhibitory relation and the icon choices feel weak.",
  status: "idle",
  mode: null,
  message: "",
  response: null,
  acceptedActionIds: [],
  rejectedActionIds: [],
  appliedActionIds: [],
  staleActionIds: [],
};

const initialFigureWorkbenchState: FigureWorkbenchState = {
  status: "idle",
  contextNotes: "Sepsis mechanism figure with panel splits, organ injury progression, and clinically readable labels.",
  analysis: null,
  recommendedPrompt: "",
  semanticStatus: "idle",
  semanticMode: null,
  semanticMessage: "",
  error: "",
};

const MEDICAL_RESOURCE_CARDS: MedicalResourceCard[] = [
  {
    id: "servier",
    title: "Servier Medical Art",
    description: {
      en: "Free publication-ready medical illustrations with strong anatomy, pathology, and specialty coverage.",
      "zh-CN": "免费医学插图资源，适合论文机制图、解剖结构和病理场景，覆盖范围完整。",
    },
    bestFor: {
      en: "Kidney, immune, infection, pathway, and organ-level diagrams.",
      "zh-CN": "肾脏、免疫、感染、通路和器官层级的机制图。",
    },
    license: "CC BY 4.0",
    url: "https://smart.servier.com/",
  },
  {
    id: "bioicons",
    title: "Bioicons",
    description: {
      en: "Open science icon library with SVG assets for cell biology, receptors, microbiology, and lab workflows.",
      "zh-CN": "开放科学图标库，提供细胞生物学、受体、微生物和实验流程相关 SVG 资源。",
    },
    bestFor: {
      en: "Cell membrane, mitochondria, viruses, receptors, and experimental annotations.",
      "zh-CN": "膜结构、线粒体、病毒、受体和实验注释类元素。",
    },
    license: "Mixed: CC0 / CC BY-SA / MIT",
    url: "https://bioicons.com/",
  },
  {
    id: "cdc-phil",
    title: "CDC PHIL",
    description: {
      en: "Public health image library with clinical, microscopy, infectious disease, and public health reference imagery.",
      "zh-CN": "CDC 公共卫生图片库，适合感染、显微镜、公共卫生和临床背景图参考。",
    },
    bestFor: {
      en: "Reference photos, microscopy textures, pathogen examples, and public health context panels.",
      "zh-CN": "参考照片、显微图纹理、病原体示例和公共卫生背景分图。",
    },
    license: "Use per CDC PHIL terms",
    url: "https://phil.cdc.gov/",
  },
  {
    id: "smart-biorender-alternatives",
    title: "BioRender Learning Gallery",
    description: {
      en: "Use as style inspiration for figure composition, panel hierarchy, and clean scientific storytelling.",
      "zh-CN": "适合作为图形构图、分图层级和科研叙事方式的参考灵感来源。",
    },
    bestFor: {
      en: "Layout ideas, pathway composition, and high-clarity figure storytelling.",
      "zh-CN": "版式参考、通路组合和高可读性科研配图表达。",
    },
    license: "Reference only; check site terms",
    url: "https://www.biorender.com/learning-hub",
  },
  {
    id: "wikimedia-medical",
    title: "Wikimedia Medical Media",
    description: {
      en: "Large pool of anatomy, pathology, and microscopy illustrations with searchable reuse-friendly assets.",
      "zh-CN": "包含大量解剖、病理和显微图素材，适合检索可复用的医学图像资源。",
    },
    bestFor: {
      en: "Anatomy references, pathology textures, and educational clinical diagrams.",
      "zh-CN": "解剖参考、病理纹理和教学型临床示意图。",
    },
    license: "Varies by asset",
    url: "https://commons.wikimedia.org/wiki/Category:Medical_illustrations",
  },
];

function initializeBootstrap(): BootstrapState {
  try {
    const composeRequest = loadInitialComposeRequest();
    const scene = composeRequest.scene;
    return {
      composeRequest,
      scene,
      selectedNodeId: getInitialSelectionId(scene),
      error: null,
    };
  } catch (error) {
    return {
      composeRequest: null,
      scene: null,
      selectedNodeId: null,
      error: error instanceof Error ? error.message : "Unknown bootstrap error",
    };
  }
}

function resolveInitialLanguage(): Language {
  try {
    const candidate = window.localStorage.getItem("editor-language");
    return candidate === "en" || candidate === "zh-CN" ? candidate : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function persistLanguagePreference(language: Language): boolean {
  try {
    window.localStorage.setItem("editor-language", language);
    return true;
  } catch {
    return false;
  }
}

function formatNodeType(node: SceneNode, language: Language): string {
  return UI_COPY[language].nodeTypes[node.type];
}

function getStackOrder(nodes: SceneNode[], nodeId: string): { canMoveForward: boolean; canMoveBackward: boolean } {
  const ordered = sortNodesByZIndex(nodes);
  const currentIndex = ordered.findIndex((node) => node.id === nodeId);
  return {
    canMoveBackward: currentIndex > 0,
    canMoveForward: currentIndex >= 0 && currentIndex < ordered.length - 1,
  };
}

function clampFontSize(value: number): number {
  if (Number.isNaN(value)) {
    return 1;
  }
  return Math.min(Math.max(value, 1), 240);
}

function clampCoordinate(value: number, fallback: number): number {
  if (Number.isNaN(value)) {
    return fallback;
  }
  return Math.round(value * 100) / 100;
}

function clampDimension(value: number, fallback: number): number {
  if (Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(Math.round(value * 100) / 100, 1);
}

function clampCanvasScale(value: number): number {
  return Math.min(Math.max(Math.round(value * 100) / 100, MIN_CANVAS_SCALE), MAX_CANVAS_SCALE);
}

function formatNumericFieldValue(node: SceneNode, field: NumericField): string {
  if (field === "zIndex") {
    return String(node.zIndex);
  }

  return String(Math.round(node.transform[field] * 100) / 100);
}

function buildNumericDraftState(node: SceneNode): NumericDraftState {
  return {
    x: formatNumericFieldValue(node, "x"),
    y: formatNumericFieldValue(node, "y"),
    width: formatNumericFieldValue(node, "width"),
    height: formatNumericFieldValue(node, "height"),
    zIndex: formatNumericFieldValue(node, "zIndex"),
  };
}

function parseNumericDraftValue(field: NumericField, rawValue: string, fallback: number): number | null {
  if (rawValue.trim() === "") {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (field === "zIndex") {
    return Math.max(Math.round(parsed), 0);
  }

  if (field === "width" || field === "height") {
    return clampDimension(parsed, fallback);
  }

  return clampCoordinate(parsed, fallback);
}

function buildVariantPreviewDataUri(label: string, language: Language, mode: "live" | "mock" | null): string {
  const title = language === "zh-CN" ? "可用元素" : "Available Element";
  const palette = mode === "live"
    ? { bg: "#0c8f8a", accent: "#074f55" }
    : { bg: "#a65a27", accent: "#6f3412" };
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${palette.bg}" stop-opacity="0.2" />
          <stop offset="100%" stop-color="${palette.accent}" stop-opacity="0.34" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" rx="28" fill="#fbfaf7" />
      <rect x="18" y="18" width="284" height="164" rx="24" fill="url(#g)" stroke="${palette.bg}" stroke-width="2" />
      <circle cx="92" cy="98" r="34" fill="${palette.bg}" fill-opacity="0.22" stroke="${palette.bg}" stroke-width="4" />
      <path d="M146 74h106v12H146zm0 26h86v12h-86zm0 26h106v12H146z" fill="${palette.accent}" fill-opacity="0.78" />
      <text x="24" y="42" font-family="Trebuchet MS, sans-serif" font-size="16" fill="#1f2a35">${title}</text>
      <text x="24" y="168" font-family="Trebuchet MS, sans-serif" font-size="15" fill="#1f2a35">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getRegenerateSummary(language: Language, state: RegenerateState): string {
  const copy = UI_COPY[language];
  if (state.status === "loading") {
    return copy.messages.loadingVariants;
  }
  if (state.status === "done") {
    return state.mode === "live" ? copy.messages.liveLoaded : copy.messages.mockLoaded;
  }
  return copy.messages.noRegenerateRequest;
}

function normalizeSearchToken(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function findSceneNodeForTarget(scene: SceneGraph, target: PlannerTargetRef): SceneNode | null {
  const normalizedId = normalizeSearchToken(target.id);
  const normalizedLabel = normalizeSearchToken(target.label);
  let bestMatch: { node: SceneNode; score: number } | null = null;

  for (const node of scene.nodes) {
    const nodeId = normalizeSearchToken(node.id);
    const nodeName = normalizeSearchToken(node.name);
    const textContent = node.type === "text" ? normalizeSearchToken(node.text) : "";
    const relationLabel = node.type === "arrow" ? normalizeSearchToken(node.relationLabel) : "";
    const semantics = node.type === "arrow" ? normalizeSearchToken(node.semantics) : "";
    const sourceId = node.type === "arrow" ? normalizeSearchToken(node.sourceNodeId) : "";
    const targetId = node.type === "arrow" ? normalizeSearchToken(node.targetNodeId) : "";
    const searchable = `${nodeName} ${textContent} ${relationLabel} ${semantics}`;

    let score = 0;

    if (normalizedId && nodeId === normalizedId) {
      score += 14;
    }

    if (normalizedLabel && nodeName === normalizedLabel) {
      score += 12;
    }

    if (normalizedLabel && textContent === normalizedLabel) {
      score += 10;
    }

    if (normalizedId && (sourceId === normalizedId || targetId === normalizedId)) {
      score += 9;
    }

    if (normalizedLabel && (relationLabel === normalizedLabel || semantics === normalizedLabel)) {
      score += 8;
    }

    if (normalizedLabel && searchable.includes(normalizedLabel)) {
      score += 5;
    }

    if (target.kind === "relation" && node.type === "arrow") {
      score += 2;
    }

    if (target.kind !== "relation" && node.type !== "arrow") {
      score += 2;
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { node, score };
    }
  }

  return bestMatch && bestMatch.score >= 7 ? bestMatch.node : null;
}

function buildHighlightTargets(scene: SceneGraph, target: PlannerTargetRef, matchedNode: SceneNode | null): PlannerTargetRef[] {
  if (!matchedNode) {
    return [target];
  }

  const targets: PlannerTargetRef[] = [
    {
      kind: "node",
      id: matchedNode.id,
      label: target.label,
    },
  ];

  if (matchedNode.type === "arrow") {
    for (const relatedNode of scene.nodes) {
      if (relatedNode.id === matchedNode.sourceNodeId || relatedNode.id === matchedNode.targetNodeId) {
        targets.push({
          kind: "node",
          id: relatedNode.id,
          label: relatedNode.name ?? relatedNode.id,
        });
      }
    }
  }

  return targets;
}

function applyPlannerReviewDecision<T extends PlannerReviewSnapshot>(
  currentState: T,
  actionId: string,
  decision: PlannerReviewDecision,
): T {
  const acceptedActionIds = currentState.acceptedActionIds.filter((id) => id !== actionId);
  const rejectedActionIds = currentState.rejectedActionIds.filter((id) => id !== actionId);
  const staleActionIds = currentState.staleActionIds.filter((id) => id !== actionId);

  if (decision === "accept") {
    acceptedActionIds.push(actionId);
  }

  if (decision === "reject") {
    rejectedActionIds.push(actionId);
  }

  if (decision === "restore") {
    staleActionIds.push(actionId);
  }

  return {
    ...currentState,
    acceptedActionIds,
    rejectedActionIds,
    staleActionIds,
  };
}

export function App() {
  const [bootstrap] = useState<BootstrapState>(() => initializeBootstrap());
  const [language, setLanguage] = useState<Language>(() => resolveInitialLanguage());
  const copy = UI_COPY[language];

  const [composeRequest] = useState<ComposeFigureRequest | null>(bootstrap.composeRequest);
  const [scene, setScene] = useState<SceneGraph | null>(bootstrap.scene);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(bootstrap.selectedNodeId);
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>(initialAnalyzeState);
  const [reconstructState, setReconstructState] = useState<ReconstructState>(initialReconstructState);
  const [regenerateState, setRegenerateState] = useState<RegenerateState>(initialRegenerateState);
  const [figureWorkbenchState, setFigureWorkbenchState] = useState<FigureWorkbenchState>(initialFigureWorkbenchState);
  const [canvasScale, setCanvasScale] = useState<number>(1);
  const [hasManualZoom, setHasManualZoom] = useState<boolean>(false);
  const [flowInput, setFlowInput] = useState<string>("感染\n炎症\n器官损伤\n修复");
  const [libraryQuery, setLibraryQuery] = useState<string>("");
  const [libraryCategory, setLibraryCategory] = useState<LibraryCategoryId | "all">("all");
  const [focusedTargets, setFocusedTargets] = useState<PlannerTargetRef[]>([]);
  const [targetLocalization, setTargetLocalization] = useState<TargetLocalizationState | null>(null);
  const regenerateRequestIdRef = useRef<string | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const figureFileInputRef = useRef<HTMLInputElement | null>(null);

  const orderedNodes = useMemo(() => (scene ? sortNodesByZIndex(scene.nodes) : []), [scene]);
  const layers = useMemo(() => [...orderedNodes].reverse(), [orderedNodes]);
  const selectedNode = useMemo(() => (scene ? scene.nodes.find((node) => node.id === selectedNodeId) ?? null : null), [scene, selectedNodeId]);
  const committedNumericDrafts = useMemo(() => (selectedNode ? buildNumericDraftState(selectedNode) : null), [selectedNode]);
  const [numericDrafts, setNumericDrafts] = useState<NumericDraftState | null>(() => {
    if (!bootstrap.scene || !bootstrap.selectedNodeId) {
      return null;
    }

    const currentNode = bootstrap.scene.nodes.find((node) => node.id === bootstrap.selectedNodeId);
    return currentNode ? buildNumericDraftState(currentNode) : null;
  });
  const stackState = selectedNode && scene ? getStackOrder(scene.nodes, selectedNode.id) : null;
  const libraryItems = useMemo(() => getElementLibrary(language), [language]);
  const libraryCategories = useMemo(() => getLibraryCategories(language), [language]);
  const filteredLibraryItems = useMemo(() => {
    const scopedItems = libraryCategory === "all" ? libraryItems : libraryItems.filter((item) => item.category === libraryCategory);
    return searchLibraryItems(scopedItems, libraryQuery);
  }, [libraryCategory, libraryItems, libraryQuery]);
  const recommendedLibraryItems = useMemo(() => {
    const context = `${selectedNode?.name ?? ""} ${figureWorkbenchState.analysis?.mergedRecognizedText ?? ""} ${figureWorkbenchState.analysis?.recommendedPrompt ?? ""}`;
    return getRecommendedLibraryItems(language, context).slice(0, 6);
  }, [figureWorkbenchState.analysis, language, selectedNode]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = copy.pageTitle;
    persistLanguagePreference(language);
  }, [copy.pageTitle, language]);

  useEffect(() => {
    setNumericDrafts(selectedNode ? buildNumericDraftState(selectedNode) : null);
  }, [selectedNode]);

  useEffect(() => {
    regenerateRequestIdRef.current = null;
    setRegenerateState((currentState) => ({
      ...initialRegenerateState,
      prompt: currentState.prompt,
      feedback: currentState.feedback,
    }));
  }, [selectedNodeId]);

  useEffect(() => {
    if (!scene || !canvasViewportRef.current || hasManualZoom) {
      return;
    }

    const target = canvasViewportRef.current;
    const applyFitScale = () => {
      setCanvasScale(computeFitScale(scene, target.clientWidth, target.clientHeight));
    };

    applyFitScale();

    const observer = new ResizeObserver(() => {
      applyFitScale();
    });

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [hasManualZoom, scene]);

  useEffect(() => {
    if (!scene || !canvasViewportRef.current || !targetLocalization?.matchedNodeId) {
      return;
    }

    const matchedNode = scene.nodes.find((node) => node.id === targetLocalization.matchedNodeId);
    if (!matchedNode) {
      return;
    }

    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const viewport = canvasViewportRef.current;
        if (!viewport) {
          return;
        }

        const canvasElement = viewport.querySelector("canvas");
        const viewportRect = viewport.getBoundingClientRect();
        const canvasRect = canvasElement instanceof HTMLCanvasElement ? canvasElement.getBoundingClientRect() : null;
        const canvasLeft = canvasRect ? canvasRect.left - viewportRect.left + viewport.scrollLeft : viewport.scrollLeft;
        const canvasTop = canvasRect ? canvasRect.top - viewportRect.top + viewport.scrollTop : viewport.scrollTop;
        const centerX = canvasLeft + (matchedNode.bbox.x + matchedNode.bbox.width / 2) * canvasScale;
        const centerY = canvasTop + (matchedNode.bbox.y + matchedNode.bbox.height / 2) * canvasScale;

        viewport.scrollTo({
          left: Math.max(centerX - viewport.clientWidth / 2, 0),
          top: Math.max(centerY - viewport.clientHeight / 2, 0),
          behavior: "smooth",
        });
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [canvasScale, scene, targetLocalization]);

  function updateSceneNode(nodeId: string, updater: (node: SceneNode) => SceneNode) {
    setScene((currentScene) => (currentScene ? updateNodeById(currentScene, nodeId, updater) : currentScene));
  }

  function resetNumericDrafts() {
    setNumericDrafts(selectedNode ? buildNumericDraftState(selectedNode) : null);
  }

  function handleNumericDraftChange(field: NumericField, rawValue: string) {
    setNumericDrafts((currentDrafts) => {
      if (!currentDrafts) {
        return currentDrafts;
      }

      return {
        ...currentDrafts,
        [field]: rawValue,
      };
    });
  }

  function commitNumericDraft(field: NumericField) {
    if (!selectedNode || !numericDrafts) {
      return;
    }

    if (selectedNode.type === "text" && field === "height") {
      resetNumericDrafts();
      return;
    }

    const rawValue = numericDrafts[field];
    const fallback = field === "zIndex" ? selectedNode.zIndex : selectedNode.transform[field];
    const parsedValue = parseNumericDraftValue(field, rawValue, fallback);

    if (parsedValue === null) {
      resetNumericDrafts();
      return;
    }

    if (field === "zIndex") {
      if (parsedValue === selectedNode.zIndex) {
        resetNumericDrafts();
        return;
      }

      setScene((currentScene) => (currentScene ? setNodeZIndex(currentScene, selectedNode.id, parsedValue) : currentScene));
      return;
    }

    if (parsedValue === selectedNode.transform[field]) {
      resetNumericDrafts();
      return;
    }

    setScene((currentScene) => (currentScene ? updateNodeGeometry(currentScene, selectedNode.id, { [field]: parsedValue }) : currentScene));
  }

  function handleNumericFieldKeyDown(field: NumericField, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitNumericDraft(field);
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      resetNumericDrafts();
      event.currentTarget.blur();
    }
  }

  function getNumericInputMeta(field: NumericField): { value: string; dirty: boolean; invalid: boolean } {
    const committedValue = committedNumericDrafts?.[field] ?? "";
    const draftValue = numericDrafts?.[field] ?? committedValue;
    const isDisabledTextHeight = selectedNode?.type === "text" && field === "height";
    const isInvalid = !isDisabledTextHeight && draftValue.trim() !== "" && parseNumericDraftValue(field, draftValue, 0) === null;

    return {
      value: draftValue,
      dirty: draftValue !== committedValue,
      invalid: isInvalid,
    };
  }

  function handleLayerMove(direction: "forward" | "backward") {
    if (!selectedNode) {
      return;
    }

    setScene((currentScene) => (currentScene ? moveNodeInStack(currentScene, selectedNode.id, direction) : currentScene));
  }

  function handleCanvasScaleChange(nextScale: number) {
    setHasManualZoom(true);
    setCanvasScale(clampCanvasScale(nextScale));
  }

  function handleFitCanvas() {
    if (!scene || !canvasViewportRef.current) {
      return;
    }

    setHasManualZoom(false);
    setCanvasScale(computeFitScale(scene, canvasViewportRef.current.clientWidth, canvasViewportRef.current.clientHeight));
  }

  function handleLibraryApply(assetUri: string, name: string) {
    if (!scene) {
      return;
    }

    const result = applyLibraryAsset(scene, selectedNodeId, {
      assetUri,
      name,
        mimeType: assetUri.endsWith(".svg") || assetUri.startsWith("data:image/svg+xml") ? "image/svg+xml" : "image/png",
    });

    setScene(result.scene);
    setSelectedNodeId(result.nodeId);
  }

  function handleGenerateFlowLayout() {
    if (!scene) {
      return;
    }

    const result = buildFlowLayout(scene, flowInput);
    setScene(result.scene);
    setSelectedNodeId(result.selectedNodeId);
    setFocusedTargets([]);
    setTargetLocalization(null);
    setHasManualZoom(false);
  }

  function triggerFigureFilePicker() {
    figureFileInputRef.current?.click();
  }

  async function handleFigureFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setFigureWorkbenchState((currentState) => ({
      ...currentState,
      status: "loading",
      analysis: null,
      recommendedPrompt: "",
      semanticStatus: "idle",
      semanticMode: null,
      semanticMessage: "",
      error: "",
    }));

    try {
      let analysis = await analyzeFigureFile(file, figureWorkbenchState.contextNotes, language);
      if (composeRequest) {
        const draftResult = await requestAnalyzeAsset({
          requestId: makeRequestId("req_asset_draft"),
          documentId: composeRequest.documentId,
          normalizedUri: scene?.source.normalizedUri ?? composeRequest.scene.source.normalizedUri,
          runOcr: true,
          detectRegions: true,
          detectConnectors: true,
        });
        analysis = attachBackendDrafts(analysis, draftResult.response);
      }
      setFigureWorkbenchState((currentState) => ({
        ...currentState,
        status: "ready",
        analysis,
        recommendedPrompt: analysis.recommendedPrompt,
        semanticStatus: "idle",
        semanticMode: null,
        semanticMessage: "",
        error: "",
      }));
    } catch (error) {
      setFigureWorkbenchState((currentState) => ({
        ...currentState,
        status: "error",
        analysis: null,
        recommendedPrompt: "",
        semanticStatus: "idle",
        semanticMode: null,
        semanticMessage: "",
        error: error instanceof Error ? error.message : "Could not analyze the selected figure.",
      }));
    }
  }

  function handleImportDetectedPanels() {
    if (!scene || !figureWorkbenchState.analysis) {
      return;
    }

    const result = figureWorkbenchState.analysis.backendDrafts
      ? insertBackendDraftsIntoScene(scene, figureWorkbenchState.analysis, language)
      : insertFigurePanelsIntoScene(scene, figureWorkbenchState.analysis, language);
    setScene(result.scene);
    setSelectedNodeId(result.selectedNodeId);
    setFocusedTargets([]);
    setTargetLocalization(null);
    setHasManualZoom(false);
  }

  function handleImportSinglePanel(panelId: string) {
    if (!scene || !figureWorkbenchState.analysis) {
      return;
    }

    const result = insertSingleFigurePanelIntoScene(scene, figureWorkbenchState.analysis, panelId, language);
    setScene(result.scene);
    setSelectedNodeId(result.selectedNodeId);
    setFocusedTargets([]);
    setTargetLocalization(null);
    setHasManualZoom(false);
  }

  function handleFocusPanel(panelId: string) {
    if (!figureWorkbenchState.analysis) {
      return;
    }

    const targetPanel = figureWorkbenchState.analysis.panels.find((panel) => panel.id === panelId);
    if (!targetPanel) {
      return;
    }

    setTargetLocalization({
      source: "analysis",
      originId: `panel:${panelId}`,
      targetId: panelId,
      targetLabel: targetPanel.label,
      matchedNodeId: scene?.nodes.find((node) => node.name === targetPanel.label)?.id ?? null,
      revealVersion: Date.now(),
    });
  }

  async function handleAnalyzeImportedSemantics() {
    const analysis = figureWorkbenchState.analysis;
    if (!analysis) {
      return;
    }

    const prompt = figureWorkbenchState.recommendedPrompt.trim() || analysis.recommendedPrompt;
    setFigureWorkbenchState((currentState) => ({
      ...currentState,
      semanticStatus: "loading",
      semanticMode: null,
      semanticMessage: "",
    }));

    const result = await requestAnalyzePrompt({
      requestId: makeRequestId("req_import_semantics"),
      documentId: composeRequest?.documentId,
      prompt,
      preferredLanguage: language,
      editorContext: scene
        ? {
            canvas: scene.canvas,
            existingNodeCount: scene.nodes.length,
            notes: figureWorkbenchState.contextNotes,
          }
        : {
            notes: figureWorkbenchState.contextNotes,
          },
    });

    const refreshedPrompt = buildRecommendedPromptFromSemantics(analysis, result.response, figureWorkbenchState.contextNotes, language);

    setFigureWorkbenchState((currentState) => ({
      ...currentState,
      semanticStatus: "done",
      semanticMode: result.mode,
      semanticMessage: result.message,
      recommendedPrompt: refreshedPrompt,
    }));

    setAnalyzeState((currentState) => ({
      ...currentState,
      prompt: refreshedPrompt,
      status: "done",
      mode: result.mode,
      message: result.message,
      response: result.response,
      acceptedActionIds: result.response.actions.filter((action) => action.bucket === "applyable").map((action) => action.id),
      rejectedActionIds: [],
      appliedActionIds: [],
      staleActionIds: [],
    }));
  }

  async function handleAnalyzePrompt() {
    if (!scene) {
      return;
    }

    setAnalyzeState((currentState) => ({
      ...currentState,
      status: "loading",
      mode: null,
      message: "",
      response: null,
    }));
    setFocusedTargets([]);
    setTargetLocalization(null);

    const result = await requestAnalyzePrompt({
      requestId: makeRequestId("req_prompt"),
      documentId: composeRequest?.documentId,
      prompt: analyzeState.prompt,
      preferredLanguage: language,
      editorContext: {
        canvas: scene.canvas,
        existingNodeCount: scene.nodes.length,
      },
    });

    setAnalyzeState((currentState) => ({
      ...currentState,
      status: "done",
      mode: result.mode,
      message: result.message,
      response: result.response,
      acceptedActionIds: result.response.actions.filter((action) => action.bucket === "applyable").map((action) => action.id),
      rejectedActionIds: [],
      appliedActionIds: [],
      staleActionIds: [],
    }));
  }

  function handleApplyPromptStructure() {
    if (!scene || !analyzeState.response || analyzeState.acceptedActionIds.length === 0) {
      return;
    }

    const applyingActionIds = [...analyzeState.acceptedActionIds];
    const result = buildSceneFromPromptAnalysis(
      scene,
      analyzeState.response.entities,
      analyzeState.response.relations,
      analyzeState.response.actions,
      applyingActionIds,
    );
    setScene(result.scene);
    setSelectedNodeId(result.selectedNodeId);
    setFocusedTargets([]);
    setTargetLocalization(null);
    setHasManualZoom(false);
    setAnalyzeState((currentState) => ({
      ...currentState,
      acceptedActionIds: [],
      appliedActionIds: [...currentState.appliedActionIds, ...applyingActionIds],
      staleActionIds: currentState.staleActionIds.filter((actionId) => !applyingActionIds.includes(actionId)),
    }));
  }

  async function handleReconstructFigure() {
    if (!scene) {
      return;
    }

    setReconstructState((currentState) => ({
      ...currentState,
      status: "loading",
      mode: null,
      message: "",
      response: null,
    }));
    setFocusedTargets([]);
    setTargetLocalization(null);

    const result = await requestReconstructFigure({
      requestId: makeRequestId("req_reconstruct"),
      documentId: composeRequest?.documentId,
      prompt: analyzeState.prompt,
      scene,
      problemNotes: reconstructState.problemNotes,
      preferredLanguage: language,
    });

    setReconstructState((currentState) => ({
      ...currentState,
      status: "done",
      mode: result.mode,
      message: result.message,
      response: result.response,
      acceptedActionIds: result.response.actions.filter((action) => action.bucket === "applyable").map((action) => action.id),
      rejectedActionIds: [],
      appliedActionIds: [],
      staleActionIds: [],
    }));
  }

  function handleApplyReconstruction() {
    if (!scene || !reconstructState.response || reconstructState.acceptedActionIds.length === 0) {
      return;
    }

    const applyingActionIds = [...reconstructState.acceptedActionIds];
    const result = rebuildSceneFromReconstruction(
      scene,
      reconstructState.response.entities,
      reconstructState.response.relations,
      reconstructState.response.actions,
      applyingActionIds,
    );
    setScene(result.scene);
    setSelectedNodeId(result.selectedNodeId);
    setFocusedTargets([]);
    setTargetLocalization(null);
    setHasManualZoom(false);
    setReconstructState((currentState) => ({
      ...currentState,
      acceptedActionIds: [],
      appliedActionIds: [...currentState.appliedActionIds, ...applyingActionIds],
      staleActionIds: currentState.staleActionIds.filter((actionId) => !applyingActionIds.includes(actionId)),
    }));
  }

  function clearTargetLocalization() {
    setFocusedTargets([]);
    setTargetLocalization(null);
  }

  function focusTargetRef(source: PlannerSource, originId: string, target: PlannerTargetRef) {
    if (!scene) {
      return;
    }

    const matchedNode = findSceneNodeForTarget(scene, target);
    setFocusedTargets(buildHighlightTargets(scene, target, matchedNode));
    setTargetLocalization({
      source,
      originId,
      targetId: target.id,
      targetLabel: target.label,
      matchedNodeId: matchedNode?.id ?? null,
      revealVersion: Date.now(),
    });

    if (matchedNode) {
      setSelectedNodeId(matchedNode.id);
    }
  }

  function getActionState(source: PlannerSource, actionId: string): PlannerActionState {
    const state = source === "analysis" ? analyzeState : reconstructState;
    if (state.appliedActionIds.includes(actionId)) {
      return "applied";
    }
    if (state.acceptedActionIds.includes(actionId)) {
      return "accepted";
    }
    if (state.rejectedActionIds.includes(actionId)) {
      return "rejected";
    }
    if (state.staleActionIds.includes(actionId)) {
      return "stale";
    }
    return "pending";
  }

  function reviewPlannerAction(source: PlannerSource, actionId: string, decision: PlannerReviewDecision) {
    if (source === "analysis") {
      setAnalyzeState((currentState) => applyPlannerReviewDecision(currentState, actionId, decision));
      return;
    }

    setReconstructState((currentState) => applyPlannerReviewDecision(currentState, actionId, decision));
  }

  function applyPlannerAction(source: "analysis" | "reconstruction") {
    if (source === "analysis") {
      handleApplyPromptStructure();
      return;
    }

    handleApplyReconstruction();
  }

  async function handleRegenerate() {
    if (!selectedNode || !isImageNode(selectedNode) || !composeRequest) {
      return;
    }

    const requestId = makeRequestId("req_regen");
    regenerateRequestIdRef.current = requestId;

    const payload = {
      requestId,
      documentId: composeRequest.documentId,
      nodeId: selectedNode.id,
      prompt: regenerateState.prompt,
      feedback: regenerateState.feedback,
      constraints: {
        keepPosition: true,
        keepSize: true,
      },
    };

    setRegenerateState((currentState) => ({
      ...currentState,
      status: "loading",
      mode: null,
      message: "",
      response: null,
      appliedVariantId: null,
    }));

    const result = await requestRegenerateNode(payload);
    if (regenerateRequestIdRef.current !== requestId) {
      return;
    }

    setRegenerateState((currentState) => ({
      ...currentState,
      status: "done",
      mode: result.mode,
      message: result.message,
      response: result.response,
      appliedVariantId: null,
    }));
  }

  function applyVariant(variant: RegenerateNodeVariant) {
    if (!selectedNode || !isImageNode(selectedNode)) {
      return;
    }

    setScene((currentScene) => (currentScene ? applyVariantToImageNode(currentScene, selectedNode.id, variant.asset) : currentScene));
    setRegenerateState((currentState) => ({
      ...currentState,
      appliedVariantId: variant.id,
    }));
  }

  function renderVariantPreviewSource(variant: RegenerateNodeVariant): string {
    if (variant.previewUri.startsWith("data:image")) {
      return variant.previewUri;
    }
    return resolveAssetUrl(variant.previewUri);
  }

  function renderCurrentImagePreview(): string {
    if (!selectedNode || !isImageNode(selectedNode)) {
      return buildVariantPreviewDataUri("preview", language, regenerateState.mode);
    }

    if (selectedNode.asset.uri.startsWith("data:image")) {
      return selectedNode.asset.uri;
    }

    const libraryMatch = libraryItems.find((item) => item.assetUri === selectedNode.asset.uri);
    if (libraryMatch) {
      return resolveAssetUrl(libraryMatch.previewUri);
    }

    if (regenerateState.appliedVariantId && regenerateState.response) {
      const currentVariant = regenerateState.response.variants.find((variant) => variant.id === regenerateState.appliedVariantId);
      if (currentVariant) {
        return renderVariantPreviewSource(currentVariant);
      }
    }

    return resolveAssetUrl(selectedNode.asset.uri);
  }

  if (!scene || !composeRequest) {
    return (
      <div className="app-shell">
        <section className="panel bootstrap-panel">
          <p className="eyebrow">{copy.labels.bootstrapError}</p>
          <h1>{copy.messages.bootstrapFailure}</h1>
          <p>{bootstrap.error}</p>
          <button className="primary-button" onClick={() => window.location.reload()} type="button">
            {copy.actions.reload}
          </button>
        </section>
      </div>
    );
  }

  const xMeta = selectedNode ? getNumericInputMeta("x") : null;
  const yMeta = selectedNode ? getNumericInputMeta("y") : null;
  const widthMeta = selectedNode ? getNumericInputMeta("width") : null;
  const heightMeta = selectedNode ? getNumericInputMeta("height") : null;
  const zIndexMeta = selectedNode ? getNumericInputMeta("zIndex") : null;
  const libraryActionLabel = selectedNode && isImageNode(selectedNode) ? copy.actions.replaceSelected : copy.actions.insertToCanvas;
  const interactionCopy = language === "zh-CN"
    ? {
        clearFocus: "清除定位",
        revealed: "已滚动并高亮到画布",
        relatedOnly: "未找到精确目标，已尽量高亮相关对象",
        reviewQueue: "复核队列",
        reviewQueueHint: "接受或拒绝当前建议；被拒绝的动作会移到下方托盘。",
        rejectedTray: "已拒绝托盘",
        rejectedTrayHint: "这里的动作不会参与应用，恢复后会回到待复核状态。",
        activeQueueEmpty: "当前没有处于活动复核队列的动作。",
        restoreForReview: "恢复到复核",
        rejectedRecoverable: "此动作已移出活动队列，恢复后需要重新确认。",
        staleNeedsRevalidation: "此动作已从拒绝托盘恢复，当前标记为待复核，重新接受后才会进入可应用集合。",
        stateLabels: {
          pending: "待处理",
          stale: "待复核",
          accepted: "已接受",
          rejected: "已拒绝",
          applied: "已应用",
        },
      }
      : {
        clearFocus: "Clear reveal",
        revealed: "Scrolled and highlighted on canvas",
        relatedOnly: "No exact match found, highlighting the closest related object instead",
        reviewQueue: "Review queue",
        reviewQueueHint: "Accept or reject the current proposal; rejected actions move into the tray below.",
        rejectedTray: "Rejected tray",
        rejectedTrayHint: "Actions parked here stay out of apply until they are restored and reviewed again.",
        activeQueueEmpty: "No actions are currently in the active review queue.",
        restoreForReview: "Restore for review",
        rejectedRecoverable: "This action has been removed from the active queue and must be revalidated after restore.",
        staleNeedsRevalidation: "This restored action is marked stale and needs re-acceptance before it can be trusted for apply.",
        stateLabels: {
          pending: "Pending",
          stale: "Needs revalidation",
          accepted: "Accepted",
          rejected: "Rejected",
          applied: "Applied",
        },
      };

  function renderTargetChip(source: PlannerSource, originId: string, target: PlannerTargetRef, extraClassName?: string) {
    const isFocused = targetLocalization?.source === source && targetLocalization.originId === originId && targetLocalization.targetId === target.id;

    return (
      <button
        aria-pressed={isFocused}
        className={`token-chip clickable-chip${extraClassName ? ` ${extraClassName}` : ""}${isFocused ? " is-focused" : ""}`}
        key={`${originId}-${target.id}-${target.label}`}
        onClick={() => focusTargetRef(source, originId, target)}
        type="button"
      >
        {target.label}
      </button>
    );
  }

  function renderPlannerActionCard(source: PlannerSource, action: PlannerAction, location: "active" | "rejected") {
    const actionState = getActionState(source, action.id);
    const isFocused = targetLocalization?.source === source && targetLocalization.originId === action.id;
    const actionStateLabel = interactionCopy.stateLabels[actionState];
    const isApplied = actionState === "applied";
    const isBlocked = action.bucket === "blocked";
    const isStale = actionState === "stale";
    const isRejectedTrayCard = location === "rejected";

    return (
      <article className={`action-card decision-${actionState}${isRejectedTrayCard ? " in-rejected-tray" : ""}${isFocused ? " is-focused" : ""}`} key={action.id}>
        <div className="action-header-row">
          <strong>{action.label}</strong>
          <span className={`decision-badge decision-${actionState}`}>{actionStateLabel}</span>
        </div>
        <p>{action.expectedVisualResult}</p>
        <div className="token-list">
          {action.targetRefs.map((target) => renderTargetChip(source, action.id, target))}
        </div>
        {isFocused ? (
          <p className="action-location-note">{targetLocalization?.matchedNodeId ? interactionCopy.revealed : interactionCopy.relatedOnly}</p>
        ) : null}
        <div className="prompt-actions-row">
          {isRejectedTrayCard ? (
            <button className="secondary-button subtle-button" onClick={() => reviewPlannerAction(source, action.id, "restore")} type="button">
              {interactionCopy.restoreForReview}
            </button>
          ) : (
            <>
              <button
                className={`secondary-button${actionState === "accepted" ? " is-current-decision" : ""}`}
                disabled={isBlocked || isApplied}
                onClick={() => reviewPlannerAction(source, action.id, "accept")}
                type="button"
              >
                {copy.actions.accept}
              </button>
              <button
                className={`secondary-button${actionState === "rejected" ? " is-current-decision" : ""}`}
                disabled={isApplied}
                onClick={() => reviewPlannerAction(source, action.id, "reject")}
                type="button"
              >
                {copy.actions.reject}
              </button>
            </>
          )}
        </div>
        {actionState === "rejected" ? <p className="action-recovery-note">{interactionCopy.rejectedRecoverable}</p> : null}
        {isStale ? (
          <div className="action-stale-block">
            <p className="action-stale-note">{interactionCopy.staleNeedsRevalidation}</p>
            <p className="action-stale-reason">
              {language === "zh-CN"
                ? "此动作之前被拒绝，恢复后目标对象可能已发生变化。请重新确认目标是否正确。"
                : "This action was previously rejected. After restore, target objects may have changed. Please reconfirm the target is still correct."}
            </p>
            <button
              className="secondary-button stale-revalidate-button"
              onClick={() => {
                if (action.targetRefs.length > 0) {
                  focusTargetRef(source, action.id, action.targetRefs[0]);
                }
              }}
              type="button"
            >
              {language === "zh-CN" ? "重新定位目标" : "Reveal target"}
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  function renderPlannerActionSections(source: PlannerSource, actions: PlannerAction[]) {
    const activeActions = actions.filter((action) => getActionState(source, action.id) !== "rejected");
    const rejectedActions = actions.filter((action) => getActionState(source, action.id) === "rejected");

    return (
      <div className="action-review-groups">
        <section className="action-section">
          <div className="action-section-header">
            <strong>{interactionCopy.reviewQueue}</strong>
            <span className="action-section-note">{interactionCopy.reviewQueueHint}</span>
          </div>
          {activeActions.length > 0 ? (
            <div className="action-list">
              {activeActions.map((action) => renderPlannerActionCard(source, action, "active"))}
            </div>
          ) : (
            <p className="technical-note">{interactionCopy.activeQueueEmpty}</p>
          )}
        </section>

        {rejectedActions.length > 0 ? (
          <section className="action-section rejected-action-section">
            <div className="action-section-header">
              <strong>{interactionCopy.rejectedTray}</strong>
              <span className="action-section-note">{interactionCopy.rejectedTrayHint}</span>
            </div>
            <div className="action-list is-rejected-tray">
              {rejectedActions.map((action) => renderPlannerActionCard(source, action, "rejected"))}
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header panel">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.lede}</p>
        </div>

        <div className="header-summary-group">
          <div className="language-switch" aria-label={copy.labels.languageToggle} role="group">
            <button className={language === "en" ? "is-active" : undefined} onClick={() => setLanguage("en")} type="button">
              {copy.actions.english}
            </button>
            <button className={language === "zh-CN" ? "is-active" : undefined} onClick={() => setLanguage("zh-CN")} type="button">
              {copy.actions.chinese}
            </button>
          </div>

          <dl className="summary-grid">
            <div>
              <dt>{copy.summary.fixture}</dt>
              <dd>examples/minimal-compose-request.json</dd>
            </div>
            <div>
              <dt>{copy.summary.canvas}</dt>
              <dd>
                {scene.canvas.width} × {scene.canvas.height}
              </dd>
            </div>
            <div>
              <dt>{copy.summary.source}</dt>
              <dd>{scene.source.normalizedUri}</dd>
            </div>
            <div>
              <dt>{copy.summary.regenerate}</dt>
              <dd>/regenerate-node</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="workflow-bar panel">
        <button className="primary-button" onClick={triggerFigureFilePicker} type="button">
          {copy.actions.uploadFigure}
        </button>
        <button className="primary-button" onClick={triggerFigureFilePicker} type="button">
          {copy.actions.parseAndSplitFigure}
        </button>
        <button className="secondary-button" disabled={!figureWorkbenchState.analysis} onClick={handleImportDetectedPanels} type="button">
          {figureWorkbenchState.analysis?.backendDrafts ? copy.actions.autoImport : copy.actions.importPanels}
        </button>
        <button className="secondary-button" disabled={!figureWorkbenchState.analysis} onClick={handleAnalyzeImportedSemantics} type="button">
          {copy.actions.analyzeImportedSemantics}
        </button>
      </section>

      <main className="editor-layout">
        <aside className="panel sidebar-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">{copy.sections.layers}</p>
              <h2>
                {layers.length} {copy.labels.nodes}
              </h2>
            </div>
          </div>

          <div className="layer-list" role="list">
            {layers.map((node) => (
              <button
                key={node.id}
                className={`layer-item${selectedNodeId === node.id ? " is-active" : ""}`}
                onClick={() => setSelectedNodeId(node.id)}
                type="button"
              >
                <span className="layer-meta">
                  <strong>{describeNode(node)}</strong>
                  <span>
                    {formatNodeType(node, language)} · z{node.zIndex}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <div className="stack-controls">
            <button disabled={!stackState?.canMoveForward} onClick={() => handleLayerMove("forward")} type="button">
              {copy.actions.bringForward}
            </button>
            <button disabled={!stackState?.canMoveBackward} onClick={() => handleLayerMove("backward")} type="button">
              {copy.actions.sendBackward}
            </button>
          </div>

          <div className="property-block advanced-tools-block">
            <details>
              <summary>{copy.sections.promptPlanner}</summary>
              <div className="advanced-tool-content">
                <p className="library-hint">{copy.messages.promptHint}</p>
                <label>
                  <span>{copy.labels.prompt}</span>
                  <textarea
                    onChange={(event) => setAnalyzeState((currentState) => ({ ...currentState, prompt: event.target.value }))}
                    rows={5}
                    value={analyzeState.prompt}
                  />
                </label>
                <div className="prompt-actions-row">
                  <button className="secondary-button" onClick={handleAnalyzePrompt} type="button">
                    {copy.actions.analyzePrompt}
                  </button>
                  <button className="secondary-button" disabled={!analyzeState.response || analyzeState.acceptedActionIds.length === 0} onClick={handleApplyPromptStructure} type="button">
                    {copy.actions.applyStructure}
                  </button>
                </div>
                <div className="response-panel compact-response-panel">
                  <div className="response-header">
                    <strong>{copy.labels.analysisStatus}</strong>
                    {analyzeState.mode ? <span className={`mode-badge mode-${analyzeState.mode}`}>{analyzeState.mode}</span> : null}
                  </div>
                  {analyzeState.response ? (
                    <>
                      <p>{analyzeState.response.summary}</p>
                      <div className="token-list">
                        {analyzeState.response.entities.map((entity) => (
                          <span className="token-chip" key={entity.id}>
                            {entity.label}
                            {entity.libraryItemId ? ` · ${entity.libraryItemId}` : ""}
                          </span>
                        ))}
                      </div>
                      <div className="token-list relation-list">
                        {analyzeState.response.relations.map((relation) => (
                          <span className="token-chip relation-chip" key={relation.id}>
                            {relation.semantics}
                          </span>
                        ))}
                      </div>
                      <div className="response-subsection">
                        <strong>{copy.labels.proposedActions}</strong>
                        {analyzeState.response.actions.length > 0 ? (
                          renderPlannerActionSections("analysis", analyzeState.response.actions)
                        ) : (
                          <p>{copy.messages.noActions}</p>
                        )}
                      </div>
                      {analyzeState.message ? <p className="technical-note">{analyzeState.message}</p> : null}
                    </>
                  ) : (
                    <p>{copy.messages.noPromptAnalysis}</p>
                  )}
                </div>
              </div>
            </details>

            <details>
              <summary>{copy.sections.reconstruction}</summary>
              <div className="advanced-tool-content">
                <label>
                  <span>{copy.labels.problemNotes}</span>
                  <textarea
                    onChange={(event) => setReconstructState((currentState) => ({ ...currentState, problemNotes: event.target.value }))}
                    rows={4}
                    value={reconstructState.problemNotes}
                  />
                </label>
                <div className="prompt-actions-row">
                  <button className="secondary-button" onClick={handleReconstructFigure} type="button">
                    {copy.actions.reconstructFigure}
                  </button>
                  <button className="secondary-button" disabled={!reconstructState.response || reconstructState.acceptedActionIds.length === 0} onClick={handleApplyReconstruction} type="button">
                    {copy.actions.applyReconstruction}
                  </button>
                </div>
                <div className="response-panel compact-response-panel">
                  <div className="response-header">
                    <strong>{copy.labels.reconstructionStatus}</strong>
                    {reconstructState.mode ? <span className={`mode-badge mode-${reconstructState.mode}`}>{reconstructState.mode}</span> : null}
                  </div>
                  {reconstructState.response ? (
                    <>
                      <p>{reconstructState.response.correctedSummary}</p>
                      <div className="token-list relation-list">
                        {reconstructState.response.issues.map((issue, index) => (
                          <article className={`issue-card${targetLocalization?.source === "reconstruction" && targetLocalization.originId === `issue:${issue.code}:${index}` ? " is-focused" : ""}`} key={`${issue.code}-${index}`}>
                            <strong>{issue.code}</strong>
                            <p>{issue.message}</p>
                            <div className="token-list">
                              {(issue.targetRefs ?? []).map((target) => renderTargetChip("reconstruction", `issue:${issue.code}:${index}`, target, "issue-chip"))}
                            </div>
                          </article>
                        ))}
                      </div>
                      <div className="response-subsection">
                        <strong>{copy.labels.proposedActions}</strong>
                        {reconstructState.response.actions.length > 0 ? (
                          renderPlannerActionSections("reconstruction", reconstructState.response.actions)
                        ) : (
                          <p>{copy.messages.noActions}</p>
                        )}
                      </div>
                      {reconstructState.message ? <p className="technical-note">{reconstructState.message}</p> : null}
                    </>
                  ) : (
                    <p>{copy.messages.noReconstruction}</p>
                  )}
                </div>
              </div>
            </details>
          </div>

          <div className="property-block flow-layout-block">
            <p className="section-label">{copy.sections.flowLayout}</p>
            <p className="library-hint">{copy.messages.flowHint}</p>
            <label>
              <span>{copy.labels.flowInput}</span>
              <textarea
                onChange={(event) => setFlowInput(event.target.value)}
                rows={5}
                value={flowInput}
              />
            </label>
            <button className="secondary-button" onClick={handleGenerateFlowLayout} type="button">
              {copy.actions.generateFlowLayout}
            </button>
          </div>

          <div className="property-block figure-workbench-block">
            <p className="section-label">{copy.sections.figureWorkbench}</p>
            <p className="library-hint">{copy.messages.figureWorkbenchHint}</p>
            <div className="import-workflow-card">
              <strong>{copy.labels.importWorkflow}</strong>
              <p>{copy.messages.quickImportHint}</p>
            </div>
            <input accept="image/*" hidden onChange={handleFigureFileSelected} ref={figureFileInputRef} type="file" />
            <label>
              <span>{copy.labels.contextNotes}</span>
              <textarea
                onChange={(event) => setFigureWorkbenchState((currentState) => ({ ...currentState, contextNotes: event.target.value }))}
                rows={4}
                value={figureWorkbenchState.contextNotes}
              />
            </label>
            <div className="prompt-actions-row">
              <button className="primary-button" onClick={triggerFigureFilePicker} type="button">
                {copy.actions.parseAndSplitFigure}
              </button>
              <button
                className="secondary-button"
                disabled={!figureWorkbenchState.analysis}
                onClick={handleImportDetectedPanels}
                type="button"
              >
                {figureWorkbenchState.analysis?.backendDrafts ? copy.actions.autoImport : copy.actions.importPanels}
              </button>
              <button
                className="secondary-button"
                disabled={!figureWorkbenchState.analysis || figureWorkbenchState.semanticStatus === "loading"}
                onClick={handleAnalyzeImportedSemantics}
                type="button"
              >
                {copy.actions.analyzeImportedSemantics}
              </button>
            </div>
            <div className="response-panel compact-response-panel figure-workbench-response">
              <div className="response-header">
                <strong>{copy.labels.sourceFigure}</strong>
                {figureWorkbenchState.semanticMode ? (
                  <span className={`mode-badge mode-${figureWorkbenchState.semanticMode}`}>{figureWorkbenchState.semanticMode}</span>
                ) : null}
              </div>
              {figureWorkbenchState.status === "loading" ? <p className="technical-note">{copy.messages.analyzingFigure}</p> : null}
              {figureWorkbenchState.status === "error" ? <p className="technical-note">{figureWorkbenchState.error}</p> : null}
              {figureWorkbenchState.analysis ? (
                <>
                  <div className="figure-source-card">
                    <img alt={figureWorkbenchState.analysis.sourceName} className="figure-source-preview" src={figureWorkbenchState.analysis.sourceDataUrl} />
                    <div className="figure-source-meta">
                      <strong>{figureWorkbenchState.analysis.sourceName}</strong>
                      <span>
                        {figureWorkbenchState.analysis.width} x {figureWorkbenchState.analysis.height}
                      </span>
                      <span>{figureWorkbenchState.analysis.summary}</span>
                    </div>
                  </div>
                  {figureWorkbenchState.analysis.mergedRecognizedText ? (
                    <label>
                      <span>{copy.labels.recognizedText}</span>
                      <textarea readOnly rows={3} value={figureWorkbenchState.analysis.mergedRecognizedText} />
                    </label>
                  ) : null}
                  {figureWorkbenchState.analysis.backendDrafts ? (
                    <div className="response-subsection">
                      <strong>{copy.labels.backendDrafts}</strong>
                      <div className="token-list">
                        {figureWorkbenchState.analysis.backendDrafts.draftNodes.map((node) => (
                          <span className="token-chip" key={node.id}>
                            {node.type} · {Math.round(node.bbox.width)}x{Math.round(node.bbox.height)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {figureWorkbenchState.analysis.detectedKeywords.length > 0 ? (
                    <div className="token-list">
                      {figureWorkbenchState.analysis.detectedKeywords.map((keyword) => (
                        <span className="token-chip" key={keyword}>
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <label>
                    <span>{copy.labels.recommendedPrompt}</span>
                    <textarea
                      onChange={(event) => setFigureWorkbenchState((currentState) => ({ ...currentState, recommendedPrompt: event.target.value }))}
                      rows={4}
                      value={figureWorkbenchState.recommendedPrompt}
                    />
                  </label>
                  <div className="response-subsection">
                    <strong>{copy.labels.detectedPanels}</strong>
                    {figureWorkbenchState.analysis.panels.length === 1 ? <p className="technical-note">{copy.messages.singlePanelDetected}</p> : null}
                    <div className="figure-panel-grid split-result-grid">
                      {figureWorkbenchState.analysis.panels.map((panel) => (
                        <article className="figure-panel-card split-result-card" key={panel.id}>
                          <img alt={panel.label} className="figure-panel-preview" src={panel.previewUri} />
                          <div className="figure-panel-meta">
                            <strong>{panel.label}</strong>
                            <span>{panel.roleHint}</span>
                            <span>
                              {Math.round(panel.bbox.width)} x {Math.round(panel.bbox.height)}
                            </span>
                            <span>confidence {Math.round(panel.confidence * 100)}%</span>
                          </div>
                          <div className="prompt-actions-row">
                            <button className="secondary-button" onClick={() => handleImportSinglePanel(panel.id)} type="button">
                              {copy.actions.importSinglePanel}
                            </button>
                            <button className="secondary-button" onClick={() => handleFocusPanel(panel.id)} type="button">
                              {copy.actions.previewPanel}
                            </button>
                          </div>
                          {panel.semanticHints.length > 0 ? (
                            <div className="figure-panel-hints">
                              <span>{copy.labels.semanticHints}</span>
                              <div className="token-list">
                                {panel.semanticHints.map((hint) => (
                                  <span className="token-chip relation-chip" key={`${panel.id}-${hint.id}`}>
                                    {hint.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {panel.recognizedText ? (
                            <div className="figure-panel-hints">
                              <span>
                                {copy.labels.recognizedText}
                                {panel.textConfidence !== null ? ` · ${panel.textConfidence}%` : ""}
                              </span>
                              <p className="figure-panel-text">{panel.recognizedText}</p>
                            </div>
                          ) : (
                            <div className="figure-panel-hints">
                              <span>{copy.labels.noOcrText}</span>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                  {figureWorkbenchState.semanticMessage ? <p className="technical-note">{figureWorkbenchState.semanticMessage}</p> : null}
                </>
              ) : (
                <p>{copy.messages.noFigureAnalysis}</p>
              )}
            </div>
          </div>

          <div className="property-block resource-block">
            <p className="section-label">{copy.sections.resources}</p>
            <p className="library-hint">{copy.messages.resourcesHint}</p>
            {recommendedLibraryItems.length > 0 ? (
              <div className="recommended-strip">
                <strong>{language === "zh-CN" ? "推荐给当前内容" : "Recommended for current content"}</strong>
                <div className="library-grid recommended-grid">
                  {recommendedLibraryItems.map((item) => (
                    <article className="library-card" key={`recommended-${item.id}`}>
                      <img alt={item.label} className="library-preview" src={item.previewUri} />
                      <div className="library-meta">
                        <strong>{item.label}</strong>
                        <span>{item.assetUri}</span>
                      </div>
                      <button className="secondary-button" onClick={() => handleLibraryApply(item.assetUri, item.label)} type="button">
                        {libraryActionLabel}
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="resource-grid">
              {MEDICAL_RESOURCE_CARDS.map((resource) => (
                <article className="resource-card" key={resource.id}>
                  <div className="resource-card-header">
                    <strong>{resource.title}</strong>
                    <span>{resource.license}</span>
                  </div>
                  <p>{resource.description[language]}</p>
                  <p>
                    <strong>{copy.labels.bestFor}:</strong> {resource.bestFor[language]}
                  </p>
                  <p>
                    <strong>{copy.labels.resourceLicense}:</strong> {resource.license}
                  </p>
                  <a className="resource-link" href={resource.url} rel="noreferrer" target="_blank">
                    {resource.url}
                  </a>
                </article>
              ))}
            </div>
          </div>

          <div className="property-block library-block">
            <p className="section-label">{copy.sections.library}</p>
            <p className="library-hint">{copy.messages.libraryHint}</p>
            <div className="library-toolbar">
              <input onChange={(event) => setLibraryQuery(event.target.value)} placeholder={language === "zh-CN" ? "搜索医学素材" : "Search medical assets"} type="text" value={libraryQuery} />
              <div className="library-filters">
                <button className={`secondary-button${libraryCategory === "all" ? " is-current-decision" : ""}`} onClick={() => setLibraryCategory("all")} type="button">
                  {language === "zh-CN" ? "全部" : "All"}
                </button>
                {libraryCategories.map((category) => (
                  <button
                    className={`secondary-button${libraryCategory === category.id ? " is-current-decision" : ""}`}
                    key={category.id}
                    onClick={() => setLibraryCategory(category.id)}
                    type="button"
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="library-grid">
              {filteredLibraryItems.map((item) => (
                <article className="library-card" key={item.id}>
                  <img alt={item.label} className="library-preview" src={item.previewUri} />
                  <div className="library-meta">
                    <strong>{item.label}</strong>
                    <span>{item.assetUri}</span>
                  </div>
                  <button className="secondary-button" onClick={() => handleLibraryApply(item.assetUri, item.label)} type="button">
                    {libraryActionLabel}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </aside>

        <section className="panel canvas-panel">
          <div className="panel-heading canvas-heading">
            <div>
              <p className="section-label">{copy.sections.canvas}</p>
              <h2>{copy.labels.canvasHelp}</h2>
            </div>
              <div className="canvas-tools">
                <span className="status-pill">
                  {selectedNode ? `${copy.labels.selected}: ${describeNode(selectedNode)}` : copy.labels.noSelection}
                </span>
                <button className="primary-button" onClick={triggerFigureFilePicker} type="button">
                  {copy.actions.parseAndSplitFigure}
                </button>
                <div className="zoom-controls" role="group" aria-label={copy.labels.zoom}>
                  <button onClick={() => handleCanvasScaleChange(canvasScale - CANVAS_SCALE_STEP)} type="button">
                    {copy.actions.zoomOut}
                </button>
                <button onClick={handleFitCanvas} type="button">
                  {copy.actions.resetZoom}
                </button>
                <button onClick={() => handleCanvasScaleChange(canvasScale + CANVAS_SCALE_STEP)} type="button">
                  {copy.actions.zoomIn}
                </button>
                <span className="zoom-value">{Math.round(canvasScale * 100)}%</span>
              </div>
            </div>
          </div>

          {targetLocalization ? (
            <div className={`canvas-focus-banner${targetLocalization.matchedNodeId ? " is-resolved" : " is-partial"}`}>
              <div className="canvas-focus-copy">
                <strong>{targetLocalization.targetLabel}</strong>
                <span>{targetLocalization.matchedNodeId ? interactionCopy.revealed : interactionCopy.relatedOnly}</span>
              </div>
              <button className="secondary-button subtle-button" onClick={clearTargetLocalization} type="button">
                {interactionCopy.clearFocus}
              </button>
            </div>
          ) : null}

          <div className={`canvas-scroll${targetLocalization ? " is-localizing" : ""}`} ref={canvasViewportRef}>
            <div className="canvas-stage">
              {scene.nodes.length === 0 ? (
                <div className="canvas-empty-state">
                  <strong>{copy.actions.parseAndSplitFigure}</strong>
                  <p>{copy.messages.canvasEmptyHint}</p>
                </div>
              ) : null}
              <EditorCanvas
                highlightTargets={focusedTargets}
                onSceneChange={setScene}
                onSelectNode={setSelectedNodeId}
                scene={scene}
                selectedNodeId={selectedNodeId}
                viewScale={canvasScale}
              />
            </div>
          </div>
        </section>

        <aside className="panel properties-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">{copy.sections.properties}</p>
              <h2>{selectedNode ? describeNode(selectedNode) : copy.labels.pickNode}</h2>
            </div>
          </div>

          {selectedNode ? (
            <>
              <div className="property-block">
                <label>
                  <span>{copy.labels.type}</span>
                  <input readOnly type="text" value={formatNodeType(selectedNode, language)} />
                </label>
                <label>
                  <span>{copy.labels.x}</span>
                  <input
                    className={xMeta?.invalid ? "is-invalid" : xMeta?.dirty ? "is-dirty" : undefined}
                    onBlur={() => commitNumericDraft("x")}
                    onChange={(event) => handleNumericDraftChange("x", event.target.value)}
                    onKeyDown={(event) => handleNumericFieldKeyDown("x", event)}
                    step="1"
                    type="number"
                    value={xMeta?.value ?? ""}
                  />
                </label>
                <label>
                  <span>{copy.labels.y}</span>
                  <input
                    className={yMeta?.invalid ? "is-invalid" : yMeta?.dirty ? "is-dirty" : undefined}
                    onBlur={() => commitNumericDraft("y")}
                    onChange={(event) => handleNumericDraftChange("y", event.target.value)}
                    onKeyDown={(event) => handleNumericFieldKeyDown("y", event)}
                    step="1"
                    type="number"
                    value={yMeta?.value ?? ""}
                  />
                </label>
                <label>
                  <span>{copy.labels.width}</span>
                  <input
                    className={widthMeta?.invalid ? "is-invalid" : widthMeta?.dirty ? "is-dirty" : undefined}
                    min={1}
                    onBlur={() => commitNumericDraft("width")}
                    onChange={(event) => handleNumericDraftChange("width", event.target.value)}
                    onKeyDown={(event) => handleNumericFieldKeyDown("width", event)}
                    step="1"
                    type="number"
                    value={widthMeta?.value ?? ""}
                  />
                </label>
                <label>
                  <span>{copy.labels.height}</span>
                  <input
                    className={heightMeta?.invalid ? "is-invalid" : heightMeta?.dirty ? "is-dirty" : undefined}
                    disabled={selectedNode.type === "text"}
                    min={1}
                    onBlur={() => commitNumericDraft("height")}
                    onChange={(event) => handleNumericDraftChange("height", event.target.value)}
                    onKeyDown={(event) => handleNumericFieldKeyDown("height", event)}
                    readOnly={selectedNode.type === "text"}
                    step="1"
                    type="number"
                    value={heightMeta?.value ?? ""}
                  />
                </label>
                <label>
                  <span>{copy.labels.zIndex}</span>
                  <input
                    className={zIndexMeta?.invalid ? "is-invalid" : zIndexMeta?.dirty ? "is-dirty" : undefined}
                    min={0}
                    onBlur={() => commitNumericDraft("zIndex")}
                    onChange={(event) => handleNumericDraftChange("zIndex", event.target.value)}
                    onKeyDown={(event) => handleNumericFieldKeyDown("zIndex", event)}
                    step="1"
                    type="number"
                    value={zIndexMeta?.value ?? ""}
                  />
                </label>
              </div>

              {isTextNode(selectedNode) ? (
                <div className="property-block">
                  <label>
                    <span>{copy.labels.text}</span>
                    <textarea
                      onChange={(event) => {
                        updateSceneNode(selectedNode.id, (node) =>
                          node.type === "text"
                            ? {
                                ...node,
                                text: event.target.value,
                              }
                            : node,
                        );
                      }}
                      rows={5}
                      value={selectedNode.text}
                    />
                  </label>
                  <label>
                    <span>{copy.labels.fontSize}</span>
                    <input
                      min={1}
                      onChange={(event) => {
                        updateSceneNode(selectedNode.id, (node) =>
                          node.type === "text"
                            ? {
                                ...node,
                                style: {
                                  ...node.style,
                                  fontSize: clampFontSize(event.target.valueAsNumber),
                                },
                              }
                            : node,
                        );
                      }}
                      type="number"
                      value={selectedNode.style.fontSize}
                    />
                  </label>
                  <label>
                    <span>{copy.labels.color}</span>
                    <input
                      onChange={(event) => {
                        updateSceneNode(selectedNode.id, (node) =>
                          node.type === "text"
                            ? {
                                ...node,
                                style: {
                                  ...node.style,
                                  color: event.target.value,
                                },
                              }
                            : node,
                        );
                      }}
                      type="color"
                      value={selectedNode.style.color}
                    />
                  </label>
                </div>
              ) : null}

              {isImageNode(selectedNode) ? (
                <div className="property-block">
                  <p className="section-label current-asset-label">{copy.labels.currentAsset}</p>
                  <div className="variant-card current-asset-card">
                    <img alt={copy.labels.currentAsset} className="variant-preview" src={renderCurrentImagePreview()} />
                    <div className="variant-meta">
                      <strong>{describeNode(selectedNode)}</strong>
                      <span>{selectedNode.asset.uri}</span>
                    </div>
                  </div>

                  <label>
                    <span>{copy.labels.assetUri}</span>
                    <input readOnly type="text" value={selectedNode.asset.uri} />
                  </label>
                  <label>
                    <span>{copy.labels.prompt}</span>
                    <textarea
                      onChange={(event) => {
                        setRegenerateState((currentState) => ({
                          ...currentState,
                          prompt: event.target.value,
                        }));
                      }}
                      rows={4}
                      value={regenerateState.prompt}
                    />
                  </label>
                  <label>
                    <span>{copy.labels.feedback}</span>
                    <textarea
                      onChange={(event) => {
                        setRegenerateState((currentState) => ({
                          ...currentState,
                          feedback: event.target.value,
                        }));
                      }}
                      rows={3}
                      value={regenerateState.feedback}
                    />
                  </label>
                  <button className="primary-button" disabled={regenerateState.status === "loading"} onClick={handleRegenerate} type="button">
                    {regenerateState.status === "loading" ? copy.actions.regenerating : copy.actions.regenerate}
                  </button>

                  <div className="response-panel">
                    <div className="response-header">
                      <strong>{copy.labels.regenerateStatus}</strong>
                      {regenerateState.mode ? <span className={`mode-badge mode-${regenerateState.mode}`}>{regenerateState.mode}</span> : null}
                    </div>
                    <p>{getRegenerateSummary(language, regenerateState)}</p>
                    {regenerateState.message ? (
                      <p className="technical-note">
                        <strong>{copy.labels.fallbackDetail}:</strong> {regenerateState.message}
                      </p>
                    ) : null}

                    <div className="variants-header-row">
                      <strong>{copy.sections.generatedVariants}</strong>
                    </div>

                    {regenerateState.response ? (
                      <div className="variant-grid">
                        {regenerateState.response.variants.map((variant) => {
                          const isApplied = regenerateState.appliedVariantId === variant.id;
                          return (
                            <article className={`variant-card${isApplied ? " is-applied" : ""}`} key={variant.id}>
                              <img alt={variant.id} className="variant-preview" src={renderVariantPreviewSource(variant)} />
                              <div className="variant-meta">
                                <strong>{variant.id}</strong>
                                <span>{variant.previewUri}</span>
                              </div>
                              <button className="secondary-button" onClick={() => applyVariant(variant)} type="button">
                                {isApplied ? copy.actions.applied : copy.actions.applyVariant}
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p>{copy.messages.noVariants}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">{copy.messages.emptySelection}</div>
          )}
        </aside>
      </main>
    </div>
  );
}

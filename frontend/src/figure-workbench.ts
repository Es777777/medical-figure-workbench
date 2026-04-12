import type { AnalyzeAssetResponse, AnalyzePromptResponse } from "@shared/api-contracts";
import type { SceneGraph, SceneNode } from "@shared/scene-graph";

import type { Language } from "./copy";
import { getElementLibrary, getLibraryItemById } from "./element-library";

export type FigureSemanticHint = {
  id: string;
  label: string;
  category: ReturnType<typeof getElementLibrary>[number]["category"];
  score: number;
};

export type DetectedFigurePanel = {
  id: string;
  label: string;
  roleHint: "context" | "process" | "outcome" | "entity";
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  previewUri: string;
  confidence: number;
  semanticHints: FigureSemanticHint[];
  recognizedText: string;
  textConfidence: number | null;
};

export type FigureWorkbenchAnalysis = {
  sourceName: string;
  sourceDataUrl: string;
  width: number;
  height: number;
  summary: string;
  recommendedPrompt: string;
  detectedKeywords: string[];
  panels: DetectedFigurePanel[];
  mergedRecognizedText: string;
  backendDrafts: AnalyzeAssetResponse | null;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SplitAxis = "horizontal" | "vertical";

type SplitCandidate = {
  axis: SplitAxis;
  start: number;
  end: number;
  score: number;
};

const MAX_ANALYSIS_DIMENSION = 1200;
const MAX_PANEL_COUNT = 6;
const MAX_SPLIT_DEPTH = 3;
const MIN_PANEL_SIZE = 96;
const OCR_TEXT_LIMIT = 120;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Could not decode ${file.name}`));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the selected figure image."));
    image.src = source;
  });
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(Math.round(width), 1);
  canvas.height = Math.max(Math.round(height), 1);
  return canvas;
}

function getContext2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is not available in this browser.");
  }
  return context;
}

function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(Math.floor(rect.x), 0);
  const y = Math.max(Math.floor(rect.y), 0);
  const safeWidth = Math.min(Math.ceil(rect.width), width - x);
  const safeHeight = Math.min(Math.ceil(rect.height), height - y);
  return {
    x,
    y,
    width: Math.max(safeWidth, 1),
    height: Math.max(safeHeight, 1),
  };
}

function getPixelDarkness(data: Uint8ClampedArray, imageWidth: number, x: number, y: number): number {
  const offset = (y * imageWidth + x) * 4;
  const alpha = data[offset + 3] / 255;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return (1 - luminance) * alpha;
}

function buildAxisDarkness(imageData: ImageData, rect: Rect, axis: SplitAxis): number[] {
  const values: number[] = [];
  const step = Math.max(Math.floor((axis === "horizontal" ? rect.width : rect.height) / 180), 1);
  const startX = Math.floor(rect.x);
  const startY = Math.floor(rect.y);
  const endX = Math.floor(rect.x + rect.width);
  const endY = Math.floor(rect.y + rect.height);

  if (axis === "vertical") {
    for (let x = startX; x < endX; x += 1) {
      let total = 0;
      let count = 0;
      for (let y = startY; y < endY; y += step) {
        total += getPixelDarkness(imageData.data, imageData.width, x, y);
        count += 1;
      }
      values.push(count > 0 ? total / count : 0);
    }
    return values;
  }

  for (let y = startY; y < endY; y += 1) {
    let total = 0;
    let count = 0;
    for (let x = startX; x < endX; x += step) {
      total += getPixelDarkness(imageData.data, imageData.width, x, y);
      count += 1;
    }
    values.push(count > 0 ? total / count : 0);
  }

  return values;
}

function findBestWhitespaceSplit(values: number[], axisLength: number, crossLength: number, axis: SplitAxis): SplitCandidate | null {
  if (values.length < MIN_PANEL_SIZE * 2) {
    return null;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const threshold = Math.max(0.012, Math.min(0.055, mean * 0.42 + 0.008));
  const edgeMargin = Math.max(Math.round(axisLength * 0.05), 10);
  const minRun = Math.max(Math.round(axisLength * 0.018), 8);
  const minPanel = Math.max(Math.round(axisLength * 0.18), MIN_PANEL_SIZE);

  let best: SplitCandidate | null = null;
  let runStart = -1;

  function commitRun(runEnd: number) {
    if (runStart === -1) {
      return;
    }
    const runLength = runEnd - runStart;
    const splitCenter = Math.round((runStart + runEnd) / 2);
    const leftSize = splitCenter;
    const rightSize = axisLength - splitCenter;
    if (
      runLength < minRun ||
      runStart <= edgeMargin ||
      runEnd >= axisLength - edgeMargin ||
      leftSize < minPanel ||
      rightSize < minPanel
    ) {
      runStart = -1;
      return;
    }

    let runDarkness = 0;
    for (let index = runStart; index < runEnd; index += 1) {
      runDarkness += values[index] ?? 0;
    }
    const averageRunDarkness = runDarkness / Math.max(runLength, 1);
    const whiteness = Math.max(0, threshold - averageRunDarkness) / threshold;
    const balance = Math.min(leftSize, rightSize) / Math.max(leftSize, rightSize);
    const score = runLength * (0.7 + whiteness) * (0.75 + balance) * (crossLength > axisLength ? 1.08 : 1);

    if (!best || score > best.score) {
      best = {
        axis,
        start: runStart,
        end: runEnd,
        score,
      };
    }

    runStart = -1;
  }

  values.forEach((value, index) => {
    if (value <= threshold) {
      if (runStart === -1) {
        runStart = index;
      }
      return;
    }
    commitRun(index);
  });

  commitRun(values.length);
  return best;
}

function splitRect(rect: Rect, candidate: SplitCandidate): [Rect, Rect] {
  const gutterStart = candidate.start;
  const gutterEnd = candidate.end;
  if (candidate.axis === "vertical") {
    return [
      { x: rect.x, y: rect.y, width: gutterStart, height: rect.height },
      { x: rect.x + gutterEnd, y: rect.y, width: rect.width - gutterEnd, height: rect.height },
    ];
  }

  return [
    { x: rect.x, y: rect.y, width: rect.width, height: gutterStart },
    { x: rect.x, y: rect.y + gutterEnd, width: rect.width, height: rect.height - gutterEnd },
  ];
}

function detectPanelRects(imageData: ImageData, rect: Rect, depth = 0): Rect[] {
  if (depth >= MAX_SPLIT_DEPTH || rect.width < MIN_PANEL_SIZE * 2 || rect.height < MIN_PANEL_SIZE * 2) {
    return [rect];
  }

  const verticalCandidate = findBestWhitespaceSplit(
    buildAxisDarkness(imageData, rect, "vertical"),
    Math.round(rect.width),
    Math.round(rect.height),
    "vertical",
  );
  const horizontalCandidate = findBestWhitespaceSplit(
    buildAxisDarkness(imageData, rect, "horizontal"),
    Math.round(rect.height),
    Math.round(rect.width),
    "horizontal",
  );

  const bestCandidate = [verticalCandidate, horizontalCandidate]
    .filter((candidate): candidate is SplitCandidate => candidate !== null)
    .sort((left, right) => right.score - left.score)[0] ?? null;

  if (!bestCandidate || bestCandidate.score < 8) {
    return [rect];
  }

  const [firstRect, secondRect] = splitRect(rect, bestCandidate);
  return [...detectPanelRects(imageData, firstRect, depth + 1), ...detectPanelRects(imageData, secondRect, depth + 1)];
}

function sortRectsReadingOrder(rects: Rect[]): Rect[] {
  return [...rects].sort((left, right) => {
    const rowTolerance = Math.max(Math.min(left.height, right.height) * 0.35, 18);
    if (Math.abs(left.y - right.y) > rowTolerance) {
      return left.y - right.y;
    }
    return left.x - right.x;
  });
}

function estimateRectDifference(left: Rect, right: Rect): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) + Math.abs(left.width - right.width) + Math.abs(left.height - right.height);
}

function buildFallbackGridRects(width: number, height: number): Rect[] {
  const aspectRatio = width / Math.max(height, 1);
  if (width < MIN_PANEL_SIZE * 2 || height < MIN_PANEL_SIZE * 2) {
    return [{ x: 0, y: 0, width, height }];
  }

  if (aspectRatio >= 1.7) {
    const halfWidth = Math.floor(width / 2);
    return [
      { x: 0, y: 0, width: halfWidth, height },
      { x: halfWidth, y: 0, width: width - halfWidth, height },
    ];
  }

  if (aspectRatio <= 0.72) {
    const halfHeight = Math.floor(height / 2);
    return [
      { x: 0, y: 0, width, height: halfHeight },
      { x: 0, y: halfHeight, width, height: height - halfHeight },
    ];
  }

  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  return [
    { x: 0, y: 0, width: halfWidth, height: halfHeight },
    { x: halfWidth, y: 0, width: width - halfWidth, height: halfHeight },
    { x: 0, y: halfHeight, width: halfWidth, height: height - halfHeight },
    { x: halfWidth, y: halfHeight, width: width - halfWidth, height: height - halfHeight },
  ];
}

function cropRectToDataUrl(image: HTMLImageElement, rect: Rect): string {
  const safeRect = clampRect(rect, image.naturalWidth || image.width, image.naturalHeight || image.height);
  const canvas = createCanvas(safeRect.width, safeRect.height);
  const context = getContext2d(canvas);
  context.drawImage(
    image,
    safeRect.x,
    safeRect.y,
    safeRect.width,
    safeRect.height,
    0,
    0,
    safeRect.width,
    safeRect.height,
  );
  return canvas.toDataURL("image/png");
}

async function recognizePanelText(previewUri: string, language: Language): Promise<{ text: string; confidence: number | null }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(language === "zh-CN" ? ["eng", "chi_sim"] : ["eng"]);
  try {
    const result = await worker.recognize(previewUri);
    const text = result.data.text
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, OCR_TEXT_LIMIT);
    const confidence = Number.isFinite(result.data.confidence) ? Math.round(result.data.confidence) : null;
    return { text, confidence };
  } finally {
    await worker.terminate();
  }
}

async function enrichPanelsWithOcr(panels: Omit<DetectedFigurePanel, "recognizedText" | "textConfidence">[], language: Language): Promise<DetectedFigurePanel[]> {
  return Promise.all(
    panels.map(async (panel) => {
      try {
        const ocr = await recognizePanelText(panel.previewUri, language);
        return {
          ...panel,
          recognizedText: ocr.text,
          textConfidence: ocr.confidence,
        };
      } catch {
        return {
          ...panel,
          recognizedText: "",
          textConfidence: null,
        };
      }
    }),
  );
}

function sanitizeKeywordSource(input: string): string {
  return input
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractDetectedKeywords(sourceName: string, contextNotes: string, language: Language): string[] {
  const combined = sanitizeKeywordSource(`${sourceName} ${contextNotes}`);
  const libraryItems = getElementLibrary(language);
  const matches: Array<{ keyword: string; score: number }> = [];

  for (const item of libraryItems) {
    const score = item.keywords.reduce((total, keyword) => total + (combined.includes(keyword.toLowerCase()) ? 1 : 0), 0);
    if (score > 0) {
      matches.push({ keyword: item.label, score });
    }
  }

  return matches
    .sort((left, right) => right.score - left.score || left.keyword.localeCompare(right.keyword))
    .slice(0, 4)
    .map((entry) => entry.keyword);
}

function buildSemanticHints(sourceName: string, contextNotes: string, language: Language, roleHint: DetectedFigurePanel["roleHint"]): FigureSemanticHint[] {
  const combined = sanitizeKeywordSource(`${sourceName} ${contextNotes}`);
  const libraryItems = getElementLibrary(language);
  const scored: FigureSemanticHint[] = libraryItems
    .map((item) => {
      const keywordScore = item.keywords.reduce((score, keyword) => score + (combined.includes(keyword.toLowerCase()) ? 2 : 0), 0);
      const roleScore = item.semanticRoles.includes(roleHint) ? 1 : 0;
      const total = keywordScore + roleScore;
      return total > 0
        ? {
            id: item.id,
            label: item.label,
            category: item.category,
            score: total,
          }
        : null;
    })
    .filter((entry): entry is FigureSemanticHint => entry !== null)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));

  return scored.slice(0, 3);
}

function buildRecommendedPrompt(
  fileName: string,
  contextNotes: string,
  panels: DetectedFigurePanel[],
  semanticResponse: AnalyzePromptResponse | null,
  language: Language,
): string {
  const panelSummary = panels
    .map(
      (panel) =>
        `${panel.label} (${panel.roleHint}${panel.semanticHints.length > 0 ? `: ${panel.semanticHints.map((hint) => hint.label).join(", ")}` : ""}${panel.recognizedText ? `; text ${panel.recognizedText}` : ""})`,
    )
    .join(language === "zh-CN" ? "；" : "; ");

  if (semanticResponse && semanticResponse.entities.length > 0) {
    return semanticResponse.entities.map((entity) => entity.label).join(language === "zh-CN" ? "、" : ", ");
  }

  return [
    language === "zh-CN" ? `来源文件：${fileName}` : `Source file: ${fileName}`,
    contextNotes.trim(),
    panelSummary,
  ]
    .filter(Boolean)
    .join(language === "zh-CN" ? "。" : ". ");
}

export async function analyzeFigureFile(file: File, contextNotes: string, language: Language): Promise<FigureWorkbenchAnalysis> {
  const sourceDataUrl = await fileToDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_ANALYSIS_DIMENSION / Math.max(naturalWidth, naturalHeight));
  const analysisWidth = Math.max(Math.round(naturalWidth * scale), 1);
  const analysisHeight = Math.max(Math.round(naturalHeight * scale), 1);
  const analysisCanvas = createCanvas(analysisWidth, analysisHeight);
  const analysisContext = getContext2d(analysisCanvas);
  analysisContext.drawImage(image, 0, 0, analysisWidth, analysisHeight);
  const imageData = analysisContext.getImageData(0, 0, analysisWidth, analysisHeight);
  const scaledRects = detectPanelRects(imageData, { x: 0, y: 0, width: analysisWidth, height: analysisHeight })
    .map((rect) => ({
      x: rect.x / scale,
      y: rect.y / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    }))
    .map((rect) => clampRect(rect, naturalWidth, naturalHeight));

  const uniqueRects: Rect[] = [];
  for (const rect of scaledRects) {
    const hasMatch = uniqueRects.some(
      (candidate) =>
        Math.abs(candidate.x - rect.x) <= 4 &&
        Math.abs(candidate.y - rect.y) <= 4 &&
        Math.abs(candidate.width - rect.width) <= 4 &&
        Math.abs(candidate.height - rect.height) <= 4,
    );
    if (!hasMatch) {
      uniqueRects.push(rect);
    }
  }

  const readingOrderRects = sortRectsReadingOrder(uniqueRects).slice(0, MAX_PANEL_COUNT);
  const resolvedRects =
    readingOrderRects.length === 1 && estimateRectDifference(readingOrderRects[0], { x: 0, y: 0, width: naturalWidth, height: naturalHeight }) < 32
      ? buildFallbackGridRects(naturalWidth, naturalHeight)
      : readingOrderRects;
  const detectedKeywords = extractDetectedKeywords(file.name, contextNotes, language);

  const panelDrafts = resolvedRects.map((rect, index) => {
    const roleHint: DetectedFigurePanel["roleHint"] =
      resolvedRects.length <= 1
        ? "entity"
        : index === 0
          ? "context"
          : index === resolvedRects.length - 1
            ? "outcome"
            : "process";
    const semanticHints = buildSemanticHints(file.name, contextNotes, language, roleHint);
    return {
      id: `panel_${Date.now()}_${index}`,
      label: language === "zh-CN" ? `分图 ${String.fromCharCode(65 + index)}` : `Panel ${String.fromCharCode(65 + index)}`,
      roleHint,
      bbox: rect,
      previewUri: cropRectToDataUrl(image, rect),
      confidence: Number((Math.min(0.98, 0.62 + rect.width * rect.height / (naturalWidth * naturalHeight) * 0.35)).toFixed(2)),
      semanticHints,
    };
  });

  const panels = await enrichPanelsWithOcr(panelDrafts, language);
  const mergedRecognizedText = panels
    .map((panel) => panel.recognizedText)
    .filter(Boolean)
    .join(language === "zh-CN" ? "；" : "; ");

  const summary =
    language === "zh-CN"
      ? `检测到 ${panels.length} 个可编辑分图区域，已按论文阅读顺序排列，并完成浏览器内 OCR 文本提取。`
      : `Detected ${panels.length} editable panel regions, arranged them in manuscript reading order, and extracted OCR text in-browser.`;

  return {
    sourceName: file.name,
    sourceDataUrl,
    width: naturalWidth,
    height: naturalHeight,
    summary,
    recommendedPrompt: buildRecommendedPrompt(file.name, contextNotes, panels, null, language),
    detectedKeywords,
    panels,
    mergedRecognizedText,
    backendDrafts: null,
  };
}

export function attachBackendDrafts(
  analysis: FigureWorkbenchAnalysis,
  backendDrafts: AnalyzeAssetResponse,
): FigureWorkbenchAnalysis {
  return {
    ...analysis,
    backendDrafts,
  };
}

export function buildRecommendedPromptFromSemantics(
  analysis: FigureWorkbenchAnalysis,
  semanticResponse: AnalyzePromptResponse | null,
  contextNotes: string,
  language: Language,
): string {
  return buildRecommendedPrompt(analysis.sourceName, contextNotes, analysis.panels, semanticResponse, language);
}

export function buildPanelResourceRecommendations(
  panel: Pick<DetectedFigurePanel, "label" | "recognizedText" | "semanticHints">,
  language: Language,
) {
  const libraryItems = getElementLibrary(language);
  const combined = `${panel.label} ${panel.recognizedText} ${panel.semanticHints.map((hint) => hint.label).join(" ")}`.toLowerCase();

  return libraryItems
    .map((item) => ({ item, score: item.keywords.reduce((sum, keyword) => sum + (combined.includes(keyword.toLowerCase()) ? 1 : 0), 0) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.label.localeCompare(right.item.label))
    .slice(0, 6)
    .map((entry) => entry.item);
}

export function insertFigurePanelsIntoScene(
  scene: SceneGraph,
  analysis: FigureWorkbenchAnalysis,
  language: Language,
): { scene: SceneGraph; selectedNodeId: string | null } {
  const cols = Math.min(analysis.panels.length, 3);
  const rows = Math.ceil(analysis.panels.length / cols);
  const slotWidth = 210;
  const slotHeight = 154;
  const gapX = 40;
  const gapY = 52;
  const panelPaddingX = 34;
  const panelPaddingY = 34;
  const contentWidth = cols * slotWidth + (cols - 1) * gapX;
  const contentHeight = rows * slotHeight + (rows - 1) * gapY;
  const panelWidth = contentWidth + panelPaddingX * 2;
  const panelHeight = contentHeight + panelPaddingY * 2 + 24;
  const originX = Math.max((scene.canvas.width - panelWidth) / 2, 24);
  const originY = Math.max((scene.canvas.height - panelHeight) / 2, 24);
  const baseZIndex = scene.nodes.reduce((highest, node) => Math.max(highest, node.zIndex), 0) + 10;
  const timestamp = new Date().toISOString();
  const panelId = `import_panel_${Date.now()}`;

  const generatedNodes: SceneNode[] = [
    {
      id: panelId,
      type: "panel",
      name: analysis.sourceName,
      zIndex: baseZIndex,
      transform: { x: originX, y: originY, width: panelWidth, height: panelHeight },
      bbox: { x: originX, y: originY, width: panelWidth, height: panelHeight },
      createdAt: timestamp,
      updatedAt: timestamp,
      title: analysis.sourceName,
      layout: "free",
      tags: ["imported-figure"],
    },
  ];

  const imageNodeIds: string[] = [];

  analysis.panels.forEach((panel, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = originX + panelPaddingX + col * (slotWidth + gapX);
    const y = originY + panelPaddingY + row * (slotHeight + gapY);
    const imageNodeId = `${panelId}_img_${index}`;
    const noteNodeId = `${panelId}_note_${index}`;

    const preferredLibraryItem = panel.semanticHints.length > 0 ? getLibraryItemById(language, panel.semanticHints[0].id) : null;
    generatedNodes.push({
      id: imageNodeId,
      type: "image",
      name: panel.label,
      parentId: panelId,
      zIndex: baseZIndex + index * 2 + 1,
      transform: { x, y, width: slotWidth, height: slotHeight },
      bbox: { x, y, width: slotWidth, height: slotHeight },
      createdAt: timestamp,
      updatedAt: timestamp,
      asset: {
        assetId: `asset_${imageNodeId}`,
        uri: preferredLibraryItem?.assetUri ?? panel.previewUri,
        mimeType: preferredLibraryItem?.assetUri?.endsWith(".svg") ? "image/svg+xml" : "image/png",
        width: panel.bbox.width,
        height: panel.bbox.height,
        sourceKind: preferredLibraryItem ? "generated" : "extracted",
      },
      editableMode: {
        move: true,
        resize: true,
        crop: true,
        regenerate: true,
        replaceAsset: true,
      },
      tags: ["imported-figure", `role:${panel.roleHint}`],
    });

    if (panel.semanticHints.length > 0) {
      generatedNodes.push({
        id: noteNodeId,
        type: "text",
        name: `${panel.label} notes`,
        parentId: panelId,
        zIndex: baseZIndex + index * 2 + 2,
        transform: { x, y: y + slotHeight + 8, width: slotWidth, height: 36 },
        bbox: { x, y: y + slotHeight + 8, width: slotWidth, height: 36 },
        createdAt: timestamp,
        updatedAt: timestamp,
        text: `${panel.label}: ${panel.semanticHints.map((hint) => hint.label).join(" · ")}`,
        style: {
          fontFamily: "Trebuchet MS",
          fontSize: 13,
          color: "#1f2a35",
          align: "left",
          lineHeight: 1.2,
          backgroundColor: "rgba(251, 250, 247, 0.9)",
        },
        editableMode: {
          move: true,
          resize: true,
          editText: true,
          editStyle: true,
          regenerate: false,
        },
        tags: ["imported-figure", "semantic-note"],
      });
    }

    if (panel.recognizedText) {
      generatedNodes.push({
        id: `${panelId}_ocr_${index}`,
        type: "text",
        name: `${panel.label} OCR`,
        parentId: panelId,
        zIndex: baseZIndex + index * 2 + 2,
        transform: { x, y: y + slotHeight - 34, width: slotWidth, height: 28 },
        bbox: { x, y: y + slotHeight - 34, width: slotWidth, height: 28 },
        createdAt: timestamp,
        updatedAt: timestamp,
        text: panel.recognizedText,
        style: {
          fontFamily: "Trebuchet MS",
          fontSize: 12,
          color: "#1f2a35",
          align: "center",
          lineHeight: 1.1,
          backgroundColor: "rgba(244, 241, 234, 0.92)",
        },
        editableMode: {
          move: true,
          resize: true,
          editText: true,
          editStyle: true,
          regenerate: false,
        },
        tags: ["imported-figure", "ocr-text"],
      });
    }

    imageNodeIds.push(imageNodeId);
  });

  return {
    scene: {
      ...scene,
      nodes: [...scene.nodes, ...generatedNodes],
    },
    selectedNodeId: imageNodeIds[0] ?? null,
  };
}

export function insertSingleFigurePanelIntoScene(
  scene: SceneGraph,
  analysis: FigureWorkbenchAnalysis,
  panelId: string,
  language: Language,
): { scene: SceneGraph; selectedNodeId: string | null } {
  const panel = analysis.panels.find((item) => item.id === panelId);
  if (!panel) {
    return { scene, selectedNodeId: null };
  }

  return insertFigurePanelsIntoScene(
    scene,
    {
      ...analysis,
      panels: [panel],
    },
    language,
  );
}

export function insertBackendDraftsIntoScene(
  scene: SceneGraph,
  analysis: FigureWorkbenchAnalysis,
  language: Language,
): { scene: SceneGraph; selectedNodeId: string | null } {
  if (!analysis.backendDrafts || analysis.backendDrafts.draftNodes.length === 0) {
    return insertFigurePanelsIntoScene(scene, analysis, language);
  }

  const timestamp = new Date().toISOString();
  const baseZIndex = scene.nodes.reduce((highest, node) => Math.max(highest, node.zIndex), 0) + 10;
  const importedNodes: SceneNode[] = [];
  let selectedNodeId: string | null = null;

  analysis.backendDrafts.draftNodes.forEach((draft, index) => {
    const x = Math.max(draft.bbox.x, 0);
    const y = Math.max(draft.bbox.y, 0);
    const width = Math.max(draft.bbox.width, 1);
    const height = Math.max(draft.bbox.height, 1);
    const zIndex = baseZIndex + index + 1;

    if (draft.type === "panel") {
      importedNodes.push({
        id: draft.id,
        type: "panel",
        name: draft.text ?? draft.id,
        zIndex,
        transform: { x, y, width, height },
        bbox: { x, y, width, height },
        createdAt: timestamp,
        updatedAt: timestamp,
        title: draft.text ?? draft.id,
        layout: "free",
        tags: ["backend-draft"],
      });
      return;
    }

    if (draft.type === "image") {
      const combinedLabel = `${analysis.sourceName} ${analysis.mergedRecognizedText} ${draft.text ?? ""}`.toLowerCase();
      const libraryMatch = getElementLibrary(language)
        .map((item) => ({ item, score: item.keywords.reduce((sum, keyword) => sum + (combinedLabel.includes(keyword.toLowerCase()) ? 1 : 0), 0) }))
        .sort((left, right) => right.score - left.score)[0]?.item;
      importedNodes.push({
        id: draft.id,
        type: "image",
        name: draft.text ?? libraryMatch?.label ?? draft.id,
        zIndex,
        transform: { x, y, width, height },
        bbox: { x, y, width, height },
        createdAt: timestamp,
        updatedAt: timestamp,
        asset: {
          assetId: `asset_${draft.id}`,
          uri: libraryMatch?.assetUri ?? analysis.sourceDataUrl,
          mimeType: libraryMatch?.assetUri?.endsWith(".svg") ? "image/svg+xml" : "image/png",
          width: Math.round(width),
          height: Math.round(height),
          sourceKind: libraryMatch ? "generated" : "extracted",
        },
        editableMode: {
          move: true,
          resize: true,
          crop: true,
          regenerate: true,
          replaceAsset: true,
        },
        tags: ["backend-draft"],
      });
      if (!selectedNodeId) {
        selectedNodeId = draft.id;
      }
      return;
    }

    if (draft.type === "text") {
      importedNodes.push({
        id: draft.id,
        type: "text",
        name: draft.id,
        zIndex,
        transform: { x, y, width, height },
        bbox: { x, y, width, height },
        createdAt: timestamp,
        updatedAt: timestamp,
        text: draft.text ?? "Detected text",
        style: {
          fontFamily: "Trebuchet MS",
          fontSize: 14,
          color: "#1f2a35",
          align: "left",
          lineHeight: 1.2,
          backgroundColor: "rgba(251, 250, 247, 0.92)",
        },
        editableMode: {
          move: true,
          resize: true,
          editText: true,
          editStyle: true,
          regenerate: false,
        },
        tags: ["backend-draft", "ocr-text"],
      });
      return;
    }

    importedNodes.push({
      id: draft.id,
      type: "arrow",
      name: draft.text ?? "flows_to",
      zIndex,
      transform: { x, y, width, height },
      bbox: { x, y, width, height },
      createdAt: timestamp,
      updatedAt: timestamp,
      points: [
        { x, y },
        { x: x + width, y: y + height },
      ],
      semantics:
        draft.text === "flows_to"
          ? "flows_to"
          : draft.text === "annotates"
            ? "annotates"
            : draft.text === "inhibit"
              ? "inhibit"
              : draft.text === "promote"
                ? "promote"
                : "associate",
      relationLabel: draft.text ?? undefined,
      style: {
        stroke: draft.text === "annotates" ? "#8d7f6f" : draft.text === "inhibit" ? "#b23a2f" : "#38558f",
        strokeWidth: 4,
        dashArray: draft.text === "annotates" ? [6, 6] : undefined,
        headEnd: draft.text === "inhibit" ? "tee" : "arrow",
      },
      editableMode: {
        move: true,
        reshape: true,
        editStyle: true,
        regenerate: false,
      },
      tags: ["backend-draft"],
    });
  });

  return {
    scene: {
      ...scene,
      nodes: [...scene.nodes, ...importedNodes],
    },
    selectedNodeId,
  };
}

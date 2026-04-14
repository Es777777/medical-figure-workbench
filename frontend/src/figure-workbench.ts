import type { AnalyzeAssetResponse, AnalyzePromptResponse } from "@shared/api-contracts";
import type { SceneGraph, SceneNode } from "@shared/scene-graph";

import type { Language } from "./copy";
import { getElementLibrary } from "./element-library";
import type { ImportMode } from "./features/import-session/types";

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

type PanelDraft = Omit<DetectedFigurePanel, "recognizedText" | "textConfidence">;

export type FigureWorkbenchOcrProgress = {
  completed: number;
  total: number;
};

export type AnalyzeFigureFileOptions = {
  sourceDataUrl?: string;
  onPanelsDetected?: (analysis: FigureWorkbenchAnalysis) => void;
  onOcrProgress?: (analysis: FigureWorkbenchAnalysis, progress: FigureWorkbenchOcrProgress) => void;
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

type ContourGridField = {
  cellSize: number;
  cols: number;
  rows: number;
  cellScores: Float32Array;
  activeCells: Uint8Array;
  threshold: number;
  activeRatio: number;
};

const MAX_ANALYSIS_DIMENSION = 1200;
const MAX_PANEL_COUNT = 10;
const MAX_SPLIT_DEPTH = 3;
const MAX_REFINE_DEPTH = 2;
const MIN_PANEL_SIZE = 96;
const OCR_TEXT_LIMIT = 120;
const OCR_TARGET_MIN_SIDE = 960;
const OCR_TARGET_MAX_SIDE = 2000;

type SniffedImageMime = "image/png" | "image/jpeg" | "image/gif" | "image/webp" | "image/tiff" | "image/bmp";

function fileToDataUrl(file: File, mimeOverride?: string | null): Promise<string> {
  if (mimeOverride && mimeOverride !== file.type) {
    return file.arrayBuffer().then((buffer) => {
      let binary = "";
      const bytes = new Uint8Array(buffer);
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(offset, offset + chunkSize));
      }
      return `data:${mimeOverride};base64,${btoa(binary)}`;
    });
  }

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

function loadImageElement(source: string, decodeErrorMessage = "Could not decode the selected figure image."): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(decodeErrorMessage));
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

function getPixelInkness(data: Uint8ClampedArray, imageWidth: number, x: number, y: number): number {
  const offset = (y * imageWidth + x) * 4;
  const alpha = data[offset + 3] / 255;
  const red = data[offset] / 255;
  const green = data[offset + 1] / 255;
  const blue = data[offset + 2] / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);
  const saturation = maxChannel - minChannel;
  const distanceFromWhite = 1 - (red + green + blue) / 3;
  return Math.max((1 - luminance) * alpha, saturation * alpha * 0.95, distanceFromWhite * alpha * 0.9);
}

function getPixelLuminance(data: Uint8ClampedArray, imageWidth: number, x: number, y: number): number {
  const offset = (y * imageWidth + x) * 4;
  const red = data[offset] / 255;
  const green = data[offset + 1] / 255;
  const blue = data[offset + 2] / 255;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function getPixelContrast(data: Uint8ClampedArray, imageWidth: number, imageHeight: number, x: number, y: number): number {
  const center = getPixelLuminance(data, imageWidth, x, y);
  const right = getPixelLuminance(data, imageWidth, Math.min(x + 1, imageWidth - 1), y);
  const bottom = getPixelLuminance(data, imageWidth, x, Math.min(y + 1, imageHeight - 1));
  const diagonal = getPixelLuminance(data, imageWidth, Math.min(x + 1, imageWidth - 1), Math.min(y + 1, imageHeight - 1));
  return Math.max(Math.abs(center - right), Math.abs(center - bottom), Math.abs(center - diagonal));
}

function getPixelStructureStrength(data: Uint8ClampedArray, imageWidth: number, imageHeight: number, x: number, y: number): number {
  const offset = (y * imageWidth + x) * 4;
  const alpha = data[offset + 3] / 255;
  const red = data[offset] / 255;
  const green = data[offset + 1] / 255;
  const blue = data[offset + 2] / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);
  const saturation = maxChannel - minChannel;
  const darkness = getPixelDarkness(data, imageWidth, x, y);
  const contrast = getPixelContrast(data, imageWidth, imageHeight, x, y);
  const darkInk = darkness >= 0.1 ? darkness : darkness * 0.58;
  const chromaEdge = saturation * Math.max(contrast * 3.8, 0.08) * alpha;
  const edgeStrength = contrast * 2.2 * alpha;
  const flatTintPenalty = luminance > 0.72 && contrast < 0.028 ? 0.45 : 1;
  return Math.max(darkInk, edgeStrength, chromaEdge) * flatTintPenalty;
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

function detectConnectedRegions(imageData: ImageData, width: number, height: number): Rect[] {
  const visited = new Uint8Array(width * height);
  const regions: Rect[] = [];
  const sampleStep = Math.max(Math.floor(Math.min(width, height) / 240), 1);
  let totalDarkness = 0;
  let sampleCount = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      totalDarkness += getPixelStructureStrength(imageData.data, imageData.width, imageData.height, x, y);
      sampleCount += 1;
    }
  }

  const meanDarkness = totalDarkness / Math.max(sampleCount, 1);
  const threshold = Math.max(0.09, Math.min(0.22, meanDarkness * 1.9 + 0.03));

  function indexOf(x: number, y: number) {
    return y * width + x;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = indexOf(x, y);
      if (visited[index] === 1) {
        continue;
      }
      visited[index] = 1;
      if (getPixelStructureStrength(imageData.data, imageData.width, imageData.height, x, y) < threshold) {
        continue;
      }

      const queue: Array<{ x: number; y: number }> = [{ x, y }];
      let queueIndex = 0;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let pixelCount = 0;

      while (queueIndex < queue.length) {
        const point = queue[queueIndex++];
        pixelCount += 1;
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);

        const neighbors = [
          { x: point.x - 1, y: point.y },
          { x: point.x + 1, y: point.y },
          { x: point.x, y: point.y - 1 },
          { x: point.x, y: point.y + 1 },
          { x: point.x - 1, y: point.y - 1 },
          { x: point.x + 1, y: point.y - 1 },
          { x: point.x - 1, y: point.y + 1 },
          { x: point.x + 1, y: point.y + 1 },
        ];

        for (const neighbor of neighbors) {
          if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= width || neighbor.y >= height) {
            continue;
          }
          const neighborIndex = indexOf(neighbor.x, neighbor.y);
          if (visited[neighborIndex] === 1) {
            continue;
          }
          visited[neighborIndex] = 1;
          if (getPixelStructureStrength(imageData.data, imageData.width, imageData.height, neighbor.x, neighbor.y) >= threshold) {
            queue.push(neighbor);
          }
        }
      }

      const regionWidth = maxX - minX + 1;
      const regionHeight = maxY - minY + 1;
      if (pixelCount >= 240 && regionWidth >= MIN_PANEL_SIZE && regionHeight >= MIN_PANEL_SIZE) {
        regions.push({ x: minX, y: minY, width: regionWidth, height: regionHeight });
      }
    }
  }

  return regions;
}

function expandRect(rect: Rect, padding: number, width: number, height: number): Rect {
  return clampRect(
    {
      x: rect.x - padding,
      y: rect.y - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    },
    width,
    height,
  );
}

function mergeRectPair(left: Rect, right: Rect): Rect {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const farX = Math.max(left.x + left.width, right.x + right.width);
  const farY = Math.max(left.y + left.height, right.y + right.height);
  return {
    x,
    y,
    width: farX - x,
    height: farY - y,
  };
}

async function sniffImageMimeType(file: File): Promise<SniffedImageMime | null> {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (header.length < 4) {
    return null;
  }

  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
    return "image/png";
  }

  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "image/jpeg";
  }

  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
    return "image/gif";
  }

  if (
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return "image/webp";
  }

  if (
    (header[0] === 0x49 && header[1] === 0x49 && header[2] === 0x2a && header[3] === 0x00) ||
    (header[0] === 0x4d && header[1] === 0x4d && header[2] === 0x00 && header[3] === 0x2a)
  ) {
    return "image/tiff";
  }

  if (header[0] === 0x42 && header[1] === 0x4d) {
    return "image/bmp";
  }

  return null;
}

function buildFigureDecodeErrorMessage(file: File, sniffedMime: SniffedImageMime | null, language: Language): string {
  const declaredMime = file.type || (file.name.toLowerCase().endsWith(".png") ? "image/png" : "");
  if (sniffedMime === "image/tiff") {
    return language === "zh-CN"
      ? `当前文件实际是 TIFF 数据，但浏览器导入器需要 PNG、JPEG、WEBP 或 GIF。请先把 ${file.name} 转成真正的 PNG/JPEG 再导入。`
      : `This file contains TIFF data. The browser importer currently expects PNG, JPEG, WEBP, or GIF. Please convert ${file.name} to a real PNG or JPEG before importing.`;
  }

  if (sniffedMime && declaredMime && sniffedMime !== declaredMime) {
    return language === "zh-CN"
      ? `当前文件内容看起来是 ${sniffedMime.replace("image/", "").toUpperCase()}，但文件被标记成了 ${declaredMime.replace("image/", "").toUpperCase()}。请按真实格式重新导出或修正扩展名后再导入。`
      : `The file contents look like ${sniffedMime.replace("image/", "").toUpperCase()} data, but the file is labeled as ${declaredMime.replace("image/", "").toUpperCase()}. Please re-export or rename it to the real format before importing.`;
  }

  return language === "zh-CN" ? "无法解码当前图片文件，请确认它是有效的 PNG、JPEG、WEBP 或 GIF。" : "Could not decode the selected figure image.";
}

function shouldMergeRects(left: Rect, right: Rect, maxGap: number): boolean {
  const overlapWidth = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const overlapHeight = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  const gapX = Math.max(0, Math.max(right.x - (left.x + left.width), left.x - (right.x + right.width)));
  const gapY = Math.max(0, Math.max(right.y - (left.y + left.height), left.y - (right.y + right.height)));
  const widthBaseline = Math.max(Math.min(left.width, right.width), 1);
  const heightBaseline = Math.max(Math.min(left.height, right.height), 1);
  const horizontalOverlapRatio = overlapWidth / widthBaseline;
  const verticalOverlapRatio = overlapHeight / heightBaseline;

  if (overlapWidth > 0 && overlapHeight > 0) {
    return true;
  }

  if (gapX <= maxGap && verticalOverlapRatio >= 0.18) {
    return true;
  }

  if (gapY <= maxGap && horizontalOverlapRatio >= 0.18) {
    return true;
  }

  const diagonalLimit = Math.max(Math.round(maxGap * 0.35), 6);
  return gapX <= diagonalLimit && gapY <= diagonalLimit && horizontalOverlapRatio >= 0.36 && verticalOverlapRatio >= 0.36;
}

function mergeNearbyRects(rects: Rect[], width: number, height: number): Rect[] {
  const merged = [...rects];
  const maxGap = Math.max(Math.round(Math.min(width, height) * 0.024), 18);
  let changed = true;

  while (changed) {
    changed = false;
    for (let index = 0; index < merged.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < merged.length; compareIndex += 1) {
        if (!shouldMergeRects(merged[index], merged[compareIndex], maxGap)) {
          continue;
        }

        merged[index] = clampRect(mergeRectPair(merged[index], merged[compareIndex]), width, height);
        merged.splice(compareIndex, 1);
        changed = true;
        break;
      }

      if (changed) {
        break;
      }
    }
  }

  return sortRectsReadingOrder(merged);
}

function buildContourGridField(imageData: ImageData, width: number, height: number): ContourGridField {
  const baseSize = Math.round(Math.min(width, height) / 50);
  const cellSize = Math.max(Math.min(baseSize, 24), 10);
  const cols = Math.max(Math.ceil(width / cellSize), 1);
  const rows = Math.max(Math.ceil(height / cellSize), 1);
  const cellScores = new Float32Array(cols * rows);
  const activeCells = new Uint8Array(cols * rows);
  let totalScore = 0;
  let activeCellCount = 0;

  function cellIndex(col: number, row: number) {
    return row * cols + col;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const startX = col * cellSize;
      const startY = row * cellSize;
      const endX = Math.min(startX + cellSize, width);
      const endY = Math.min(startY + cellSize, height);
      let scoreSum = 0;
      let activePixelCount = 0;
      let sampleCount = 0;

      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          const structureScore = getPixelStructureStrength(imageData.data, imageData.width, imageData.height, x, y);
          scoreSum += structureScore;
          activePixelCount += structureScore >= 0.095 ? 1 : 0;
          sampleCount += 1;
        }
      }

      const averageScore = scoreSum / Math.max(sampleCount, 1);
      const activeRatio = activePixelCount / Math.max(sampleCount, 1);
      const finalScore = averageScore * 0.7 + activeRatio * 0.3;
      cellScores[cellIndex(col, row)] = finalScore;
      totalScore += finalScore;
    }
  }

  const meanScore = totalScore / Math.max(cellScores.length, 1);
  const threshold = Math.max(0.048, Math.min(0.16, meanScore * 1.35 + 0.015));

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = cellIndex(col, row);
      if (cellScores[index] >= threshold) {
        activeCells[index] = 1;
        activeCellCount += 1;
      }
    }
  }

  return {
    cellSize,
    cols,
    rows,
    cellScores,
    activeCells,
    threshold,
    activeRatio: activeCellCount / Math.max(activeCells.length, 1),
  };
}

function dilateContourCells(activeCells: Uint8Array, cols: number, rows: number, radius: number): Uint8Array {
  if (radius <= 0) {
    return activeCells.slice();
  }

  const dilated = new Uint8Array(activeCells.length);
  function cellIndex(col: number, row: number) {
    return row * cols + col;
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let shouldActivate = false;
      for (let offset = -radius; offset <= radius && !shouldActivate; offset += 1) {
        const horizontalCol = col + offset;
        if (horizontalCol >= 0 && horizontalCol < cols && activeCells[cellIndex(horizontalCol, row)] === 1) {
          shouldActivate = true;
          break;
        }

        const verticalRow = row + offset;
        if (verticalRow >= 0 && verticalRow < rows && activeCells[cellIndex(col, verticalRow)] === 1) {
          shouldActivate = true;
          break;
        }
      }
      dilated[cellIndex(col, row)] = shouldActivate ? 1 : 0;
    }
  }

  return dilated;
}

function pruneLinearContourCells(activeCells: Uint8Array, cols: number, rows: number): Uint8Array {
  let current = activeCells.slice();

  function cellIndex(col: number, row: number) {
    return row * cols + col;
  }

  for (let pass = 0; pass < 2; pass += 1) {
    const next = current.slice();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = cellIndex(col, row);
        if (current[index] === 0) {
          next[index] = 0;
          continue;
        }

        const left = col > 0 ? current[cellIndex(col - 1, row)] === 1 : false;
        const right = col < cols - 1 ? current[cellIndex(col + 1, row)] === 1 : false;
        const top = row > 0 ? current[cellIndex(col, row - 1)] === 1 : false;
        const bottom = row < rows - 1 ? current[cellIndex(col, row + 1)] === 1 : false;
        let totalNeighbors = 0;

        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
            if (rowOffset === 0 && colOffset === 0) {
              continue;
            }
            const nextCol = col + colOffset;
            const nextRow = row + rowOffset;
            if (nextCol < 0 || nextRow < 0 || nextCol >= cols || nextRow >= rows) {
              continue;
            }
            totalNeighbors += current[cellIndex(nextCol, nextRow)] ?? 0;
          }
        }

        const hasHorizontalSupport = left || right;
        const hasVerticalSupport = top || bottom;
        const keepCell = (hasHorizontalSupport && hasVerticalSupport) || totalNeighbors >= 5;
        next[index] = keepCell ? 1 : 0;
      }
    }
    current = next;
  }

  return current;
}

function buildContourAxisScores(field: ContourGridField, rect: Rect, axis: SplitAxis): number[] {
  const values: number[] = [];
  const startCol = Math.max(Math.floor(rect.x), 0);
  const startRow = Math.max(Math.floor(rect.y), 0);
  const endCol = Math.min(Math.floor(rect.x + rect.width), field.cols);
  const endRow = Math.min(Math.floor(rect.y + rect.height), field.rows);

  if (axis === "vertical") {
    for (let col = startCol; col < endCol; col += 1) {
      let total = 0;
      let count = 0;
      for (let row = startRow; row < endRow; row += 1) {
        total += field.cellScores[row * field.cols + col] ?? 0;
        count += 1;
      }
      values.push(count > 0 ? total / count : 0);
    }
    return values;
  }

  for (let row = startRow; row < endRow; row += 1) {
    let total = 0;
    let count = 0;
    for (let col = startCol; col < endCol; col += 1) {
      total += field.cellScores[row * field.cols + col] ?? 0;
      count += 1;
    }
    values.push(count > 0 ? total / count : 0);
  }

  return values;
}

function buildContourAxisOccupancy(field: ContourGridField, rect: Rect, axis: SplitAxis): number[] {
  const values: number[] = [];
  const startCol = Math.max(Math.floor(rect.x), 0);
  const startRow = Math.max(Math.floor(rect.y), 0);
  const endCol = Math.min(Math.floor(rect.x + rect.width), field.cols);
  const endRow = Math.min(Math.floor(rect.y + rect.height), field.rows);
  const occupancyThreshold = Math.max(field.threshold * 1.22, 0.088);

  if (axis === "vertical") {
    for (let col = startCol; col < endCol; col += 1) {
      let activeCount = 0;
      let count = 0;
      for (let row = startRow; row < endRow; row += 1) {
        activeCount += (field.cellScores[row * field.cols + col] ?? 0) >= occupancyThreshold ? 1 : 0;
        count += 1;
      }
      values.push(count > 0 ? activeCount / count : 0);
    }
    return values;
  }

  for (let row = startRow; row < endRow; row += 1) {
    let activeCount = 0;
    let count = 0;
    for (let col = startCol; col < endCol; col += 1) {
      activeCount += (field.cellScores[row * field.cols + col] ?? 0) >= occupancyThreshold ? 1 : 0;
      count += 1;
    }
    values.push(count > 0 ? activeCount / count : 0);
  }

  return values;
}

function findBestContourSplit(values: number[], axisLength: number, crossLength: number, axis: SplitAxis): SplitCandidate | null {
  if (values.length < 6) {
    return null;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const minimum = Math.min(...values);
  const threshold = Math.max(0.018, Math.min(0.11, Math.max(minimum + 0.008, mean * 0.82 + 0.006)));
  const edgeMargin = Math.max(Math.round(axisLength * 0.08), 1);
  const minRun = Math.max(Math.round(axisLength * 0.06), 1);
  const minPanel = Math.max(Math.round(axisLength * 0.18), 2);

  let best: SplitCandidate | null = null;
  let runStart = -1;

  function commitRun(runEnd: number) {
    if (runStart === -1) {
      return;
    }

    const runLength = runEnd - runStart;
    const splitCenter = Math.round((runStart + runEnd) / 2);
    const firstSize = splitCenter;
    const secondSize = axisLength - splitCenter;
    if (
      runLength < minRun ||
      runStart <= edgeMargin ||
      runEnd >= axisLength - edgeMargin ||
      firstSize < minPanel ||
      secondSize < minPanel
    ) {
      runStart = -1;
      return;
    }

    let runScore = 0;
    for (let index = runStart; index < runEnd; index += 1) {
      runScore += values[index] ?? 0;
    }
    const averageRunScore = runScore / Math.max(runLength, 1);
    const valleyDepth = Math.max(0, threshold - averageRunScore) / threshold;
    const balance = Math.min(firstSize, secondSize) / Math.max(firstSize, secondSize);
    const score = runLength * (0.9 + valleyDepth * 1.6) * (0.7 + balance) * (crossLength > axisLength ? 1.05 : 1);

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

function findBestContourOccupancySplit(values: number[], axisLength: number, crossLength: number, axis: SplitAxis): SplitCandidate | null {
  if (values.length < 6) {
    return null;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const threshold = Math.max(0.08, Math.min(0.38, mean * 0.62 + 0.03));
  const edgeMargin = Math.max(Math.round(axisLength * 0.08), 1);
  const minRun = Math.max(Math.round(axisLength * 0.02), 1);
  const minPanel = Math.max(Math.round(axisLength * 0.14), 2);
  let best: SplitCandidate | null = null;
  let runStart = -1;

  function commitRun(runEnd: number) {
    if (runStart === -1) {
      return;
    }

    const runLength = runEnd - runStart;
    const splitCenter = Math.round((runStart + runEnd) / 2);
    const firstSize = splitCenter;
    const secondSize = axisLength - splitCenter;
    if (
      runLength < minRun ||
      runStart <= edgeMargin ||
      runEnd >= axisLength - edgeMargin ||
      firstSize < minPanel ||
      secondSize < minPanel
    ) {
      runStart = -1;
      return;
    }

    let runOccupancy = 0;
    for (let index = runStart; index < runEnd; index += 1) {
      runOccupancy += values[index] ?? 0;
    }
    const averageRunOccupancy = runOccupancy / Math.max(runLength, 1);
    const emptiness = Math.max(0, threshold - averageRunOccupancy) / threshold;
    const balance = Math.min(firstSize, secondSize) / Math.max(firstSize, secondSize);
    const score = runLength * (0.8 + emptiness * 1.8) * (0.72 + balance) * (crossLength > axisLength ? 1.04 : 1);

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

function cellRectHasSignal(field: ContourGridField, rect: Rect): boolean {
  const startCol = Math.max(Math.floor(rect.x), 0);
  const startRow = Math.max(Math.floor(rect.y), 0);
  const endCol = Math.min(Math.floor(rect.x + rect.width), field.cols);
  const endRow = Math.min(Math.floor(rect.y + rect.height), field.rows);
  let totalScore = 0;
  let activeCount = 0;
  let totalCount = 0;

  for (let row = startRow; row < endRow; row += 1) {
    for (let col = startCol; col < endCol; col += 1) {
      const index = row * field.cols + col;
      totalScore += field.cellScores[index] ?? 0;
      activeCount += field.activeCells[index] ?? 0;
      totalCount += 1;
    }
  }

  const meanScore = totalScore / Math.max(totalCount, 1);
  const activeRatio = activeCount / Math.max(totalCount, 1);
  return meanScore >= field.threshold * 0.78 || activeRatio >= 0.12;
}

function cellRectToPixelRect(rect: Rect, cellSize: number, width: number, height: number): Rect {
  const padding = Math.max(Math.round(cellSize * 0.7), 6);
  return clampRect(
    {
      x: rect.x * cellSize - padding,
      y: rect.y * cellSize - padding,
      width: rect.width * cellSize + padding * 2,
      height: rect.height * cellSize + padding * 2,
    },
    width,
    height,
  );
}

function detectContourSplitRects(field: ContourGridField, width: number, height: number, rect: Rect, depth = 0): Rect[] {
  if (!cellRectHasSignal(field, rect)) {
    return [];
  }

  if (depth >= MAX_SPLIT_DEPTH || rect.width < 6 || rect.height < 6) {
    return [cellRectToPixelRect(rect, field.cellSize, width, height)];
  }

  const verticalCandidate = findBestContourSplit(buildContourAxisScores(field, rect, "vertical"), Math.round(rect.width), Math.round(rect.height), "vertical");
  const horizontalCandidate = findBestContourSplit(
    buildContourAxisScores(field, rect, "horizontal"),
    Math.round(rect.height),
    Math.round(rect.width),
    "horizontal",
  );
  const verticalOccupancyCandidate = findBestContourOccupancySplit(
    buildContourAxisOccupancy(field, rect, "vertical"),
    Math.round(rect.width),
    Math.round(rect.height),
    "vertical",
  );
  const horizontalOccupancyCandidate = findBestContourOccupancySplit(
    buildContourAxisOccupancy(field, rect, "horizontal"),
    Math.round(rect.height),
    Math.round(rect.width),
    "horizontal",
  );
  const bestCandidate = [verticalCandidate, horizontalCandidate, verticalOccupancyCandidate, horizontalOccupancyCandidate]
    .filter((candidate): candidate is SplitCandidate => candidate !== null)
    .sort((left, right) => right.score - left.score)[0] ?? null;

  if (!bestCandidate || bestCandidate.score < 1.2) {
    return [cellRectToPixelRect(rect, field.cellSize, width, height)];
  }

  const [firstRect, secondRect] = splitRect(rect, bestCandidate);
  const splitRects = [
    ...detectContourSplitRects(field, width, height, firstRect, depth + 1),
    ...detectContourSplitRects(field, width, height, secondRect, depth + 1),
  ];
  return splitRects.length >= 2 ? splitRects : [cellRectToPixelRect(rect, field.cellSize, width, height)];
}

function detectContourGridRects(imageData: ImageData, width: number, height: number): Rect[] {
  const field = buildContourGridField(imageData, width, height);
  const strongThreshold = Math.max(field.threshold * 1.28, 0.11);
  const strongCells = new Uint8Array(field.activeCells.length);
  for (let index = 0; index < strongCells.length; index += 1) {
    strongCells[index] = (field.cellScores[index] ?? 0) >= strongThreshold ? 1 : 0;
  }
  const dilatedCells = dilateContourCells(strongCells, field.cols, field.rows, field.activeRatio > 0.34 ? 0 : 1);
  const prunedCells = dilateContourCells(pruneLinearContourCells(strongCells, field.cols, field.rows), field.cols, field.rows, 1);

  function cellIndex(col: number, row: number) {
    return row * field.cols + col;
  }

  function collectComponentRects(activeCells: Uint8Array, minCellCount: number): Rect[] {
    const visited = new Uint8Array(activeCells.length);
    const rects: Rect[] = [];

    for (let row = 0; row < field.rows; row += 1) {
      for (let col = 0; col < field.cols; col += 1) {
        const startIndex = cellIndex(col, row);
        if (visited[startIndex] === 1 || activeCells[startIndex] === 0) {
          continue;
        }

        const queue = [{ col, row }];
        visited[startIndex] = 1;
        let queueIndex = 0;
        let minCol = col;
        let minRow = row;
        let maxCol = col;
        let maxRow = row;
        let cellCount = 0;

        while (queueIndex < queue.length) {
          const point = queue[queueIndex++];
          cellCount += 1;
          minCol = Math.min(minCol, point.col);
          minRow = Math.min(minRow, point.row);
          maxCol = Math.max(maxCol, point.col);
          maxRow = Math.max(maxRow, point.row);

          const neighbors = [
            { col: point.col - 1, row: point.row },
            { col: point.col + 1, row: point.row },
            { col: point.col, row: point.row - 1 },
            { col: point.col, row: point.row + 1 },
          ];

          for (const neighbor of neighbors) {
            if (neighbor.col < 0 || neighbor.row < 0 || neighbor.col >= field.cols || neighbor.row >= field.rows) {
              continue;
            }
            const neighborIndex = cellIndex(neighbor.col, neighbor.row);
            if (visited[neighborIndex] === 1 || activeCells[neighborIndex] === 0) {
              continue;
            }
            visited[neighborIndex] = 1;
            queue.push(neighbor);
          }
        }

        if (cellCount < minCellCount) {
          continue;
        }

        rects.push(
          cellRectToPixelRect(
            {
              x: minCol,
              y: minRow,
              width: maxCol - minCol + 1,
              height: maxRow - minRow + 1,
            },
            field.cellSize,
            width,
            height,
          ),
        );
      }
    }

    return rects;
  }

  const componentRects = collectComponentRects(dilatedCells, 3);
  const detachedComponentRects = collectComponentRects(prunedCells, 2);

  const recursiveRects = detectContourSplitRects(field, width, height, { x: 0, y: 0, width: field.cols, height: field.rows });
  const combinedRects = sortRectsReadingOrder(
    dedupeRects([...mergeNearbyRects(componentRects, width, height), ...mergeNearbyRects(detachedComponentRects, width, height), ...recursiveRects]).filter(
      (rect, index, allRects) => allRects.length <= 1 || !isNearFullImageRect(rect, width, height),
    ),
  );
  return combinedRects.length > 0 ? combinedRects : recursiveRects;
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

function getRectArea(rect: Rect): number {
  return Math.max(rect.width, 0) * Math.max(rect.height, 0);
}

function getRectIntersectionArea(left: Rect, right: Rect): number {
  const overlapWidth = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const overlapHeight = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return overlapWidth * overlapHeight;
}

function isNearBoundsRect(rect: Rect, bounds: Rect): boolean {
  return estimateRectDifference(rect, bounds) < Math.max(Math.round(Math.min(bounds.width, bounds.height) * 0.08), 36);
}

function shiftRectsToBounds(rects: Rect[], bounds: Rect): Rect[] {
  return rects.map((rect) => ({
    x: rect.x - bounds.x,
    y: rect.y - bounds.y,
    width: rect.width,
    height: rect.height,
  }));
}

function clampRectToBounds(rect: Rect, bounds: Rect): Rect {
  const left = Math.max(rect.x, bounds.x);
  const top = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  return {
    x: left,
    y: top,
    width: Math.max(right - left, 1),
    height: Math.max(bottom - top, 1),
  };
}

function normalizeNestedPanelRects(rects: Rect[], bounds: Rect): Rect[] {
  if (rects.length <= 1) {
    return [];
  }

  const boundsArea = Math.max(bounds.width * bounds.height, 1);
  const minArea = Math.max(boundsArea * 0.045, MIN_PANEL_SIZE * MIN_PANEL_SIZE * 0.18);
  const minWidth = Math.max(bounds.width * 0.12, 52);
  const minHeight = Math.max(bounds.height * 0.12, 52);
  const filtered = sortRectsReadingOrder(
    rects
      .map((rect) => clampRectToBounds(rect, bounds))
      .filter((rect) => getRectArea(rect) >= minArea && rect.width >= minWidth && rect.height >= minHeight),
  );

  if (filtered.length <= 1) {
    return [];
  }

  const withoutNearFullRects = filtered.filter((rect) => !isNearBoundsRect(rect, bounds));
  const stripFilteredRects =
    withoutNearFullRects.length > 1
      ? withoutNearFullRects.filter((rect) => !(rect.width >= bounds.width * 0.78 && rect.height <= bounds.height * 0.18))
      : withoutNearFullRects;
  const sourceRects = stripFilteredRects.length > 0 ? stripFilteredRects : withoutNearFullRects.length > 0 ? withoutNearFullRects : filtered;
  const prunedRects: Rect[] = [];

  for (const rect of [...sourceRects].sort((left, right) => getRectArea(right) - getRectArea(left))) {
    const overlappingIndex = prunedRects.findIndex((candidate) => {
      const overlap = getRectIntersectionArea(candidate, rect);
      const smallerArea = Math.max(Math.min(getRectArea(candidate), getRectArea(rect)), 1);
      return overlap / smallerArea > 0.72;
    });
    if (overlappingIndex >= 0) {
      if (getRectArea(rect) > getRectArea(prunedRects[overlappingIndex])) {
        prunedRects[overlappingIndex] = rect;
      }
      continue;
    }
    prunedRects.push(rect);
  }

  const normalized = sortRectsReadingOrder(prunedRects);
  if (normalized.length <= 1) {
    return [];
  }

  const coverage = normalized.reduce((total, rect) => total + getRectArea(rect), 0) / boundsArea;
  const areas = normalized.map((rect) => getRectArea(rect));
  const smallestArea = Math.max(Math.min(...areas), 1);
  const largestArea = Math.max(...areas);
  if (coverage < 0.18 || largestArea / smallestArea > 120) {
    return [];
  }

  return normalized.slice(0, MAX_PANEL_COUNT);
}

function scoreNestedPanelRects(rects: Rect[], bounds: Rect): number {
  const shiftedRects = shiftRectsToBounds(rects, bounds);
  return scoreNormalizedAutoPanelRects(shiftedRects, bounds.width, bounds.height) + shiftedRects.length * 6;
}

function pixelRectToFieldRect(rect: Rect, field: ContourGridField): Rect {
  const startCol = Math.max(Math.floor(rect.x / field.cellSize), 0);
  const startRow = Math.max(Math.floor(rect.y / field.cellSize), 0);
  const endCol = Math.min(Math.ceil((rect.x + rect.width) / field.cellSize), field.cols);
  const endRow = Math.min(Math.ceil((rect.y + rect.height) / field.cellSize), field.rows);
  return {
    x: startCol,
    y: startRow,
    width: Math.max(endCol - startCol, 1),
    height: Math.max(endRow - startRow, 1),
  };
}

function normalizeAutoPanelRects(rects: Rect[], width: number, height: number): Rect[] {
  if (rects.length === 0) {
    return [];
  }

  const fullArea = Math.max(width * height, 1);
  const minArea = Math.max(fullArea * 0.012, MIN_PANEL_SIZE * MIN_PANEL_SIZE * 0.45);
  const minWidth = Math.max(width * 0.08, 64);
  const minHeight = Math.max(height * 0.08, 64);

  const filtered = sortRectsReadingOrder(
    rects.filter((rect) => getRectArea(rect) >= minArea && rect.width >= minWidth && rect.height >= minHeight),
  );

  if (filtered.length === 0) {
    return [];
  }

  const withoutNearFullRects =
    filtered.length > 1 ? filtered.filter((rect) => !isNearFullImageRect(rect, width, height)) : filtered;
  const decorativeHorizontalStrips =
    withoutNearFullRects.length > 1
      ? withoutNearFullRects.filter((rect) => rect.width >= width * 0.74 && rect.height <= height * 0.18)
      : [];
  const stripFilteredRects =
    withoutNearFullRects.length > 1
      ? withoutNearFullRects.filter((rect) => !decorativeHorizontalStrips.includes(rect))
      : withoutNearFullRects;
  const sourceRects = stripFilteredRects.length > 0 ? stripFilteredRects : withoutNearFullRects.length > 0 ? withoutNearFullRects : filtered;
  const prunedRects: Rect[] = [];

  for (const rect of [...sourceRects].sort((left, right) => getRectArea(right) - getRectArea(left))) {
    const overlappingIndex = prunedRects.findIndex((candidate) => {
      const overlap = getRectIntersectionArea(candidate, rect);
      const smallerArea = Math.max(Math.min(getRectArea(candidate), getRectArea(rect)), 1);
      return overlap / smallerArea > 0.68;
    });

    if (overlappingIndex >= 0) {
      if (getRectArea(rect) > getRectArea(prunedRects[overlappingIndex])) {
        prunedRects[overlappingIndex] = rect;
      }
      continue;
    }

    prunedRects.push(rect);
  }

  const normalized = sortRectsReadingOrder(prunedRects);
  if (normalized.length === 0) {
    return [];
  }

  const topExpansionBound =
    decorativeHorizontalStrips
      .filter((rect) => rect.y <= height * 0.24)
      .reduce((furthest, rect) => Math.max(furthest, rect.y + rect.height), 0) || 0;
  const bottomExpansionBound =
    decorativeHorizontalStrips
      .filter((rect) => rect.y + rect.height >= height * 0.76)
      .reduce((nearest, rect) => Math.min(nearest, rect.y), height) || height;
  const expandedNormalized =
    decorativeHorizontalStrips.length > 0
      ? sortRectsReadingOrder(
          normalized.map((rect) => {
            const nextY = topExpansionBound > 0 && rect.y > topExpansionBound ? topExpansionBound : rect.y;
            const nextBottom = bottomExpansionBound < height && rect.y + rect.height < bottomExpansionBound ? bottomExpansionBound : rect.y + rect.height;
            return clampRect(
              {
                x: rect.x,
                y: nextY,
                width: rect.width,
                height: nextBottom - nextY,
              },
              width,
              height,
            );
          }),
        )
      : normalized;

  if (expandedNormalized.length === 1) {
    const onlyRectCoverage = getRectArea(expandedNormalized[0]) / fullArea;
    return onlyRectCoverage >= 0.05 ? expandedNormalized : [];
  }

  const coverage = expandedNormalized.reduce((total, rect) => total + getRectArea(rect), 0) / fullArea;
  const areas = expandedNormalized.map((rect) => getRectArea(rect));
  const smallestArea = Math.max(Math.min(...areas), 1);
  const largestArea = Math.max(...areas);
  const minCoverage = expandedNormalized.length >= 3 ? 0.05 : 0.08;
  const maxAreaRatio = expandedNormalized.length >= 4 ? 120 : expandedNormalized.length >= 3 ? 80 : 40;
  if (coverage < minCoverage || largestArea / smallestArea > maxAreaRatio) {
    return [];
  }

  return expandedNormalized.slice(0, MAX_PANEL_COUNT);
}

function dedupeRects(rects: Rect[]): Rect[] {
  const uniqueRects: Rect[] = [];
  for (const rect of rects) {
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
  return uniqueRects;
}

function scaleNaturalRectsToAnalysis(rects: Rect[], scale: number, analysisWidth: number, analysisHeight: number): Rect[] {
  return rects
    .map((rect) => ({
      x: rect.x * scale,
      y: rect.y * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    }))
    .map((rect) => clampRect(rect, analysisWidth, analysisHeight));
}

function scaleAnalysisRects(rects: Rect[], scale: number, naturalWidth: number, naturalHeight: number): Rect[] {
  return rects
    .map((rect) => ({
      x: rect.x / scale,
      y: rect.y / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    }))
    .map((rect) => clampRect(rect, naturalWidth, naturalHeight));
}

function buildConnectedPanelRects(imageData: ImageData, width: number, height: number): Rect[] {
  const padding = Math.max(Math.round(Math.min(width, height) * 0.018), 12);
  const expandedRegions = detectConnectedRegions(imageData, width, height).map((rect) => expandRect(rect, padding, width, height));
  return mergeNearbyRects(expandedRegions, width, height);
}

function refineAnalysisRect(imageData: ImageData, field: ContourGridField, rect: Rect, depth = 0): Rect[] {
  if (depth >= MAX_REFINE_DEPTH || rect.width < MIN_PANEL_SIZE * 1.6 || rect.height < MIN_PANEL_SIZE * 1.6) {
    return [rect];
  }

  const whitespaceRects = normalizeNestedPanelRects(detectPanelRects(imageData, rect), rect);
  const contourRects = normalizeNestedPanelRects(detectContourSplitRects(field, imageData.width, imageData.height, pixelRectToFieldRect(rect, field)), rect);
  const rankedCandidates = [contourRects, whitespaceRects]
    .filter((candidate) => candidate.length > 1)
    .sort((left, right) => scoreNestedPanelRects(right, rect) - scoreNestedPanelRects(left, rect));
  const bestCandidate = rankedCandidates[0] ?? [];

  if (bestCandidate.length <= 1) {
    return [rect];
  }

  const refinedChildren = bestCandidate.flatMap((childRect) => refineAnalysisRect(imageData, field, childRect, depth + 1));
  const normalizedChildren = normalizeNestedPanelRects(refinedChildren, rect);
  return normalizedChildren.length > bestCandidate.length ? normalizedChildren : bestCandidate;
}

function refineAutoDetectedRects(
  imageData: ImageData,
  rects: Rect[],
  scale: number,
  naturalWidth: number,
  naturalHeight: number,
): Rect[] {
  if (rects.length === 0 || rects.length >= MAX_PANEL_COUNT || scale <= 0) {
    return rects;
  }

  const analysisRects = scaleNaturalRectsToAnalysis(rects, scale, imageData.width, imageData.height);
  const field = buildContourGridField(imageData, imageData.width, imageData.height);
  const fullArea = Math.max(naturalWidth * naturalHeight, 1);
  const refinedAnalysisRects: Rect[] = [];
  let changed = false;

  for (let index = 0; index < analysisRects.length; index += 1) {
    const naturalRect = rects[index];
    const analysisRect = analysisRects[index];
    const shouldRefine =
      naturalRect.width * naturalRect.height >= fullArea * 0.16 ||
      (naturalRect.width >= naturalWidth * 0.34 && naturalRect.height >= naturalHeight * 0.28);

    if (!shouldRefine) {
      refinedAnalysisRects.push(analysisRect);
      continue;
    }

    const children = refineAnalysisRect(imageData, field, analysisRect);
    if (children.length > 1) {
      changed = true;
      refinedAnalysisRects.push(...children);
    } else {
      refinedAnalysisRects.push(analysisRect);
    }
  }

  if (!changed) {
    return rects;
  }

  const scaledBack = dedupeRects(scaleAnalysisRects(refinedAnalysisRects, scale, naturalWidth, naturalHeight));
  const normalized = normalizeAutoPanelRects(scaledBack, naturalWidth, naturalHeight);
  return normalized.length >= rects.length ? normalized : rects;
}

function isNearFullImageRect(rect: Rect, width: number, height: number): boolean {
  return estimateRectDifference(rect, { x: 0, y: 0, width, height }) < Math.max(Math.round(Math.min(width, height) * 0.05), 48);
}

function scoreNormalizedAutoPanelRects(rects: Rect[], width: number, height: number): number {
  if (rects.length === 0) {
    return -1;
  }

  const fullArea = Math.max(width * height, 1);
  const coverage = rects.reduce((total, rect) => total + getRectArea(rect), 0) / fullArea;
  const areas = rects.map((rect) => getRectArea(rect));
  const smallestArea = Math.max(Math.min(...areas), 1);
  const largestArea = Math.max(...areas);
  const balance = smallestArea / largestArea;
  const fullRectPenalty = rects.length === 1 && isNearFullImageRect(rects[0], width, height) ? 18 : 0;
  return rects.length * 18 + coverage * 8 + balance * 10 - fullRectPenalty;
}

function resolveAutoPanelRects(whitespaceRects: Rect[], connectedRects: Rect[], contourRects: Rect[], width: number, height: number): Rect[] {
  const normalizedWhitespace = normalizeAutoPanelRects(whitespaceRects, width, height);
  const normalizedConnected = normalizeAutoPanelRects(connectedRects, width, height);
  const normalizedContours = normalizeAutoPanelRects(contourRects, width, height);
  const ranked = [normalizedContours, normalizedConnected, normalizedWhitespace]
    .filter((candidate) => candidate.length > 0)
    .sort((left, right) => scoreNormalizedAutoPanelRects(right, width, height) - scoreNormalizedAutoPanelRects(left, width, height));

  const bestCandidate = ranked[0] ?? [];
  if (bestCandidate.length > 1) {
    return bestCandidate;
  }

  if (bestCandidate.length === 1 && !isNearFullImageRect(bestCandidate[0], width, height)) {
    return bestCandidate;
  }

  return buildFallbackGridRects(width, height);
}

export function buildSplitRectsForMode(width: number, height: number, mode: ImportMode): Rect[] {
  if (mode === "single") {
    return [{ x: 0, y: 0, width, height }];
  }

  if (mode === "horizontal") {
    const halfWidth = Math.floor(width / 2);
    return [
      { x: 0, y: 0, width: halfWidth, height },
      { x: halfWidth, y: 0, width: width - halfWidth, height },
    ];
  }

  if (mode === "vertical") {
    const halfHeight = Math.floor(height / 2);
    return [
      { x: 0, y: 0, width, height: halfHeight },
      { x: 0, y: halfHeight, width, height: height - halfHeight },
    ];
  }

  if (mode === "grid") {
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);
    return [
      { x: 0, y: 0, width: halfWidth, height: halfHeight },
      { x: halfWidth, y: 0, width: width - halfWidth, height: halfHeight },
      { x: 0, y: halfHeight, width: halfWidth, height: height - halfHeight },
      { x: halfWidth, y: halfHeight, width: width - halfWidth, height: height - halfHeight },
    ];
  }

  return [];
}

export const __figureWorkbenchTestables = {
  detectPanelRects,
  buildConnectedPanelRects,
  buildContourGridField,
  detectContourSplitRects,
  detectContourGridRects,
  normalizeNestedPanelRects,
  normalizeAutoPanelRects,
  resolveAutoPanelRects,
  dedupeRects,
  refineAutoDetectedRects,
  scaleAnalysisRects,
  buildOcrAttemptPlan,
};

function buildFallbackGridRects(width: number, height: number): Rect[] {
  return [{ x: 0, y: 0, width, height }];
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

function clampColorByte(value: number): number {
  return Math.max(0, Math.min(Math.round(value), 255));
}

function computeOtsuThreshold(histogram: Uint32Array, total: number): number {
  let weightedTotal = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    weightedTotal += index * histogram[index];
  }

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestThreshold = 128;
  let bestVariance = -1;

  for (let index = 0; index < histogram.length; index += 1) {
    backgroundWeight += histogram[index];
    if (backgroundWeight === 0) {
      continue;
    }

    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) {
      break;
    }

    backgroundSum += index * histogram[index];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (weightedTotal - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;

    if (variance > bestVariance) {
      bestVariance = variance;
      bestThreshold = index;
    }
  }

  return bestThreshold;
}

function sanitizeRecognizedText(value: string): string {
  return value
    .replace(/[|¦]/g, "I")
    .replace(/[_~]{2,}/g, " ")
    .replace(/[•·]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[^A-Za-z0-9\u3400-\u9fff]+/, "")
    .replace(/[^A-Za-z0-9\u3400-\u9fff]+$/, "")
    .trim()
    .slice(0, OCR_TEXT_LIMIT);
}

function countMeaningfulCharacters(text: string): number {
  return (text.match(/[A-Za-z0-9\u3400-\u9fff]/g) ?? []).length;
}

function scoreRecognizedText(
  text: string,
  confidence: number | null,
  detail?: {
    wordCount?: number;
    lineCount?: number;
    averageWordConfidence?: number | null;
    psmKey?: OcrPsmKey;
  },
): number {
  const meaningfulCharCount = (text.match(/[A-Za-z0-9\u3400-\u9fff]/g) ?? []).length;
  const punctuationCount = (text.match(/[^A-Za-z0-9\u3400-\u9fff\s]/g) ?? []).length;
  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  const repeatedCharacterPenalty = (text.match(/(.)\1{4,}/g) ?? []).length * 3.5;
  const noisePenalty = (text.match(/[^A-Za-z0-9\u3400-\u9fff\s]{3,}/g) ?? []).length * 2.6;
  const wordBonus = (detail?.wordCount ?? 0) * 1.1;
  const lineBonus = (detail?.lineCount ?? 0) * 0.9;
  const wordConfidenceBonus = (detail?.averageWordConfidence ?? 0) * 0.28;
  const psmBonus =
    detail?.psmKey === "line"
      ? tokenCount <= 8
        ? 2.8
        : -2
      : detail?.psmKey === "block"
        ? tokenCount >= 2
          ? 1.6
          : 0
        : detail?.psmKey === "auto"
          ? 0.8
          : 0;
  if (meaningfulCharCount === 0) {
    return -40;
  }

  return (
    (confidence ?? 0) * 1.8 +
    meaningfulCharCount * 2.6 +
    tokenCount * 1.2 +
    wordBonus +
    lineBonus +
    wordConfidenceBonus +
    psmBonus -
    punctuationCount * 0.7 -
    repeatedCharacterPenalty -
    noisePenalty
  );
}

type OcrVariantMode = "raw" | "contrast" | "binary" | "adaptive";
type OcrPsmKey = "sparse" | "auto" | "block" | "line";

type OcrVariantSpec = {
  id: string;
  src: string;
  mode: OcrVariantMode;
  inverted: boolean;
  rotated: boolean;
};

type OcrAttemptPlanEntry = {
  variantId: string;
  psmKey: OcrPsmKey;
};

function buildIntegralImage(values: Uint8Array, width: number, height: number): Uint32Array {
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= width; x += 1) {
      rowSum += values[(y - 1) * width + (x - 1)] ?? 0;
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
    }
  }
  return integral;
}

function getIntegralAreaSum(integral: Uint32Array, width: number, left: number, top: number, right: number, bottom: number): number {
  const stride = width + 1;
  return integral[bottom * stride + right] - integral[top * stride + right] - integral[bottom * stride + left] + integral[top * stride + left];
}

function addOcrCanvasPadding(sourceCanvas: HTMLCanvasElement): string {
  const padding = Math.max(Math.round(Math.min(sourceCanvas.width, sourceCanvas.height) * 0.08), 24);
  const canvas = createCanvas(sourceCanvas.width + padding * 2, sourceCanvas.height + padding * 2);
  const context = getContext2d(canvas);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(sourceCanvas, padding, padding);
  return canvas.toDataURL("image/png");
}

function drawImageForOcr(
  image: HTMLImageElement,
  rotated: boolean,
): HTMLCanvasElement {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const minSide = Math.max(Math.min(sourceWidth, sourceHeight), 1);
  const maxSide = Math.max(sourceWidth, sourceHeight, 1);
  const upscale = Math.min(3, Math.max(1, OCR_TARGET_MIN_SIDE / minSide, OCR_TARGET_MAX_SIDE / maxSide));
  const targetWidth = Math.max(Math.round(sourceWidth * upscale), 1);
  const targetHeight = Math.max(Math.round(sourceHeight * upscale), 1);
  const canvas = createCanvas(rotated ? targetHeight : targetWidth, rotated ? targetWidth : targetHeight);
  const context = getContext2d(canvas);
  context.imageSmoothingEnabled = true;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (rotated) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  }
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  if (rotated) {
    context.setTransform(1, 0, 0, 1, 0, 0);
  }
  return canvas;
}

function createOcrVariantDataUrl(
  image: HTMLImageElement,
  options: {
    mode: OcrVariantMode;
    inverted?: boolean;
    rotated?: boolean;
  },
): string {
  const canvas = drawImageForOcr(image, options.rotated ?? false);

  if (options.mode === "raw" && !options.inverted) {
    return addOcrCanvasPadding(canvas);
  }

  const context = getContext2d(canvas);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const normalizedHistogram = new Uint32Array(256);
  const grayscaleValues = new Uint8Array(canvas.width * canvas.height);
  let minLuminance = 255;
  let maxLuminance = 0;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3] / 255;
    const luminance = clampColorByte((0.2126 * imageData.data[index] + 0.7152 * imageData.data[index + 1] + 0.0722 * imageData.data[index + 2]) * alpha + 255 * (1 - alpha));
    const pixelIndex = index / 4;
    grayscaleValues[pixelIndex] = luminance;
    minLuminance = Math.min(minLuminance, luminance);
    maxLuminance = Math.max(maxLuminance, luminance);
  }

  const range = Math.max(maxLuminance - minLuminance, 1);
  for (let index = 0; index < grayscaleValues.length; index += 1) {
    const normalized = clampColorByte(((grayscaleValues[index] - minLuminance) / range) * 255);
    grayscaleValues[index] = normalized;
    normalizedHistogram[normalized] += 1;
  }

  const threshold = computeOtsuThreshold(normalizedHistogram, grayscaleValues.length);
  const adaptiveIntegral = options.mode === "adaptive" ? buildIntegralImage(grayscaleValues, canvas.width, canvas.height) : null;
  const adaptiveRadius = Math.max(Math.min(Math.round(Math.min(canvas.width, canvas.height) / 18), 26), 10);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const normalized = grayscaleValues[index / 4];
    let output = normalized;
    if (options.mode === "binary") {
      output = normalized >= threshold ? 255 : 0;
    } else if (options.mode === "adaptive" && adaptiveIntegral) {
      const pixelIndex = index / 4;
      const x = pixelIndex % canvas.width;
      const y = Math.floor(pixelIndex / canvas.width);
      const left = Math.max(x - adaptiveRadius, 0);
      const top = Math.max(y - adaptiveRadius, 0);
      const right = Math.min(x + adaptiveRadius + 1, canvas.width);
      const bottom = Math.min(y + adaptiveRadius + 1, canvas.height);
      const area = Math.max((right - left) * (bottom - top), 1);
      const localMean = getIntegralAreaSum(adaptiveIntegral, canvas.width, left, top, right, bottom) / area;
      output = normalized >= localMean - 12 ? 255 : 0;
    }
    if (options.inverted) {
      output = 255 - output;
    }
    imageData.data[index] = output;
    imageData.data[index + 1] = output;
    imageData.data[index + 2] = output;
    imageData.data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return addOcrCanvasPadding(canvas);
}

async function buildOcrVariantSources(previewUri: string): Promise<{ width: number; height: number; variants: OcrVariantSpec[] }> {
  const image = await loadImageElement(previewUri);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const needsRotation = height > width * 1.28;
  const variants: OcrVariantSpec[] = [
    { id: "contrast", src: createOcrVariantDataUrl(image, { mode: "contrast" }), mode: "contrast", inverted: false, rotated: false },
    { id: "adaptive", src: createOcrVariantDataUrl(image, { mode: "adaptive" }), mode: "adaptive", inverted: false, rotated: false },
    { id: "binary", src: createOcrVariantDataUrl(image, { mode: "binary" }), mode: "binary", inverted: false, rotated: false },
    { id: "raw", src: createOcrVariantDataUrl(image, { mode: "raw" }), mode: "raw", inverted: false, rotated: false },
    {
      id: "adaptive-invert",
      src: createOcrVariantDataUrl(image, { mode: "adaptive", inverted: true }),
      mode: "adaptive",
      inverted: true,
      rotated: false,
    },
    {
      id: "contrast-invert",
      src: createOcrVariantDataUrl(image, { mode: "contrast", inverted: true }),
      mode: "contrast",
      inverted: true,
      rotated: false,
    },
  ];

  if (needsRotation) {
    variants.push(
      {
        id: "adaptive-rot90",
        src: createOcrVariantDataUrl(image, { mode: "adaptive", rotated: true }),
        mode: "adaptive",
        inverted: false,
        rotated: true,
      },
      {
        id: "binary-rot90",
        src: createOcrVariantDataUrl(image, { mode: "binary", rotated: true }),
        mode: "binary",
        inverted: false,
        rotated: true,
      },
    );
  }

  return {
    width,
    height,
    variants,
  };
}

type OcrWorker = {
  recognize: (image: string) => Promise<{
    data: {
      text: string;
      confidence: number;
      words?: Array<{ text: string; confidence: number }>;
      lines?: Array<{ text: string; confidence: number }>;
    };
  }>;
  setParameters: (params: Record<string, unknown>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

type OcrSession = {
  worker: OcrWorker;
  psmModes: Record<OcrPsmKey, unknown>;
};

function buildOcrAttemptPlan(width: number, height: number): OcrAttemptPlanEntry[] {
  const aspectRatio = width / Math.max(height, 1);
  const isLineLike = aspectRatio >= 2.4 || aspectRatio <= 0.55;
  const needsRotation = height > width * 1.28;
  const attempts: OcrAttemptPlanEntry[] = [
    { variantId: "contrast", psmKey: "sparse" },
    { variantId: "adaptive", psmKey: "sparse" },
    { variantId: "binary", psmKey: isLineLike ? "line" : "sparse" },
    { variantId: "raw", psmKey: "auto" },
    { variantId: "contrast", psmKey: "block" },
  ];

  if (isLineLike) {
    attempts.push({ variantId: "adaptive", psmKey: "line" });
  }

  if (needsRotation) {
    attempts.push(
      { variantId: "adaptive-rot90", psmKey: "block" },
      { variantId: "binary-rot90", psmKey: "line" },
    );
  }

  attempts.push(
    { variantId: "adaptive-invert", psmKey: "sparse" },
    { variantId: "contrast-invert", psmKey: "block" },
  );

  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    const key = `${attempt.variantId}:${attempt.psmKey}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function shouldStopOcrSearch(bestScore: number, bestText: string, completedAttempts: number): boolean {
  const meaningfulCharCount = countMeaningfulCharacters(bestText);
  if (bestScore >= 165) {
    return true;
  }
  if (completedAttempts >= 4 && bestScore >= 138 && meaningfulCharCount >= 6) {
    return true;
  }
  if (completedAttempts >= 6 && bestScore >= 118 && meaningfulCharCount >= 4) {
    return true;
  }
  return false;
}

async function createOcrWorker(language: Language): Promise<OcrSession> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = (await createWorker(language === "zh-CN" ? ["eng", "chi_sim"] : ["eng"])) as unknown as OcrWorker;
  await worker.setParameters({
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  return {
    worker,
    psmModes: {
      sparse: PSM.SPARSE_TEXT,
      auto: PSM.AUTO,
      block: PSM.SINGLE_BLOCK,
      line: PSM.SINGLE_LINE,
    },
  };
}

async function recognizePanelText(session: OcrSession, previewUri: string): Promise<{ text: string; confidence: number | null }> {
  const { width, height, variants } = await buildOcrVariantSources(previewUri);
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  const attempts = buildOcrAttemptPlan(width, height).filter((attempt) => variantMap.has(attempt.variantId));
  let bestResult: { text: string; confidence: number | null; score: number } = {
    text: "",
    confidence: null,
    score: -Infinity,
  };
  let activePsmKey: OcrPsmKey | null = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const variant = variantMap.get(attempt.variantId);
    if (!variant) {
      continue;
    }

    if (activePsmKey !== attempt.psmKey) {
      await session.worker.setParameters({
        tessedit_pageseg_mode: session.psmModes[attempt.psmKey],
      });
      activePsmKey = attempt.psmKey;
    }

    const result = await session.worker.recognize(variant.src);
    const text = sanitizeRecognizedText(result.data.text);
    const confidence = Number.isFinite(result.data.confidence) ? Math.round(result.data.confidence) : null;
    const words = (result.data.words ?? []).map((word) => sanitizeRecognizedText(word.text)).filter(Boolean);
    const lines = (result.data.lines ?? []).map((line) => sanitizeRecognizedText(line.text)).filter(Boolean);
    const averageWordConfidence =
      result.data.words && result.data.words.length > 0
        ? result.data.words.reduce((sum, word) => sum + (Number.isFinite(word.confidence) ? word.confidence : 0), 0) / result.data.words.length
        : null;
    const score = scoreRecognizedText(text, confidence, {
      wordCount: words.length,
      lineCount: lines.length,
      averageWordConfidence,
      psmKey: attempt.psmKey,
    });
    if (score > bestResult.score) {
      bestResult = { text, confidence, score };
    }
    if (shouldStopOcrSearch(bestResult.score, bestResult.text, index + 1)) {
      break;
    }
  }

  return {
    text: bestResult.text,
    confidence: bestResult.confidence,
  };
}

async function enrichPanelsWithOcr(
  panels: PanelDraft[],
  language: Language,
  onProgress?: (panels: DetectedFigurePanel[], progress: FigureWorkbenchOcrProgress) => void,
): Promise<DetectedFigurePanel[]> {
  if (panels.length === 0) {
    return [];
  }

  const enrichedPanels: DetectedFigurePanel[] = panels.map((panel) => ({
    ...panel,
    recognizedText: "",
    textConfidence: null,
  }));
  const session = await createOcrWorker(language);
  try {
    for (let index = 0; index < panels.length; index += 1) {
      const panel = panels[index];
      try {
        const ocr = await recognizePanelText(session, panel.previewUri);
        enrichedPanels[index] = {
          ...panel,
          recognizedText: ocr.text,
          textConfidence: ocr.confidence,
        };
      } catch {
        enrichedPanels[index] = {
          ...panel,
          recognizedText: "",
          textConfidence: null,
        };
      }

      onProgress?.([...enrichedPanels], {
        completed: index + 1,
        total: panels.length,
      });
    }

    return enrichedPanels;
  } finally {
    await session.worker.terminate();
  }
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

function buildMergedRecognizedText(panels: DetectedFigurePanel[], language: Language): string {
  return panels
    .map((panel) => panel.recognizedText)
    .filter(Boolean)
    .join(language === "zh-CN" ? "；" : "; ");
}

function buildFigureSummary(panelCount: number, language: Language, ocrProgress: FigureWorkbenchOcrProgress | null): string {
  if (ocrProgress && ocrProgress.completed < ocrProgress.total) {
    return language === "zh-CN"
      ? "检测到 " + panelCount + " 个可编辑分图区域，已按论文阅读顺序排列，正在继续识别文字（" + ocrProgress.completed + "/" + ocrProgress.total + "）。"
      : `Detected ${panelCount} editable panel regions in reading order. OCR is still running (${ocrProgress.completed}/${ocrProgress.total}).`;
  }

  return language === "zh-CN"
    ? "检测到 " + panelCount + " 个可编辑分图区域，已按论文阅读顺序排列，并完成浏览器内 OCR 文本提取。"
    : `Detected ${panelCount} editable panel regions, arranged them in manuscript reading order, and extracted OCR text in-browser.`;
}

function buildFigureWorkbenchAnalysis(
  fileName: string,
  sourceDataUrl: string,
  naturalWidth: number,
  naturalHeight: number,
  contextNotes: string,
  detectedKeywords: string[],
  panels: DetectedFigurePanel[],
  language: Language,
  ocrProgress: FigureWorkbenchOcrProgress | null,
): FigureWorkbenchAnalysis {
  return {
    sourceName: fileName,
    sourceDataUrl,
    width: naturalWidth,
    height: naturalHeight,
    summary: buildFigureSummary(panels.length, language, ocrProgress),
    recommendedPrompt: buildRecommendedPrompt(fileName, contextNotes, panels, null, language),
    detectedKeywords,
    panels,
    mergedRecognizedText: buildMergedRecognizedText(panels, language),
    backendDrafts: null,
  };
}

export async function analyzeFigureFile(
  file: File,
  contextNotes: string,
  language: Language,
  importMode: ImportMode = "auto",
  options: AnalyzeFigureFileOptions = {},
): Promise<FigureWorkbenchAnalysis> {
  const sniffedMime = await sniffImageMimeType(file);
  const sourceDataUrl = options.sourceDataUrl ?? (await fileToDataUrl(file, sniffedMime));
  const image = await loadImageElement(sourceDataUrl, buildFigureDecodeErrorMessage(file, sniffedMime, language));
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_ANALYSIS_DIMENSION / Math.max(naturalWidth, naturalHeight));
  const analysisWidth = Math.max(Math.round(naturalWidth * scale), 1);
  const analysisHeight = Math.max(Math.round(naturalHeight * scale), 1);
  const analysisCanvas = createCanvas(analysisWidth, analysisHeight);
  const analysisContext = getContext2d(analysisCanvas);
  analysisContext.drawImage(image, 0, 0, analysisWidth, analysisHeight);
  const imageData = analysisContext.getImageData(0, 0, analysisWidth, analysisHeight);
  const whitespaceRects = detectPanelRects(imageData, { x: 0, y: 0, width: analysisWidth, height: analysisHeight });
  const connectedRects = buildConnectedPanelRects(imageData, analysisWidth, analysisHeight);
  const contourRects = detectContourGridRects(imageData, analysisWidth, analysisHeight);
  const scaledWhitespaceRects = dedupeRects(scaleAnalysisRects(whitespaceRects, scale, naturalWidth, naturalHeight));
  const scaledConnectedRects = dedupeRects(scaleAnalysisRects(connectedRects, scale, naturalWidth, naturalHeight));
  const scaledContourRects = dedupeRects(scaleAnalysisRects(contourRects, scale, naturalWidth, naturalHeight));
  const autoResolvedRects = resolveAutoPanelRects(scaledWhitespaceRects, scaledConnectedRects, scaledContourRects, naturalWidth, naturalHeight);
  const refinedAutoResolvedRects = refineAutoDetectedRects(imageData, autoResolvedRects, scale, naturalWidth, naturalHeight);
  const resolvedRects = importMode === "auto" ? refinedAutoResolvedRects : buildSplitRectsForMode(naturalWidth, naturalHeight, importMode);
  const detectedKeywords = extractDetectedKeywords(file.name, contextNotes, language);

  const panelDrafts: PanelDraft[] = resolvedRects.map((rect, index) => {
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
      confidence: Number((Math.min(0.98, 0.62 + (rect.width * rect.height) / (naturalWidth * naturalHeight) * 0.35)).toFixed(2)),
      semanticHints,
    };
  });

  const initialPanels: DetectedFigurePanel[] = panelDrafts.map((panel) => ({
    ...panel,
    recognizedText: "",
    textConfidence: null,
  }));
  options.onPanelsDetected?.(
    buildFigureWorkbenchAnalysis(file.name, sourceDataUrl, naturalWidth, naturalHeight, contextNotes, detectedKeywords, initialPanels, language, {
      completed: 0,
      total: initialPanels.length,
    }),
  );

  const panels = await enrichPanelsWithOcr(panelDrafts, language, (progressPanels, progress) => {
    options.onOcrProgress?.(
      buildFigureWorkbenchAnalysis(file.name, sourceDataUrl, naturalWidth, naturalHeight, contextNotes, detectedKeywords, progressPanels, language, progress),
      progress,
    );
  });

  return buildFigureWorkbenchAnalysis(file.name, sourceDataUrl, naturalWidth, naturalHeight, contextNotes, detectedKeywords, panels, language, null);
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
        uri: panel.previewUri,
        mimeType: "image/png",
        width: panel.bbox.width,
        height: panel.bbox.height,
        sourceKind: "extracted",
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

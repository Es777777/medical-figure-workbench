import fixture from "@examples/minimal-compose-request.json";
import type { ComposeFigureRequest, PlannerAction, PromptEntityDraft, PromptRelationDraft } from "@shared/api-contracts";
import {
  assertSceneGraph,
  type ArrowSemantic,
  type AssetSourceKind,
  type ImageNode,
  type SceneGraph,
  type SceneNode,
  type ShapeKind,
  type ShapeNode,
  type TextNode,
} from "@shared/scene-graph";

import { getLibraryItemById } from "./element-library";

type GeometryPatch = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type LibraryAssetInput = {
  name: string;
  assetUri: string;
  mimeType?: string;
};

export type InsertImageNodeInput = LibraryAssetInput & {
  width?: number;
  height?: number;
  assetWidth?: number;
  assetHeight?: number;
  x?: number;
  y?: number;
  parentId?: string;
  sourceKind?: AssetSourceKind;
  tags?: string[];
};

function createFlowSlotAssetUri(label: string): string {
  const safeLabel = label.slice(0, 32);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">
      <rect width="320" height="220" rx="28" fill="#fbfaf7" />
      <rect x="20" y="20" width="280" height="180" rx="24" fill="#f7faf9" stroke="#0c8f8a" stroke-width="4" stroke-dasharray="14 10" />
      <circle cx="160" cy="92" r="34" fill="#0c8f8a" fill-opacity="0.12" stroke="#0c8f8a" stroke-width="4" />
      <path d="M160 70v44M138 92h44" stroke="#0c8f8a" stroke-width="8" stroke-linecap="round" />
      <text x="160" y="162" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-size="20" fill="#1f2a35">${safeLabel}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function parseFlowSteps(rawInput: string): string[] {
  return rawInput
    .split(/\r?\n|->|→|,|，|;|；/)
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function getArrowStyleForSemantics(semantics: PromptRelationDraft["semantics"]) {
  switch (semantics) {
    case "promote":
      return { stroke: "#0c8f8a", strokeWidth: 4, headEnd: "arrow" as const };
    case "inhibit":
      return { stroke: "#b23a2f", strokeWidth: 4, headEnd: "tee" as const };
    case "contains":
      return { stroke: "#5e8c79", strokeWidth: 3, dashArray: [8, 6], headEnd: "circle" as const };
    case "annotates":
      return { stroke: "#8d7f6f", strokeWidth: 3, dashArray: [6, 6], headEnd: "arrow" as const };
    case "flows_to":
      return { stroke: "#38558f", strokeWidth: 4, headEnd: "arrow" as const };
    case "associate":
      return { stroke: "#8d7f6f", strokeWidth: 3, dashArray: [10, 8], headEnd: "arrow" as const };
    default:
      return { stroke: "#8d7f6f", strokeWidth: 3, dashArray: [10, 8], headEnd: "arrow" as const };
  }
}

const STACK_Z_INDEX_STEP = 10;

function createNodeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getNextZIndex(scene: SceneGraph): number {
  return scene.nodes.reduce((highest, node) => Math.max(highest, node.zIndex), 0) + STACK_Z_INDEX_STEP;
}

function getAutoPlacement(scene: SceneGraph, width: number, height: number) {
  const offsetSeed = scene.nodes.filter((node) => node.tags?.includes("manual-tool") || node.tags?.includes("manual-upload")).length;
  const offset = Math.min(offsetSeed, 5) * 28;
  return {
    x: Math.max(Math.round((scene.canvas.width - width) / 2) + offset, 24),
    y: Math.max(Math.round((scene.canvas.height - height) / 2) + offset, 24),
  };
}

function fitImageNodeSize(scene: SceneGraph, assetWidth?: number, assetHeight?: number): { width: number; height: number } {
  const safeAssetWidth = Math.max(assetWidth ?? 320, 1);
  const safeAssetHeight = Math.max(assetHeight ?? 220, 1);
  const maxWidth = Math.min(scene.canvas.width * 0.42, 420);
  const maxHeight = Math.min(scene.canvas.height * 0.34, 280);
  const scale = Math.min(maxWidth / safeAssetWidth, maxHeight / safeAssetHeight, 1);

  return {
    width: Math.max(Math.round(safeAssetWidth * scale), 120),
    height: Math.max(Math.round(safeAssetHeight * scale), 90),
  };
}

function assertComposeFigureFixture(value: unknown): asserts value is ComposeFigureRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Fixture payload must be an object");
  }

  const candidate = value as Partial<ComposeFigureRequest>;
  if (typeof candidate.requestId !== "string" || typeof candidate.documentId !== "string" || !Array.isArray(candidate.exportFormats)) {
    throw new Error("Fixture payload does not match ComposeFigureRequest");
  }

  assertSceneGraph(candidate.scene);
}

assertComposeFigureFixture(fixture);

export function loadInitialComposeRequest(): ComposeFigureRequest {
  return structuredClone(fixture) as ComposeFigureRequest;
}

export function sortNodesByZIndex(nodes: SceneNode[]): SceneNode[] {
  return [...nodes].sort((left, right) => left.zIndex - right.zIndex);
}

export function getSceneExtents(scene: SceneGraph): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  const visibleNodes = scene.nodes.filter((node) => !node.hidden);
  let minX = 0;
  let minY = 0;
  let maxX = scene.canvas.width;
  let maxY = scene.canvas.height;

  for (const node of visibleNodes) {
    minX = Math.min(minX, node.bbox.x);
    minY = Math.min(minY, node.bbox.y);
    maxX = Math.max(maxX, node.bbox.x + node.bbox.width);
    maxY = Math.max(maxY, node.bbox.y + node.bbox.height);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

export function computeFitScale(scene: SceneGraph, viewportWidth: number, viewportHeight: number, padding = 48): number {
  const extents = getSceneExtents(scene);
  const safeViewportWidth = Math.max(viewportWidth - padding * 2, 1);
  const safeViewportHeight = Math.max(viewportHeight - padding * 2, 1);
  const fitScale = Math.min(safeViewportWidth / extents.width, safeViewportHeight / extents.height);
  return Math.min(Math.max(Math.round(fitScale * 90) / 100, 0.35), 2);
}

export function getInitialSelectionId(scene: SceneGraph): string | null {
  const ordered = sortNodesByZIndex(scene.nodes);
  return ordered.length > 0 ? ordered[ordered.length - 1].id : null;
}

function normalizeStackOrder(nodes: SceneNode[]): SceneNode[] {
  return nodes.map((node, index) => ({
    ...node,
    zIndex: (index + 1) * STACK_Z_INDEX_STEP,
  }));
}

export function describeNode(node: SceneNode): string {
  return node.name ?? node.id;
}

export function isTextNode(node: SceneNode | null): node is TextNode {
  return node?.type === "text";
}

export function isImageNode(node: SceneNode | null): node is ImageNode {
  return node?.type === "image";
}

export function isShapeNode(node: SceneNode | null): node is ShapeNode {
  return node?.type === "shape";
}

export function updateNodeById(scene: SceneGraph, nodeId: string, updater: (node: SceneNode) => SceneNode): SceneGraph {
  const timestamp = new Date().toISOString();
  return {
    ...scene,
    nodes: scene.nodes.map((node) => {
      if (node.id !== nodeId) {
        return node;
      }

      return {
        ...updater(node),
        updatedAt: timestamp,
      };
    }),
  };
}

function clampSize(value: number, fallback: number): number {
  if (Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(value, 1);
}

function scaleArrowPoints(node: Extract<SceneNode, { type: "arrow" }>, nextGeometry: Required<GeometryPatch>) {
  const originX = node.transform.x;
  const originY = node.transform.y;
  const sourceWidth = Math.max(node.transform.width, 1);
  const sourceHeight = Math.max(node.transform.height, 1);
  const scaleX = nextGeometry.width / sourceWidth;
  const scaleY = nextGeometry.height / sourceHeight;

  return node.points.map((point) => ({
    x: nextGeometry.x + (point.x - originX) * scaleX,
    y: nextGeometry.y + (point.y - originY) * scaleY,
  }));
}

export function updateNodeGeometry(scene: SceneGraph, nodeId: string, patch: GeometryPatch): SceneGraph {
  return updateNodeById(scene, nodeId, (node) => {
    const nextGeometry = {
      x: patch.x ?? node.transform.x,
      y: patch.y ?? node.transform.y,
      width: clampSize(patch.width ?? node.transform.width, node.transform.width),
      height: clampSize(patch.height ?? node.transform.height, node.transform.height),
    };

    if (node.type === "arrow") {
      return {
        ...node,
        transform: {
          ...node.transform,
          ...nextGeometry,
        },
        bbox: {
          ...node.bbox,
          ...nextGeometry,
        },
        points: scaleArrowPoints(node, nextGeometry),
      };
    }

    return {
      ...node,
      transform: {
        ...node.transform,
        ...nextGeometry,
      },
      bbox: {
        ...node.bbox,
        ...nextGeometry,
      },
    };
  });
}

export function setNodeZIndex(scene: SceneGraph, nodeId: string, zIndex: number): SceneGraph {
  const safeZIndex = Number.isNaN(zIndex) ? 0 : Math.max(Math.round(zIndex), 0);
  const ordered = scene.nodes
    .map((node, index) => ({ node, index }))
    .sort((left, right) => {
      const zDiff = left.node.zIndex - right.node.zIndex;
      return zDiff !== 0 ? zDiff : left.index - right.index;
    });

  const currentIndex = ordered.findIndex((entry) => entry.node.id === nodeId);
  if (currentIndex === -1) {
    return scene;
  }

  const reordered = [...ordered];
  const [targetEntry] = reordered.splice(currentIndex, 1);
  targetEntry.node = {
    ...targetEntry.node,
    zIndex: safeZIndex,
    updatedAt: new Date().toISOString(),
  };

  const insertionIndex = reordered.findIndex((entry) => entry.node.zIndex > safeZIndex);
  if (insertionIndex === -1) {
    reordered.push(targetEntry);
  } else {
    reordered.splice(insertionIndex, 0, targetEntry);
  }

  return {
    ...scene,
    nodes: normalizeStackOrder(reordered.map((entry) => entry.node)),
  };
}

export function applyVariantToImageNode(
  scene: SceneGraph,
  nodeId: string,
  asset: {
    assetId: string;
    uri: string;
    mimeType: string;
    width: number;
    height: number;
    sourceKind: "generated" | "upload" | "normalized" | "extracted";
  },
): SceneGraph {
  return updateNodeById(scene, nodeId, (node) => {
    if (node.type !== "image") {
      return node;
    }

    const targetWidth = node.transform.width;
    const targetHeight = node.transform.height;
    const safeWidth = Math.max(asset.width, 1);
    const safeHeight = Math.max(asset.height, 1);
    const fitScale = Math.min(targetWidth / safeWidth, targetHeight / safeHeight);
    const fittedWidth = Math.max(Math.round(safeWidth * fitScale * 100) / 100, 1);
    const fittedHeight = Math.max(Math.round(safeHeight * fitScale * 100) / 100, 1);
    const offsetX = Math.round(((targetWidth - fittedWidth) / 2) * 100) / 100;
    const offsetY = Math.round(((targetHeight - fittedHeight) / 2) * 100) / 100;

    return {
      ...node,
      asset: {
        assetId: asset.assetId,
        uri: asset.uri,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        sourceKind: asset.sourceKind,
      },
      crop: {
        x: offsetX,
        y: offsetY,
        width: fittedWidth,
        height: fittedHeight,
      },
    };
  });
}

export function applyLibraryAsset(scene: SceneGraph, targetNodeId: string | null, asset: LibraryAssetInput): { scene: SceneGraph; nodeId: string } {
  if (targetNodeId) {
    const existingNode = scene.nodes.find((node) => node.id === targetNodeId);
    if (existingNode?.type === "image") {
      return {
        scene: updateNodeById(scene, targetNodeId, (node) => {
          if (node.type !== "image") {
            return node;
          }

          return {
            ...node,
            name: asset.name,
            asset: {
              ...node.asset,
              uri: asset.assetUri,
              mimeType: asset.mimeType ?? node.asset.mimeType,
              sourceKind: "generated",
            },
          };
        }),
        nodeId: targetNodeId,
      };
    }
  }

  return insertImageNode(scene, {
    name: asset.name,
    assetUri: asset.assetUri,
    mimeType: asset.mimeType ?? "image/svg+xml",
    width: 180,
    height: 132,
    sourceKind: "generated",
    tags: ["manual-tool"],
  });
}

export function insertImageNode(scene: SceneGraph, input: InsertImageNodeInput): { scene: SceneGraph; nodeId: string } {
  const nodeId = createNodeId("img_library");
  const timestamp = new Date().toISOString();
  const fittedSize = fitImageNodeSize(scene, input.assetWidth, input.assetHeight);
  const width = Math.max(Math.round(input.width ?? fittedSize.width), 1);
  const height = Math.max(Math.round(input.height ?? fittedSize.height), 1);
  const placement = input.x !== undefined && input.y !== undefined ? { x: input.x, y: input.y } : getAutoPlacement(scene, width, height);

  return {
    scene: {
      ...scene,
      nodes: [
        ...scene.nodes,
        {
          id: nodeId,
          type: "image",
          name: input.name,
          parentId: input.parentId,
          zIndex: getNextZIndex(scene),
          transform: {
            x: placement.x,
            y: placement.y,
            width,
            height,
          },
          bbox: {
            x: placement.x,
            y: placement.y,
            width,
            height,
          },
          createdAt: timestamp,
          updatedAt: timestamp,
          asset: {
            assetId: `asset_${nodeId}`,
            uri: input.assetUri,
            mimeType: input.mimeType ?? "image/png",
            width: input.assetWidth ?? width,
            height: input.assetHeight ?? height,
            sourceKind: input.sourceKind ?? "generated",
          },
          editableMode: {
            move: true,
            resize: true,
            crop: true,
            regenerate: true,
            replaceAsset: true,
          },
          tags: input.tags,
        },
      ],
    },
    nodeId,
  };
}

export function insertTextNode(
  scene: SceneGraph,
  options?: {
    text?: string;
    width?: number;
    height?: number;
    backgroundColor?: string;
    tags?: string[];
  },
): { scene: SceneGraph; nodeId: string } {
  const width = options?.width ?? 240;
  const height = options?.height ?? 70;
  const placement = getAutoPlacement(scene, width, height);
  const nodeId = createNodeId("text_manual");
  const timestamp = new Date().toISOString();

  return {
    scene: {
      ...scene,
      nodes: [
        ...scene.nodes,
        {
          id: nodeId,
          type: "text",
          name: "Label",
          zIndex: getNextZIndex(scene),
          transform: { x: placement.x, y: placement.y, width, height },
          bbox: { x: placement.x, y: placement.y, width, height },
          createdAt: timestamp,
          updatedAt: timestamp,
          text: options?.text ?? "New label",
          style: {
            fontFamily: "Trebuchet MS",
            fontSize: 18,
            color: "#1f2a35",
            align: "left",
            lineHeight: 1.2,
            backgroundColor: options?.backgroundColor ?? "rgba(251, 250, 247, 0.92)",
          },
          editableMode: {
            move: true,
            resize: true,
            editText: true,
            editStyle: true,
            regenerate: false,
          },
          tags: options?.tags,
        },
      ],
    },
    nodeId,
  };
}

export function insertPanelNode(
  scene: SceneGraph,
  options?: {
    title?: string;
    width?: number;
    height?: number;
    tags?: string[];
  },
): { scene: SceneGraph; nodeId: string } {
  const width = options?.width ?? 300;
  const height = options?.height ?? 180;
  const placement = getAutoPlacement(scene, width, height);
  const nodeId = createNodeId("panel_manual");
  const timestamp = new Date().toISOString();

  return {
    scene: {
      ...scene,
      nodes: [
        ...scene.nodes,
        {
          id: nodeId,
          type: "panel",
          name: options?.title ?? "Panel",
          zIndex: getNextZIndex(scene),
          transform: { x: placement.x, y: placement.y, width, height },
          bbox: { x: placement.x, y: placement.y, width, height },
          createdAt: timestamp,
          updatedAt: timestamp,
          title: options?.title ?? "Panel",
          layout: "free",
          tags: options?.tags,
        },
      ],
    },
    nodeId,
  };
}

export function insertArrowNode(
  scene: SceneGraph,
  options?: {
    label?: string;
    semantics?: ArrowSemantic;
    width?: number;
    height?: number;
    tags?: string[];
  },
): { scene: SceneGraph; nodeId: string } {
  const width = Math.max(options?.width ?? 220, 80);
  const height = Math.max(options?.height ?? 36, 16);
  const placement = getAutoPlacement(scene, width, height);
  const nodeId = createNodeId("arrow_manual");
  const timestamp = new Date().toISOString();
  const semantics = options?.semantics ?? "flows_to";
  const style = getArrowStyleForSemantics(semantics);

  return {
    scene: {
      ...scene,
      nodes: [
        ...scene.nodes,
        {
          id: nodeId,
          type: "arrow",
          name: options?.label ?? "Arrow",
          zIndex: getNextZIndex(scene),
          transform: { x: placement.x, y: placement.y, width, height },
          bbox: { x: placement.x, y: placement.y, width, height },
          createdAt: timestamp,
          updatedAt: timestamp,
          points: [
            { x: placement.x, y: placement.y + height / 2 },
            { x: placement.x + width, y: placement.y + height / 2 },
          ],
          semantics,
          relationLabel: options?.label,
          style,
          editableMode: {
            move: true,
            reshape: true,
            editStyle: true,
            regenerate: false,
          },
          tags: options?.tags,
        },
      ],
    },
    nodeId,
  };
}

export function insertShapeNode(
  scene: SceneGraph,
  options?: {
    shape?: ShapeKind;
    name?: string;
    width?: number;
    height?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    tags?: string[];
  },
): { scene: SceneGraph; nodeId: string } {
  const shape = options?.shape ?? "rectangle";
  const width = Math.max(options?.width ?? (shape === "diamond" ? 156 : 180), 48);
  const height = Math.max(options?.height ?? (shape === "diamond" ? 156 : 120), 48);
  const placement = getAutoPlacement(scene, width, height);
  const nodeId = createNodeId("shape_manual");
  const timestamp = new Date().toISOString();
  const fallbackName =
    shape === "ellipse"
      ? "Ellipse"
      : shape === "diamond"
        ? "Diamond"
        : "Shape";

  return {
    scene: {
      ...scene,
      nodes: [
        ...scene.nodes,
        {
          id: nodeId,
          type: "shape",
          shape,
          name: options?.name ?? fallbackName,
          zIndex: getNextZIndex(scene),
          transform: { x: placement.x, y: placement.y, width, height },
          bbox: { x: placement.x, y: placement.y, width, height },
          createdAt: timestamp,
          updatedAt: timestamp,
          style: {
            fill: options?.fill ?? "#d9efe9",
            stroke: options?.stroke ?? "#0c8f8a",
            strokeWidth: Math.max(options?.strokeWidth ?? 3, 1),
          },
          editableMode: {
            move: true,
            resize: true,
            editStyle: true,
            regenerate: false,
          },
          tags: options?.tags,
        },
      ],
    },
    nodeId,
  };
}

export function deleteNode(scene: SceneGraph, nodeId: string): SceneGraph {
  const removableIds = new Set<string>([nodeId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const node of scene.nodes) {
      if (node.parentId && removableIds.has(node.parentId) && !removableIds.has(node.id)) {
        removableIds.add(node.id);
        changed = true;
      }
    }
  }

  const nodes = scene.nodes.filter((node) => {
    if (removableIds.has(node.id)) {
      return false;
    }
    if (node.type === "arrow" && ((node.sourceNodeId && removableIds.has(node.sourceNodeId)) || (node.targetNodeId && removableIds.has(node.targetNodeId)))) {
      return false;
    }
    return true;
  });

  return {
    ...scene,
    nodes: normalizeStackOrder(nodes),
  };
}

export function buildFlowLayout(scene: SceneGraph, rawInput: string): { scene: SceneGraph; selectedNodeId: string | null } {
  const steps = parseFlowSteps(rawInput);
  if (steps.length === 0) {
    return { scene, selectedNodeId: null };
  }

  const preservedNodes = scene.nodes.filter((node) => !node.tags?.includes("flow-layout"));
  const cols = Math.min(steps.length, 4);
  const rows = Math.ceil(steps.length / cols);
  const slotWidth = 160;
  const slotHeight = 110;
  const gapX = 56;
  const gapY = 92;
  const panelPaddingX = 42;
  const panelPaddingY = 34;
  const contentWidth = cols * slotWidth + (cols - 1) * gapX;
  const contentHeight = rows * slotHeight + (rows - 1) * gapY;
  const panelWidth = contentWidth + panelPaddingX * 2;
  const panelHeight = contentHeight + panelPaddingY * 2;
  const originX = Math.max((scene.canvas.width - panelWidth) / 2, 24);
  const originY = Math.max((scene.canvas.height - panelHeight) / 2, 24);
  const baseZIndex = preservedNodes.reduce((highest, node) => Math.max(highest, node.zIndex), 0) + STACK_Z_INDEX_STEP;
  const timestamp = new Date().toISOString();

  const panelNode: SceneNode = {
    id: `flow_panel_${Date.now()}`,
    type: "panel",
    name: "Flow Layout",
    zIndex: baseZIndex,
    transform: { x: originX, y: originY, width: panelWidth, height: panelHeight },
    bbox: { x: originX, y: originY, width: panelWidth, height: panelHeight },
    createdAt: timestamp,
    updatedAt: timestamp,
    title: "Flow Layout",
    layout: "free",
    tags: ["flow-layout"],
  };

  const generatedNodes: SceneNode[] = [panelNode];
  const slotIds: string[] = [];
  const slotCenters: Array<{ x: number; y: number }> = [];

  steps.forEach((step, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = originX + panelPaddingX + col * (slotWidth + gapX);
    const y = originY + panelPaddingY + row * (slotHeight + gapY);
    const nodeId = `flow_slot_${Date.now()}_${index}`;

    generatedNodes.push({
      id: nodeId,
      type: "image",
      name: step,
      parentId: panelNode.id,
      zIndex: baseZIndex + index + 1,
      transform: { x, y, width: slotWidth, height: slotHeight },
      bbox: { x, y, width: slotWidth, height: slotHeight },
      createdAt: timestamp,
      updatedAt: timestamp,
      asset: {
        assetId: `asset_${nodeId}`,
        uri: createFlowSlotAssetUri(step),
        mimeType: "image/svg+xml",
        width: 320,
        height: 220,
        sourceKind: "generated",
      },
      editableMode: {
        move: true,
        resize: true,
        crop: true,
        regenerate: true,
        replaceAsset: true,
      },
      tags: ["flow-layout"],
    });

    slotIds.push(nodeId);
    slotCenters.push({ x: x + slotWidth / 2, y: y + slotHeight / 2 });
  });

  for (let index = 0; index < slotCenters.length - 1; index += 1) {
    const current = slotCenters[index];
    const next = slotCenters[index + 1];

    generatedNodes.push({
      id: `flow_arrow_${Date.now()}_${index}`,
      type: "arrow",
      parentId: panelNode.id,
      name: `Flow ${index + 1}`,
      zIndex: baseZIndex + steps.length + index + 2,
      transform: {
        x: Math.min(current.x, next.x),
        y: Math.min(current.y, next.y),
        width: Math.abs(next.x - current.x),
        height: Math.abs(next.y - current.y),
      },
      bbox: {
        x: Math.min(current.x, next.x),
        y: Math.min(current.y, next.y),
        width: Math.max(Math.abs(next.x - current.x), 1),
        height: Math.max(Math.abs(next.y - current.y), 1),
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      points: [current, next],
      semantics: "associate",
      style: {
        stroke: "#0c8f8a",
        strokeWidth: 4,
        headEnd: "arrow",
      },
      editableMode: {
        move: true,
        reshape: true,
        editStyle: true,
        regenerate: false,
      },
      tags: ["flow-layout"],
    });
  }

  return {
    scene: {
      ...scene,
      nodes: [...preservedNodes, ...generatedNodes],
    },
    selectedNodeId: slotIds[0] ?? null,
  };
}

function buildStructuredLayout(
  scene: SceneGraph,
  entities: PromptEntityDraft[],
  relations: PromptRelationDraft[],
  tag: string,
): { scene: SceneGraph; selectedNodeId: string | null } {
  if (entities.length === 0) {
    return { scene, selectedNodeId: null };
  }

  const preservedNodes = scene.nodes.filter((node) => !node.tags?.includes(tag));
  const cols = Math.min(entities.length, 4);
  const rows = Math.ceil(entities.length / cols);
  const slotWidth = 170;
  const slotHeight = 116;
  const gapX = 60;
  const gapY = 96;
  const panelPaddingX = 48;
  const panelPaddingY = 40;
  const contentWidth = cols * slotWidth + (cols - 1) * gapX;
  const contentHeight = rows * slotHeight + (rows - 1) * gapY;
  const panelWidth = contentWidth + panelPaddingX * 2;
  const panelHeight = contentHeight + panelPaddingY * 2;
  const originX = Math.max((scene.canvas.width - panelWidth) / 2, 24);
  const originY = Math.max((scene.canvas.height - panelHeight) / 2, 24);
  const baseZIndex = preservedNodes.reduce((highest, node) => Math.max(highest, node.zIndex), 0) + STACK_Z_INDEX_STEP;
  const timestamp = new Date().toISOString();
  const panelId = `${tag}_panel_${Date.now()}`;

  const generatedNodes: SceneNode[] = [
    {
      id: panelId,
      type: "panel",
      name: tag === "reconstruction-layout" ? "Reconstruction Plan" : "Prompt Plan",
      zIndex: baseZIndex,
      transform: { x: originX, y: originY, width: panelWidth, height: panelHeight },
      bbox: { x: originX, y: originY, width: panelWidth, height: panelHeight },
      createdAt: timestamp,
      updatedAt: timestamp,
      title: tag === "reconstruction-layout" ? "Reconstruction Plan" : "Prompt Plan",
      layout: "free",
      tags: [tag],
    },
  ];

  const centers = new Map<string, { x: number; y: number }>();
  const entityNodeIds: string[] = [];

  entities.forEach((entity, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = originX + panelPaddingX + col * (slotWidth + gapX);
    const y = originY + panelPaddingY + row * (slotHeight + gapY);
    const nodeId = `${tag}_entity_${Date.now()}_${index}`;
    const libraryItem = entity.libraryItemId ? getLibraryItemById("zh-CN", entity.libraryItemId) : null;
    const assetUri = libraryItem?.assetUri ?? createFlowSlotAssetUri(entity.label);

    generatedNodes.push({
      id: nodeId,
      type: "image",
      name: entity.label,
      parentId: panelId,
      zIndex: baseZIndex + index + 1,
      transform: { x, y, width: slotWidth, height: slotHeight },
      bbox: { x, y, width: slotWidth, height: slotHeight },
      createdAt: timestamp,
      updatedAt: timestamp,
      asset: {
        assetId: `asset_${nodeId}`,
        uri: assetUri,
        mimeType: assetUri.startsWith("data:image") || assetUri.endsWith(".svg") ? "image/svg+xml" : "image/png",
        width: 320,
        height: 220,
        sourceKind: "generated",
      },
      editableMode: {
        move: true,
        resize: true,
        crop: true,
        regenerate: true,
        replaceAsset: true,
      },
      tags: [tag, `role:${entity.role}`],
    });

    centers.set(entity.id, { x: x + slotWidth / 2, y: y + slotHeight / 2 });
    entityNodeIds.push(nodeId);
  });

  relations.forEach((relation, index) => {
    const source = centers.get(relation.sourceId);
    const target = centers.get(relation.targetId);
    if (!source || !target) {
      return;
    }

    const style = getArrowStyleForSemantics(relation.semantics);
    generatedNodes.push({
      id: `${tag}_relation_${Date.now()}_${index}`,
      type: "arrow",
      parentId: panelId,
      name: relation.label ?? relation.semantics,
      zIndex: baseZIndex + entities.length + index + 2,
      transform: {
        x: Math.min(source.x, target.x),
        y: Math.min(source.y, target.y),
        width: Math.max(Math.abs(target.x - source.x), 1),
        height: Math.max(Math.abs(target.y - source.y), 1),
      },
      bbox: {
        x: Math.min(source.x, target.x),
        y: Math.min(source.y, target.y),
        width: Math.max(Math.abs(target.x - source.x), 1),
        height: Math.max(Math.abs(target.y - source.y), 1),
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      points: [source, target],
      semantics: relation.semantics,
      sourceNodeId: relation.sourceId,
      targetNodeId: relation.targetId,
      relationLabel: relation.label,
      style,
      editableMode: {
        move: true,
        reshape: true,
        editStyle: true,
        regenerate: false,
      },
      tags: [tag],
    });
  });

  return {
    scene: {
      ...scene,
      nodes: [...preservedNodes, ...generatedNodes],
    },
    selectedNodeId: entityNodeIds[0] ?? null,
  };
}

function selectPlannerSubset(
  entities: PromptEntityDraft[],
  relations: PromptRelationDraft[],
  actions: PlannerAction[],
  selectedActionIds?: string[],
): { entities: PromptEntityDraft[]; relations: PromptRelationDraft[] } {
  if (!selectedActionIds || selectedActionIds.length === 0) {
    return { entities, relations };
  }

  const selectedSet = new Set(selectedActionIds);
  const entityIds = new Set<string>();
  const relationIds = new Set<string>();

  for (const action of actions) {
    if (!selectedSet.has(action.id)) {
      continue;
    }

    for (const target of action.targetRefs) {
      if (target.kind === "entity") {
        entityIds.add(target.id);
      }
      if (target.kind === "relation") {
        relationIds.add(target.id);
      }
    }
  }

  let filteredRelations = relations.filter((relation) => relationIds.has(relation.id));

  if (filteredRelations.length === 0) {
    filteredRelations = relations.filter((relation) => entityIds.has(relation.sourceId) && entityIds.has(relation.targetId));
  }

  for (const relation of filteredRelations) {
    entityIds.add(relation.sourceId);
    entityIds.add(relation.targetId);
  }

  const filteredEntities = entities.filter((entity) => entityIds.size === 0 || entityIds.has(entity.id));

  return {
    entities: filteredEntities,
    relations: filteredRelations,
  };
}

export function buildSceneFromPromptAnalysis(
  scene: SceneGraph,
  entities: PromptEntityDraft[],
  relations: PromptRelationDraft[],
  actions: PlannerAction[] = [],
  selectedActionIds?: string[],
) {
  const subset = selectPlannerSubset(entities, relations, actions, selectedActionIds);
  return buildStructuredLayout(scene, subset.entities, subset.relations, "prompt-analysis-layout");
}

export function rebuildSceneFromReconstruction(
  scene: SceneGraph,
  entities: PromptEntityDraft[],
  relations: PromptRelationDraft[],
  actions: PlannerAction[] = [],
  selectedActionIds?: string[],
) {
  const subset = selectPlannerSubset(entities, relations, actions, selectedActionIds);
  return buildStructuredLayout(scene, subset.entities, subset.relations, "reconstruction-layout");
}

export function moveNodeInStack(scene: SceneGraph, nodeId: string, direction: "forward" | "backward"): SceneGraph {
  const ordered = sortNodesByZIndex(scene.nodes);
  const currentIndex = ordered.findIndex((node) => node.id === nodeId);

  if (currentIndex === -1) {
    return scene;
  }

  const nextIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;
  if (nextIndex < 0 || nextIndex >= ordered.length) {
    return scene;
  }

  const reordered = [...ordered];
  const [currentNode] = reordered.splice(currentIndex, 1);
  reordered.splice(nextIndex, 0, currentNode);

  return {
    ...scene,
    nodes: normalizeStackOrder(
      reordered.map((node) => ({
        ...node,
        updatedAt: node.id === nodeId ? new Date().toISOString() : node.updatedAt,
      })),
    ),
  };
}

export function makeRequestId(prefix: string): string {
  const randomChunk = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${randomChunk}`;
}

import { useEffect, useRef } from "react";
import { Canvas, FabricImage, Group, Line, Rect, Textbox, Triangle, type FabricObject } from "fabric";

import type { PlannerTargetRef } from "@shared/api-contracts";
import type { ArrowNode, ImageNode, PanelNode, SceneGraph, SceneNode, TextNode } from "@shared/scene-graph";

import { resolveAssetUrl } from "./api";
import { sortNodesByZIndex, updateNodeById } from "./scene-data";

type CanvasNodeObject = FabricObject & {
  data?: {
    nodeId?: string;
  };
};

interface EditorCanvasProps {
  scene: SceneGraph;
  selectedNodeId: string | null;
  highlightTargets: PlannerTargetRef[];
  onSelectNode: (nodeId: string | null) => void;
  onSceneChange: (scene: SceneGraph) => void;
  viewScale: number;
}

interface CanvasPalette {
  canvasBackground: string;
  panelStroke: string;
  panelFill: string;
  imageFill: string;
  imageStroke: string;
  imageLabel: string;
  arrowStroke: string;
  selection: string;
  selectionSoft: string;
}

const tokenFallbacks: Record<keyof CanvasPalette, string> = {
  canvasBackground: "#ffffff",
  panelStroke: "#8d7f6f",
  panelFill: "rgba(12, 143, 138, 0.05)",
  imageFill: "#f0ebe2",
  imageStroke: "#8d7f6f",
  imageLabel: "#1f2a35",
  arrowStroke: "#0c8f8a",
  selection: "#e58f3a",
  selectionSoft: "rgba(229, 143, 58, 0.18)",
};

function readCssToken(tokenName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return value || fallback;
}

function getCanvasPalette(): CanvasPalette {
  return {
    canvasBackground: readCssToken("--color-canvas", tokenFallbacks.canvasBackground),
    panelStroke: readCssToken("--color-border-strong", tokenFallbacks.panelStroke),
    panelFill: readCssToken("--color-panel-tint", tokenFallbacks.panelFill),
    imageFill: readCssToken("--color-surface-muted", tokenFallbacks.imageFill),
    imageStroke: readCssToken("--color-border-strong", tokenFallbacks.imageStroke),
    imageLabel: readCssToken("--color-ink", tokenFallbacks.imageLabel),
    arrowStroke: readCssToken("--color-accent", tokenFallbacks.arrowStroke),
    selection: readCssToken("--color-selection", tokenFallbacks.selection),
    selectionSoft: readCssToken("--color-selection-soft", tokenFallbacks.selectionSoft),
  };
}

function syncCanvasViewport(canvas: Canvas, width: number, height: number, viewScale: number, backgroundColor: string) {
  canvas.setDimensions({
    width: Math.round(width * viewScale),
    height: Math.round(height * viewScale),
  });
  canvas.backgroundColor = backgroundColor;
  canvas.setViewportTransform([viewScale, 0, 0, viewScale, 0, 0]);
}

function matchesHighlight(node: SceneNode, targets: PlannerTargetRef[]): boolean {
  if (targets.length === 0) {
    return false;
  }

  const searchable = `${node.id} ${node.name ?? ""} ${node.type === "text" ? node.text : ""} ${node.type === "arrow" ? `${node.relationLabel ?? ""} ${node.semantics ?? ""} ${node.sourceNodeId ?? ""} ${node.targetNodeId ?? ""}` : ""}`.toLowerCase();
  return targets.some((target) => searchable.includes(target.id.toLowerCase()) || searchable.includes(target.label.toLowerCase()));
}

function applyInteractionStyle(
  object: FabricObject,
  node: SceneNode,
  palette: Pick<CanvasPalette, "selection" | "selectionSoft">,
  options?: {
    allowResize?: boolean;
    highlighted?: boolean;
    dimmed?: boolean;
  },
): FabricObject {
  object.set({
    selectable: !node.locked && !node.hidden,
    evented: !node.locked && !node.hidden,
    lockRotation: true,
    lockScalingFlip: true,
    hasControls: options?.allowResize ?? false,
    borderColor: palette.selection,
    cornerColor: palette.selection,
    cornerStyle: "circle",
    transparentCorners: false,
    padding: options?.highlighted ? 10 : 6,
    opacity: options?.dimmed ? 0.16 : 1,
    shadow: options?.highlighted ? `0 0 18px ${palette.selectionSoft}` : undefined,
    data: {
      nodeId: node.id,
    },
  });
  return object;
}

function createPanelObject(node: PanelNode, palette: CanvasPalette, highlighted: boolean, dimmed: boolean): FabricObject {
  return applyInteractionStyle(
    new Rect({
      left: node.transform.x,
      top: node.transform.y,
      width: node.transform.width,
      height: node.transform.height,
      fill: palette.panelFill,
      stroke: highlighted ? palette.selection : palette.panelStroke,
      strokeDashArray: [10, 8],
      strokeWidth: highlighted ? 4 : 2,
      rx: 18,
      ry: 18,
    }),
    node,
    palette,
    { highlighted, dimmed },
  );
}

function createTextObject(node: TextNode, palette: CanvasPalette, highlighted: boolean, dimmed: boolean): FabricObject {
  return applyInteractionStyle(
    new Textbox(node.text, {
      left: node.transform.x,
      top: node.transform.y,
      width: node.transform.width,
      fontFamily: node.style.fontFamily || "Trebuchet MS",
      fontSize: node.style.fontSize || 16,
      fontWeight: node.style.fontWeight,
      fontStyle: node.style.fontStyle || "normal",
      fill: node.style.color || palette.imageLabel,
      textAlign: node.style.align,
      lineHeight: node.style.lineHeight || 1.16,
      charSpacing: node.style.letterSpacing ? node.style.letterSpacing * 100 : undefined,
      backgroundColor: highlighted ? palette.selectionSoft : node.style.backgroundColor,
      stroke: highlighted ? palette.selection : node.style.strokeColor,
      strokeWidth: highlighted ? Math.max(node.style.strokeWidth ?? 0, 1.4) : node.style.strokeWidth,
      editable: false,
    }),
    node,
    palette,
    { highlighted, dimmed },
  );
}

async function createImageObject(node: ImageNode, palette: CanvasPalette, highlighted: boolean, dimmed: boolean): Promise<FabricObject> {
  const frame = new Rect({
    left: 0,
    top: 0,
    width: node.transform.width,
    height: node.transform.height,
    fill: palette.imageFill,
    stroke: highlighted ? palette.selection : palette.imageStroke,
    strokeWidth: highlighted ? 4 : 2,
    rx: 16,
    ry: 16,
  });

  const title = new Textbox(node.name ?? "Image node", {
    left: 12,
    top: 12,
    width: Math.max(node.transform.width - 24, 40),
    fontFamily: "Palatino Linotype",
    fontSize: 16,
    fill: highlighted ? palette.selection : palette.imageLabel,
    editable: false,
  });

  let imageObject: FabricObject;
  try {
    const loadedImage = await FabricImage.fromURL(resolveAssetUrl(node.asset.uri));
    const contentWidth = node.crop?.width ?? node.transform.width;
    const contentHeight = node.crop?.height ?? node.transform.height;
    const contentX = node.crop?.x ?? 0;
    const contentY = node.crop?.y ?? 0;
    const safeWidth = loadedImage.width ?? 1;
    const safeHeight = loadedImage.height ?? 1;
    const fitScale = Math.min(contentWidth / safeWidth, contentHeight / safeHeight);

    loadedImage.set({
      left: contentX,
      top: contentY,
      scaleX: fitScale,
      scaleY: fitScale,
      selectable: false,
      evented: false,
    });
    imageObject = loadedImage;
  } catch {
    imageObject = new Textbox(node.asset.uri, {
      left: 12,
      top: Math.max(node.transform.height - 44, 28),
      width: Math.max(node.transform.width - 24, 40),
      fontFamily: "Trebuchet MS",
      fontSize: 11,
      fill: palette.imageLabel,
      editable: false,
    });
  }

  return applyInteractionStyle(
    new Group([frame, imageObject, title], {
      left: node.transform.x,
      top: node.transform.y,
    }),
    node,
    palette,
    { allowResize: true, highlighted, dimmed },
  );
}

function createArrowObject(node: ArrowNode, palette: CanvasPalette, highlighted: boolean, dimmed: boolean): FabricObject {
  const points = node.points.length > 0 ? node.points : [{ x: node.transform.x, y: node.transform.y }, { x: node.transform.x + node.transform.width, y: node.transform.y }];
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const lastPoint = points[points.length - 1];
  const previousPoint = points[Math.max(points.length - 2, 0)];
  const angle = Math.atan2(lastPoint.y - previousPoint.y, lastPoint.x - previousPoint.x) * (180 / Math.PI);

  const line = new Line(
    [points[0].x - minX, points[0].y - minY, lastPoint.x - minX, lastPoint.y - minY],
    {
      stroke:
        (highlighted ? palette.selection : node.style.stroke) ||
        (node.semantics === "inhibit"
          ? "#b23a2f"
          : node.semantics === "flows_to"
            ? "#38558f"
            : node.semantics === "contains"
              ? "#5e8c79"
              : palette.arrowStroke),
      strokeWidth: (node.style.strokeWidth ?? 3) + (highlighted ? 2 : 0),
      strokeDashArray: node.style.dashArray || (node.semantics === "associate" || node.semantics === "annotates" ? [10, 8] : undefined),
      selectable: false,
      evented: false,
    },
  );

  const arrowHead =
    node.style.headEnd === "arrow"
      ? new Triangle({
          left: lastPoint.x - minX - 10,
          top: lastPoint.y - minY - 10,
          width: 20,
          height: 20,
          fill: highlighted ? palette.selection : node.style.stroke || palette.arrowStroke,
          angle: angle + 90,
          selectable: false,
          evented: false,
        })
      : null;

  const teeHead =
    node.style.headEnd === "tee"
      ? new Line(
          [lastPoint.x - minX - 10, lastPoint.y - minY - 10, lastPoint.x - minX + 10, lastPoint.y - minY + 10],
          {
            stroke: highlighted ? palette.selection : node.style.stroke || "#b23a2f",
            strokeWidth: 6,
            selectable: false,
            evented: false,
            angle: angle + 90,
          },
        )
      : null;

  const relationLabel =
    node.relationLabel
      ? new Textbox(node.relationLabel, {
          left: (points[0].x + lastPoint.x) / 2 - minX - 40,
          top: (points[0].y + lastPoint.y) / 2 - minY - 26,
          width: 80,
          fontFamily: "Trebuchet MS",
          fontSize: 12,
          fill: palette.imageLabel,
          backgroundColor: highlighted ? palette.selectionSoft : undefined,
          fontWeight: highlighted ? 700 : 400,
          textAlign: "center",
          editable: false,
          selectable: false,
          evented: false,
        })
      : null;

  return applyInteractionStyle(
    new Group([line, ...(arrowHead ? [arrowHead] : []), ...(teeHead ? [teeHead] : []), ...(relationLabel ? [relationLabel] : [])], {
      left: minX,
      top: minY,
    }),
    node,
    palette,
    { highlighted, dimmed },
  );
}

async function createNodeObject(
  node: SceneNode,
  palette: CanvasPalette,
  highlightTargets: PlannerTargetRef[],
): Promise<FabricObject | null> {
  const highlighted = matchesHighlight(node, highlightTargets);
  const dimmed = highlightTargets.length > 0 && !highlighted;
  switch (node.type) {
    case "panel":
      return createPanelObject(node, palette, highlighted, dimmed);
    case "image":
      return createImageObject(node, palette, highlighted, dimmed);
    case "text":
      return createTextObject(node, palette, highlighted, dimmed);
    case "arrow":
      return createArrowObject(node, palette, highlighted, dimmed);
    case "group":
      return null;
    default:
      return null;
  }
}

function syncNodeFromObject(scene: SceneGraph, nodeId: string, object: FabricObject): SceneGraph {
  return updateNodeById(scene, nodeId, (node) => {
    const nextX = object.left ?? node.transform.x;
    const nextY = object.top ?? node.transform.y;
    const nextWidth = object.getScaledWidth();
    const nextHeight = object.getScaledHeight();

    if (node.type === "arrow") {
      const deltaX = nextX - node.transform.x;
      const deltaY = nextY - node.transform.y;
      return {
        ...node,
        transform: {
          ...node.transform,
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        },
        bbox: {
          ...node.bbox,
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        },
        points: node.points.map((point) => ({
          x: point.x + deltaX,
          y: point.y + deltaY,
        })),
      };
    }

    return {
      ...node,
      transform: {
        ...node.transform,
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      },
      bbox: {
        ...node.bbox,
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      },
    };
  });
}

export function EditorCanvas({ scene, selectedNodeId, highlightTargets, onSelectNode, onSceneChange, viewScale }: EditorCanvasProps) {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const objectMapRef = useRef<Map<string, FabricObject>>(new Map());
  const sceneRef = useRef(scene);
  const isProgrammaticSelectionRef = useRef(false);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    if (!canvasElementRef.current) {
      return undefined;
    }

    const canvas = new Canvas(canvasElementRef.current, {
      width: Math.round(scene.canvas.width * viewScale),
      height: Math.round(scene.canvas.height * viewScale),
      selection: false,
      preserveObjectStacking: true,
      backgroundColor: getCanvasPalette().canvasBackground,
    });

    const syncSelection = () => {
      if (isProgrammaticSelectionRef.current) {
        return;
      }
      const activeObject = canvas.getActiveObject() as CanvasNodeObject | undefined;
      const nodeId = activeObject?.data?.nodeId;
      onSelectNode(typeof nodeId === "string" ? nodeId : null);
    };

    canvas.on("selection:created", syncSelection);
    canvas.on("selection:updated", syncSelection);
    canvas.on("selection:cleared", () => {
      if (isProgrammaticSelectionRef.current) {
        return;
      }
      onSelectNode(null);
    });
    canvas.on("object:modified", (event) => {
      const target = event.target as CanvasNodeObject | undefined;
      const nodeId = target?.data?.nodeId;
      if (!target || typeof nodeId !== "string") {
        return;
      }

      onSceneChange(syncNodeFromObject(sceneRef.current, nodeId, target));
    });

    canvasRef.current = canvas;
    syncCanvasViewport(canvas, scene.canvas.width, scene.canvas.height, viewScale, getCanvasPalette().canvasBackground);

    return () => {
      canvas.dispose();
      canvasRef.current = null;
      objectMapRef.current.clear();
    };
  }, [onSceneChange, onSelectNode, scene.canvas.height, scene.canvas.width, viewScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let cancelled = false;

    const palette = getCanvasPalette();
    objectMapRef.current.clear();
    isProgrammaticSelectionRef.current = true;
    canvas.clear();
    syncCanvasViewport(canvas, scene.canvas.width, scene.canvas.height, viewScale, scene.canvas.backgroundColor ?? palette.canvasBackground);

    void (async () => {
      for (const node of sortNodesByZIndex(scene.nodes)) {
        if (cancelled || node.hidden) {
          continue;
        }

        const object = await createNodeObject(node, palette, highlightTargets);
        if (cancelled || !object) {
          continue;
        }

        object.setCoords();
        objectMapRef.current.set(node.id, object);
        canvas.add(object);

        if (selectedNodeId === node.id) {
          canvas.setActiveObject(object);
        }
      }

      if (cancelled) {
        return;
      }

      if (selectedNodeId) {
        const activeObject = objectMapRef.current.get(selectedNodeId);
        if (activeObject) {
          activeObject.setCoords();
          canvas.setActiveObject(activeObject);
        }
      }

      canvas.renderAll();
      queueMicrotask(() => {
        isProgrammaticSelectionRef.current = false;
      });
    })();

    return () => {
      cancelled = true;
      isProgrammaticSelectionRef.current = false;
    };
  }, [highlightTargets, scene, selectedNodeId, viewScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (!selectedNodeId) {
      isProgrammaticSelectionRef.current = true;
      canvas.discardActiveObject();
      canvas.renderAll();
      queueMicrotask(() => {
        isProgrammaticSelectionRef.current = false;
      });
      return;
    }

    const object = objectMapRef.current.get(selectedNodeId);
    if (object) {
      isProgrammaticSelectionRef.current = true;
      object.setCoords();
      canvas.setActiveObject(object);
      canvas.renderAll();
      queueMicrotask(() => {
        isProgrammaticSelectionRef.current = false;
      });
    }
  }, [selectedNodeId]);

  return <canvas ref={canvasElementRef} />;
}

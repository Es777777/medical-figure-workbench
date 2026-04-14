export type ID = string;

export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SceneKind = "scientific-figure";
export type NodeType = "panel" | "image" | "text" | "arrow" | "shape" | "group";
export type ArrowSemantic = "promote" | "inhibit" | "associate" | "contains" | "annotates" | "flows_to" | "unknown";
export type ShapeKind = "rectangle" | "ellipse" | "diamond";

export type AssetSourceKind = "upload" | "normalized" | "generated" | "extracted";

export type Timestamp = string;

export interface Transform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
}

export interface AssetRef {
  assetId: ID;
  uri: string;
  mimeType: string;
  width: number;
  height: number;
  sourceKind: AssetSourceKind;
}

export interface SourceAssetRef {
  assetId: ID;
  originalUri: string;
  normalizedUri: string;
  originalDetectedFormat: string;
  normalizedMimeType: "image/png";
  width: number;
  height: number;
}

export interface BaseNode {
  id: ID;
  type: NodeType;
  name?: string;
  parentId?: ID;
  zIndex: number;
  transform: Transform;
  bbox: Rect;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  locked?: boolean;
  hidden?: boolean;
  tags?: string[];
}

export interface PanelNode extends BaseNode {
  type: "panel";
  title?: string;
  layout?: "free" | "row" | "column";
}

export interface ImageNode extends BaseNode {
  type: "image";
  asset: AssetRef;
  crop?: Rect;
  maskUri?: string;
  editableMode: {
    move: true;
    resize: true;
    crop: true;
    regenerate: true;
    replaceAsset: true;
  };
}

export interface TextNode extends BaseNode {
  type: "text";
  text: string;
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight?: number;
    fontStyle?: "normal" | "italic";
    color: string;
    align?: "left" | "center" | "right";
    lineHeight?: number;
    letterSpacing?: number;
    strokeColor?: string;
    strokeWidth?: number;
    backgroundColor?: string;
  };
  editableMode: {
    move: true;
    resize: true;
    editText: true;
    editStyle: true;
    regenerate: false;
  };
}

export interface ArrowNode extends BaseNode {
  type: "arrow";
  points: Point[];
  semantics?: ArrowSemantic;
  sourceNodeId?: ID;
  targetNodeId?: ID;
  relationLabel?: string;
  style: {
    stroke: string;
    strokeWidth: number;
    dashArray?: number[];
    headStart?: "none" | "circle" | "bar";
    headEnd?: "none" | "arrow" | "tee" | "circle";
  };
  editableMode: {
    move: true;
    reshape: true;
    editStyle: true;
    regenerate: false;
  };
}

export interface ShapeNode extends BaseNode {
  type: "shape";
  shape: ShapeKind;
  style: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    dashArray?: number[];
  };
  editableMode: {
    move: true;
    resize: true;
    editStyle: true;
    regenerate: false;
  };
}

export interface GroupNode extends BaseNode {
  type: "group";
  childIds: ID[];
}

export type SceneNode = PanelNode | ImageNode | TextNode | ArrowNode | ShapeNode | GroupNode;

export interface Canvas {
  width: number;
  height: number;
  backgroundColor?: string;
}

export interface SceneGraph {
  id: ID;
  version: number;
  kind: SceneKind;
  canvas: Canvas;
  source: SourceAssetRef;
  nodes: SceneNode[];
}

export function isSceneGraph(value: unknown): value is SceneGraph {
  if (!value || typeof value !== "object") return false;
  const graph = value as Partial<SceneGraph>;
  return (
    typeof graph.id === "string" &&
    typeof graph.version === "number" &&
    graph.kind === "scientific-figure" &&
    !!graph.canvas &&
    Array.isArray(graph.nodes)
  );
}

export function assertSceneGraph(value: unknown): asserts value is SceneGraph {
  if (!isSceneGraph(value)) {
    throw new Error("Invalid SceneGraph payload");
  }
}

import type { SceneGraph } from "./scene-graph";

const validScene: SceneGraph = {
  id: "scene_001",
  version: 1,
  kind: "scientific-figure",
  canvas: {
    width: 1270,
    height: 852,
    backgroundColor: "#FFFFFF",
  },
  source: {
    assetId: "asset_source_001",
    originalUri: "/uploads/original/source.tif",
    normalizedUri: "/uploads/normalized/source.png",
    originalDetectedFormat: "TIFF",
    normalizedMimeType: "image/png",
    width: 1270,
    height: 852,
  },
  nodes: [
    {
      id: "arrow_001",
      type: "arrow",
      zIndex: 11,
      transform: { x: 0, y: 0, width: 100, height: 10 },
      bbox: { x: 0, y: 0, width: 100, height: 10 },
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      semantics: "flows_to",
      sourceNodeId: "text_001",
      targetNodeId: "text_002",
      relationLabel: "leads to",
      style: {
        stroke: "#0c8f8a",
        strokeWidth: 2,
        headEnd: "arrow",
      },
      editableMode: {
        move: true,
        reshape: true,
        editStyle: true,
        regenerate: false,
      },
    },
    {
      id: "text_001",
      type: "text",
      zIndex: 10,
      transform: { x: 20, y: 20, width: 100, height: 30 },
      bbox: { x: 20, y: 20, width: 100, height: 30 },
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
      text: "Sepsis",
      style: {
        fontFamily: "Arial",
        fontSize: 18,
        color: "#111827",
      },
      editableMode: {
        move: true,
        resize: true,
        editText: true,
        editStyle: true,
        regenerate: false,
      },
    },
    {
      id: "text_002",
      type: "text",
      zIndex: 12,
      transform: { x: 120, y: 20, width: 100, height: 30 },
      bbox: { x: 120, y: 20, width: 100, height: 30 },
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
      text: "Repair",
      style: {
        fontFamily: "Arial",
        fontSize: 18,
        color: "#111827",
      },
      editableMode: {
        move: true,
        resize: true,
        editText: true,
        editStyle: true,
        regenerate: false,
      },
    },
  ],
};

void validScene;

// @ts-expect-error invalid node discriminant
const badNodeType: SceneGraph = {
  ...validScene,
  nodes: [
    {
      id: "bad_001",
      type: "label",
      zIndex: 1,
      transform: { x: 0, y: 0, width: 1, height: 1 },
      bbox: { x: 0, y: 0, width: 1, height: 1 },
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    },
  ],
};

void badNodeType;

// @ts-expect-error missing normalizedMimeType
const badSource: SceneGraph = {
  ...validScene,
  source: {
    assetId: "asset_source_001",
    originalUri: "/uploads/original/source.tif",
    normalizedUri: "/uploads/normalized/source.png",
    originalDetectedFormat: "TIFF",
    width: 1270,
    height: 852,
  },
};

void badSource;

import type { AnalyzePromptResponse, ReconstructFigureResponse, RegenerateNodeResponse } from "@shared/api-contracts";
import type { SceneGraph } from "@shared/scene-graph";

import type { FigureWorkbenchAnalysis } from "../../figure-workbench";
import type { ImportMode } from "../import-session/types";

export type FigureTaskStatus = "pending-import" | "parsed" | "in-review" | "editing" | "exported";

export type FigureTask = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: FigureTaskStatus;
  importMode: ImportMode;
  sourceDataUrl: string;
  sourceName: string;
  importedSourcePreviewVisible: boolean;
  contextNotes: string;
  recommendedPrompt: string;
  mergedRecognizedText: string;
  analysis: FigureWorkbenchAnalysis | null;
  panelDecisions: Array<{ id: string; label: string; decision: "pending" | "keep" | "ignore" }>;
  analyzePrompt: string;
  analyzeState: {
    status: "idle" | "loading" | "done";
    mode: "live" | "fallback" | null;
    message: string;
    response: AnalyzePromptResponse | null;
    acceptedActionIds: string[];
    rejectedActionIds: string[];
    appliedActionIds: string[];
    staleActionIds: string[];
  };
  reconstructProblemNotes: string;
  reconstructState: {
    status: "idle" | "loading" | "done";
    mode: "live" | "fallback" | null;
    message: string;
    response: ReconstructFigureResponse | null;
    acceptedActionIds: string[];
    rejectedActionIds: string[];
    appliedActionIds: string[];
    staleActionIds: string[];
  };
  regeneratePrompt: string;
  regenerateFeedback: string;
  regenerateState: {
    status: "idle" | "loading" | "done";
    mode: "live" | "mock" | null;
    message: string;
    response: RegenerateNodeResponse | null;
    appliedVariantId: string | null;
  };
  scene: SceneGraph | null;
};

export type FigureProject = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  currentTaskId: string;
  tasks: FigureTask[];
};

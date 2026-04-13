import type { SceneGraph } from "@shared/scene-graph";

import { buildSceneExportPayload } from "./export-utils";

type Props = {
  scene: SceneGraph;
  saveLabel: string;
  loadLabel: string;
  saveProjectFileLabel: string;
  openProjectFileLabel: string;
  exportLabel: string;
  exportPngLabel: string;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onExportProjectFile: () => void;
  onOpenProjectFile: () => void;
  onExportPng: () => void;
};

export function ExportCenter(props: Props) {
  function handleExportJson() {
    const payload = buildSceneExportPayload(props.scene);
    const blob = new Blob([payload.content], { type: payload.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="export-center prompt-actions-row">
      <button className="secondary-button" onClick={props.onSaveProject} type="button">
        {props.saveLabel}
      </button>
      <button className="secondary-button" onClick={props.onLoadProject} type="button">
        {props.loadLabel}
      </button>
      <button className="secondary-button" onClick={props.onExportProjectFile} type="button">
        {props.saveProjectFileLabel}
      </button>
      <button className="secondary-button" onClick={props.onOpenProjectFile} type="button">
        {props.openProjectFileLabel}
      </button>
      <button className="secondary-button" onClick={handleExportJson} type="button">
        {props.exportLabel}
      </button>
      <button className="secondary-button" onClick={props.onExportPng} type="button">
        {props.exportPngLabel}
      </button>
    </div>
  );
}

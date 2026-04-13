import type { SceneGraph } from "@shared/scene-graph";

import { buildSceneExportPayload } from "./export-utils";
import type { ExportWarning } from "./validation";

type Props = {
  scene: SceneGraph;
  saveLabel: string;
  loadLabel: string;
  saveProjectFileLabel: string;
  openProjectFileLabel: string;
  exportLabel: string;
  exportPngLabel: string;
  exportSvgLabel: string;
  exportAllTasksLabel: string;
  exportChecksLabel: string;
  warnings: ExportWarning[];
  onSaveProject: () => void;
  onLoadProject: () => void;
  onExportProjectFile: () => void;
  onOpenProjectFile: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportAllTasks: () => void;
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
    <div className="export-center export-center-block">
      <div className="prompt-actions-row">
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
        <button className="secondary-button" onClick={props.onExportSvg} type="button">
          {props.exportSvgLabel}
        </button>
        <button className="secondary-button" onClick={props.onExportAllTasks} type="button">
          {props.exportAllTasksLabel}
        </button>
      </div>

      <div className="export-validation-list">
        <strong>{props.exportChecksLabel}</strong>
        {props.warnings.length > 0 ? (
          props.warnings.map((warning) => (
            <article className={`export-warning export-warning-${warning.severity}`} key={warning.code}>
              <strong>{warning.code}</strong>
              <p>{warning.message}</p>
            </article>
          ))
        ) : (
          <p className="technical-note">No export issues detected.</p>
        )}
      </div>
    </div>
  );
}

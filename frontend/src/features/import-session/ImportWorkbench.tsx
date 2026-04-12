import type { ChangeEvent, ReactNode, RefObject } from "react";

import { UI_COPY, type Language } from "../../copy";
import type { ImportMode } from "./types";

type Props = {
  language: Language;
  contextNotes: string;
  importMode: ImportMode;
  onChangeContextNotes: (value: string) => void;
  onChangeImportMode: (mode: ImportMode) => void;
  onPickFile: () => void;
  onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  children?: ReactNode;
};

const IMPORT_MODES: ImportMode[] = ["auto", "single", "horizontal", "vertical", "grid"];

function getImportModeLabel(language: Language, mode: ImportMode): string {
  if (language === "zh-CN") {
    return {
      auto: "自动识别",
      single: "单图",
      horizontal: "左右拆分",
      vertical: "上下拆分",
      grid: "网格拆分",
    }[mode];
  }

  return {
    auto: "Automatic",
    single: "Single image",
    horizontal: "Left / right split",
    vertical: "Top / bottom split",
    grid: "Grid split",
  }[mode];
}

export function ImportWorkbench(props: Props) {
  const copy = UI_COPY[props.language];

  return (
    <div className="import-workbench">
      <div className="import-workflow-card">
        <strong>{copy.labels.importWorkflow}</strong>
        <p>{copy.messages.quickImportHint}</p>
      </div>
      <input accept="image/*" hidden onChange={props.onFileSelected} ref={props.fileInputRef} type="file" />
      <label>
        <span>{copy.labels.contextNotes}</span>
        <textarea onChange={(event) => props.onChangeContextNotes(event.target.value)} rows={4} value={props.contextNotes} />
      </label>
      <div className="import-mode-block">
        <span>{copy.labels.importMode}</span>
        <p className="library-hint">{copy.messages.importModesHint}</p>
        <div className="import-mode-grid">
          {IMPORT_MODES.map((mode) => (
            <button
              className={`secondary-button${props.importMode === mode ? " is-current-decision" : ""}`}
              key={mode}
              onClick={() => props.onChangeImportMode(mode)}
              type="button"
            >
              {getImportModeLabel(props.language, mode)}
            </button>
          ))}
        </div>
      </div>
      <div className="prompt-actions-row">
        <button className="primary-button" onClick={props.onPickFile} type="button">
          {copy.actions.parseAndSplitFigure}
        </button>
      </div>
      {props.children}
    </div>
  );
}

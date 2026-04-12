import { UI_COPY, type Language } from "../../copy";

type Props = {
  language: Language;
  panels: Array<{
    id: string;
    label: string;
    previewUri: string;
    recognizedText: string;
    confidence: number;
    decision: "pending" | "keep" | "ignore";
  }>;
  onKeep: (panelId: string) => void;
  onIgnore: (panelId: string) => void;
  onImportSingle: (panelId: string) => void;
  onPreview: (panelId: string) => void;
};

export function SplitReviewPanel(props: Props) {
  const copy = UI_COPY[props.language];

  return (
    <div className="split-review-panel">
      {props.panels.map((panel) => (
        <article className={`figure-panel-card split-result-card${panel.decision === "ignore" ? " is-ignored" : ""}`} key={panel.id}>
          <img alt={panel.label} className="figure-panel-preview" src={panel.previewUri} />
          <div className="figure-panel-meta">
            <strong>{panel.label}</strong>
            <span>confidence {Math.round(panel.confidence * 100)}%</span>
          </div>
          <p className="figure-panel-text">{panel.recognizedText || copy.labels.noOcrText}</p>
          <div className="prompt-actions-row">
            <button className="secondary-button" onClick={() => props.onKeep(panel.id)} type="button">
              {copy.actions.keepPanel}
            </button>
            <button className="secondary-button" onClick={() => props.onIgnore(panel.id)} type="button">
              {copy.actions.ignorePanel}
            </button>
            <button className="secondary-button" onClick={() => props.onImportSingle(panel.id)} type="button">
              {copy.actions.importSinglePanel}
            </button>
            <button className="secondary-button" onClick={() => props.onPreview(panel.id)} type="button">
              {copy.actions.previewPanel}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

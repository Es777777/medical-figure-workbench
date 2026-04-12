import type { RegenerateNodeVariant } from "@shared/api-contracts";

import { UI_COPY, type Language } from "../../copy";

type Props = {
  language: Language;
  currentAssetLabel: string;
  currentAssetUri: string;
  currentPreviewSrc: string;
  nodeTitle: string;
  prompt: string;
  feedback: string;
  regenerateStatus: "idle" | "loading" | "done";
  regenerateMode: "live" | "mock" | null;
  regenerateMessage: string;
  regenerateSummary: string;
  variants: RegenerateNodeVariant[];
  appliedVariantId: string | null;
  onPromptChange: (value: string) => void;
  onFeedbackChange: (value: string) => void;
  onRegenerate: () => void;
  onApplyVariant: (variant: RegenerateNodeVariant) => void;
  renderVariantPreviewSource: (variant: RegenerateNodeVariant) => string;
};

export function ImageRefinementPanel(props: Props) {
  const copy = UI_COPY[props.language];

  return (
    <div className="property-block">
      <p className="section-label current-asset-label">{copy.labels.currentAsset}</p>
      <div className="variant-card current-asset-card">
        <img alt={copy.labels.currentAsset} className="variant-preview" src={props.currentPreviewSrc} />
        <div className="variant-meta">
          <strong>{props.nodeTitle}</strong>
          <span>{props.currentAssetUri}</span>
        </div>
      </div>

      <label>
        <span>{copy.labels.assetUri}</span>
        <input readOnly type="text" value={props.currentAssetUri} />
      </label>
      <label>
        <span>{copy.labels.prompt}</span>
        <textarea onChange={(event) => props.onPromptChange(event.target.value)} rows={4} value={props.prompt} />
      </label>
      <label>
        <span>{copy.labels.feedback}</span>
        <textarea onChange={(event) => props.onFeedbackChange(event.target.value)} rows={3} value={props.feedback} />
      </label>
      <button className="primary-button" disabled={props.regenerateStatus === "loading"} onClick={props.onRegenerate} type="button">
        {props.regenerateStatus === "loading" ? copy.actions.regenerating : copy.actions.regenerate}
      </button>

      <div className="response-panel">
        <div className="response-header">
          <strong>{copy.labels.regenerateStatus}</strong>
          {props.regenerateMode ? <span className={`mode-badge mode-${props.regenerateMode}`}>{props.regenerateMode}</span> : null}
        </div>
        <p>{props.regenerateSummary}</p>
        {props.regenerateMessage ? (
          <p className="technical-note">
            <strong>{copy.labels.fallbackDetail}:</strong> {props.regenerateMessage}
          </p>
        ) : null}

        <div className="variants-header-row">
          <strong>{copy.sections.generatedVariants}</strong>
        </div>

        {props.variants.length > 0 ? (
          <div className="variant-grid">
            {props.variants.map((variant) => {
              const isApplied = props.appliedVariantId === variant.id;
              return (
                <article className={`variant-card${isApplied ? " is-applied" : ""}`} key={variant.id}>
                  <img alt={variant.id} className="variant-preview" src={props.renderVariantPreviewSource(variant)} />
                  <div className="variant-meta">
                    <strong>{variant.id}</strong>
                    <span>{variant.previewUri}</span>
                  </div>
                  <button className="secondary-button" onClick={() => props.onApplyVariant(variant)} type="button">
                    {isApplied ? copy.actions.applied : copy.actions.applyVariant}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p>{copy.messages.noVariants}</p>
        )}
      </div>
    </div>
  );
}

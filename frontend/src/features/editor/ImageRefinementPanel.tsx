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

function truncateMiddle(value: string, maxLength = 44): string {
  if (value.length <= maxLength) {
    return value;
  }

  const headLength = Math.max(Math.floor(maxLength * 0.58), 18);
  const tailLength = Math.max(maxLength - headLength - 1, 10);
  return `${value.slice(0, headLength)}...${value.slice(-tailLength)}`;
}

function formatEmbeddedAssetSize(uri: string): string {
  const payload = uri.split(",")[1] ?? "";
  if (!payload) {
    return "";
  }

  const paddingLength = payload.match(/=*$/)?.[0].length ?? 0;
  const estimatedBytes = Math.max(Math.floor((payload.length * 3) / 4) - paddingLength, 0);
  if (estimatedBytes >= 1024 * 1024) {
    const megaBytes = estimatedBytes / (1024 * 1024);
    return `${megaBytes >= 10 ? megaBytes.toFixed(0) : megaBytes.toFixed(1)} MB`;
  }
  if (estimatedBytes >= 1024) {
    return `${Math.max(Math.round(estimatedBytes / 1024), 1)} KB`;
  }
  return `${Math.max(estimatedBytes, 1)} B`;
}

function formatAssetUriSummary(uri: string, language: Language): string {
  if (!uri) {
    return language === "zh-CN" ? "未设置资源" : "No asset selected";
  }

  if (uri.startsWith("data:image/")) {
    const mimeMatch = uri.match(/^data:(image\/[^;]+)/i);
    const mimeLabel = mimeMatch?.[1]?.replace("image/", "").toUpperCase() ?? "IMAGE";
    const sizeLabel = formatEmbeddedAssetSize(uri);
    return language === "zh-CN"
      ? `本地裁切图 ${mimeLabel}${sizeLabel ? ` · ${sizeLabel}` : ""}`
      : `Embedded ${mimeLabel} asset${sizeLabel ? ` · ${sizeLabel}` : ""}`;
  }

  try {
    const parsed = new URL(uri);
    const fileName = parsed.pathname.split("/").filter(Boolean).pop();
    return truncateMiddle(`${parsed.hostname}${fileName ? `/${fileName}` : parsed.pathname}`);
  } catch {
    if (uri.startsWith("/")) {
      return truncateMiddle(uri.split(/[\\/]/).filter(Boolean).pop() ?? uri);
    }
    return truncateMiddle(uri);
  }
}

export function ImageRefinementPanel(props: Props) {
  const copy = UI_COPY[props.language];
  const currentAssetSummary = formatAssetUriSummary(props.currentAssetUri, props.language);

  return (
    <div className="property-block">
      <p className="section-label current-asset-label">{copy.labels.currentAsset}</p>
      <div className="variant-card current-asset-card">
        <img alt={copy.labels.currentAsset} className="variant-preview" src={props.currentPreviewSrc} />
        <div className="variant-meta">
          <strong>{props.nodeTitle}</strong>
          <span title={props.currentAssetUri}>{currentAssetSummary}</span>
        </div>
      </div>

      <details className="asset-uri-details">
        <summary>{copy.labels.assetUri}</summary>
        <code className="asset-uri-code">{props.currentAssetUri}</code>
      </details>
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
                    <span title={variant.previewUri}>{formatAssetUriSummary(variant.previewUri, props.language)}</span>
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

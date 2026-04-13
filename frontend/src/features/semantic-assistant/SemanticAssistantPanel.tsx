import type { PlannerAction, PlannerTargetRef, ReconstructFigureResponse } from "@shared/api-contracts";

import { UI_COPY, type Language } from "../../copy";

type AnalyzeStateLike = {
  prompt: string;
  mode: "live" | "fallback" | null;
  message: string;
  response: {
    summary: string;
    entities: Array<{ id: string; label: string; libraryItemId?: string }>;
    relations: Array<{ id: string; semantics: string }>;
    actions: PlannerAction[];
  } | null;
  acceptedActionIds: string[];
};

type ReconstructStateLike = {
  problemNotes: string;
  mode: "live" | "fallback" | null;
  message: string;
  response: ReconstructFigureResponse | null;
  acceptedActionIds: string[];
};

type Props = {
  language: Language;
  analyzeState: AnalyzeStateLike;
  reconstructState: ReconstructStateLike;
  onAnalyzePromptChange: (value: string) => void;
  onAnalyzePrompt: () => void;
  onApplyPromptStructure: () => void;
  onProblemNotesChange: (value: string) => void;
  onReconstructFigure: () => void;
  onApplyReconstruction: () => void;
  renderPlannerActionSections: (source: "analysis" | "reconstruction", actions: PlannerAction[]) => React.ReactNode;
  renderTargetChip: (source: "analysis" | "reconstruction", originId: string, target: PlannerTargetRef, extraClassName?: string) => React.ReactNode;
};

export function SemanticAssistantPanel(props: Props) {
  const copy = UI_COPY[props.language];

  return (
    <div className="semantic-assistant-panel property-block advanced-tools-block">
      <details>
        <summary>{copy.sections.promptPlanner}</summary>
        <div className="advanced-tool-content">
          <p className="library-hint">{copy.messages.promptHint}</p>
          <label>
            <span>{copy.labels.prompt}</span>
            <textarea onChange={(event) => props.onAnalyzePromptChange(event.target.value)} rows={5} value={props.analyzeState.prompt} />
          </label>
          <div className="prompt-actions-row">
            <button className="secondary-button" onClick={props.onAnalyzePrompt} type="button">
              {copy.actions.analyzePrompt}
            </button>
            <button className="secondary-button" disabled={!props.analyzeState.response || props.analyzeState.acceptedActionIds.length === 0} onClick={props.onApplyPromptStructure} type="button">
              {copy.actions.applyStructure}
            </button>
          </div>
          <div className="response-panel compact-response-panel">
            <div className="response-header">
              <strong>{copy.labels.analysisStatus}</strong>
              {props.analyzeState.mode ? <span className={`mode-badge mode-${props.analyzeState.mode}`}>{props.analyzeState.mode}</span> : null}
            </div>
            {props.analyzeState.response ? (
              <>
                <p>{props.analyzeState.response.summary}</p>
                <div className="token-list">
                  {props.analyzeState.response.entities.map((entity) => (
                    <span className="token-chip" key={entity.id}>
                      {entity.label}
                      {entity.libraryItemId ? ` · ${entity.libraryItemId}` : ""}
                    </span>
                  ))}
                </div>
                <div className="token-list relation-list">
                  {props.analyzeState.response.relations.map((relation) => (
                    <span className="token-chip relation-chip" key={relation.id}>
                      {relation.semantics}
                    </span>
                  ))}
                </div>
                <div className="response-subsection">
                  <strong>{copy.labels.proposedActions}</strong>
                  {props.analyzeState.response.actions.length > 0 ? props.renderPlannerActionSections("analysis", props.analyzeState.response.actions) : <p>{copy.messages.noActions}</p>}
                </div>
                {props.analyzeState.message ? <p className="technical-note">{props.analyzeState.message}</p> : null}
              </>
            ) : (
              <p>{copy.messages.noPromptAnalysis}</p>
            )}
          </div>
        </div>
      </details>

      <details>
        <summary>{copy.sections.reconstruction}</summary>
        <div className="advanced-tool-content">
          <label>
            <span>{copy.labels.problemNotes}</span>
            <textarea onChange={(event) => props.onProblemNotesChange(event.target.value)} rows={4} value={props.reconstructState.problemNotes} />
          </label>
          <div className="prompt-actions-row">
            <button className="secondary-button" onClick={props.onReconstructFigure} type="button">
              {copy.actions.reconstructFigure}
            </button>
            <button className="secondary-button" disabled={!props.reconstructState.response || props.reconstructState.acceptedActionIds.length === 0} onClick={props.onApplyReconstruction} type="button">
              {copy.actions.applyReconstruction}
            </button>
          </div>
          <div className="response-panel compact-response-panel">
            <div className="response-header">
              <strong>{copy.labels.reconstructionStatus}</strong>
              {props.reconstructState.mode ? <span className={`mode-badge mode-${props.reconstructState.mode}`}>{props.reconstructState.mode}</span> : null}
            </div>
            {props.reconstructState.response ? (
              <>
                <p>{props.reconstructState.response.correctedSummary}</p>
                <div className="token-list relation-list">
                  {props.reconstructState.response.issues.map((issue, index) => (
                    <article className="issue-card" key={`${issue.code}-${index}`}>
                      <strong>{issue.code}</strong>
                      <p>{issue.message}</p>
                    </article>
                  ))}
                </div>
                <div className="response-subsection">
                  <strong>{copy.labels.proposedActions}</strong>
                  {props.reconstructState.response.actions.length > 0 ? props.renderPlannerActionSections("reconstruction", props.reconstructState.response.actions) : <p>{copy.messages.noActions}</p>}
                </div>
                {props.reconstructState.message ? <p className="technical-note">{props.reconstructState.message}</p> : null}
              </>
            ) : (
              <p>{copy.messages.noReconstruction}</p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}

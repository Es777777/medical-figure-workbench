type Props = {
  title: string;
  steps: string[];
  dismissLabel: string;
  onDismiss: () => void;
};

export function OnboardingCard(props: Props) {
  return (
    <div className="onboarding-card">
      <div className="onboarding-card-header">
        <strong>{props.title}</strong>
        <button className="secondary-button subtle-button" onClick={props.onDismiss} type="button">
          {props.dismissLabel}
        </button>
      </div>
      <ol className="onboarding-steps">
        {props.steps.map((step, index) => (
          <li key={`${index}-${step}`}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

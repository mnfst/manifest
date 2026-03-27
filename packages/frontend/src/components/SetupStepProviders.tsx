import { type Component } from 'solid-js';

interface Props {
  agentName: string;
  onGoToRouting: () => void;
  onSkip?: () => void;
}

const SetupStepProviders: Component<Props> = (props) => {
  return (
    <div>
      <h3 class="setup-step__heading">Connect your LLM providers</h3>
      <p class="setup-step__desc">
        Manifest routes each request to the best model for the job. Connect at least one provider so{' '}
        <code class="api-key-display__code">manifest/auto</code> can resolve requests.
      </p>

      <div class="api-key-display__warning" style="margin-bottom: 16px;">
        Without a connected provider, requests to{' '}
        <code class="api-key-display__code">manifest/auto</code> will return an error.
      </div>

      <div style="display: flex; align-items: center; gap: 12px;">
        <button class="btn btn--primary btn--sm" onClick={() => props.onGoToRouting()}>
          Connect a provider
        </button>
        {props.onSkip && (
          <button
            class="btn btn--ghost btn--sm"
            onClick={() => props.onSkip!()}
            style="color: hsl(var(--muted-foreground));"
          >
            I'll do this later
          </button>
        )}
      </div>
    </div>
  );
};

export default SetupStepProviders;

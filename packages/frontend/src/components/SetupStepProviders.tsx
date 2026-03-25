import { type Component } from 'solid-js';

interface Props {
  agentName: string;
  onGoToRouting: () => void;
}

const SetupStepProviders: Component<Props> = (props) => {
  return (
    <div>
      <h3 style="margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 600;">
        Set up routing
      </h3>
      <p style="margin: 0 0 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
        Add your API keys so Manifest can pick the right model for each request. Cheaper models
        handle simple tasks, expensive ones kick in when they're needed.
      </p>

      <button class="btn btn--primary btn--sm" onClick={() => props.onGoToRouting()}>
        Go to routing
      </button>
    </div>
  );
};

export default SetupStepProviders;

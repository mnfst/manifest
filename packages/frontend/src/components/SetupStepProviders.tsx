import { type Component } from 'solid-js';

interface Props {
  agentName: string;
  onGoToRouting: () => void;
}

const SetupStepProviders: Component<Props> = (props) => {
  return (
    <div>
      <h3 style="margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 600;">
        Connect your models
      </h3>
      <p style="margin: 0 0 12px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
        Manifest needs at least one LLM provider to route requests. Add your API keys so it can pick
        the right model for each request -- cheaper models handle simple tasks, expensive ones kick
        in when needed.
      </p>

      <div style="background: hsl(var(--chart-5) / 0.1); border: 1px solid hsl(var(--chart-5) / 0.3); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 16px; font-size: var(--font-size-sm); color: hsl(var(--foreground)); line-height: 1.5;">
        Without a connected provider, requests to{' '}
        <code style="font-family: var(--font-mono); font-size: var(--font-size-sm); background: hsl(var(--muted)); padding: 2px 6px; border-radius: 4px;">
          manifest/auto
        </code>{' '}
        will fail.
      </div>

      <button class="btn btn--primary btn--sm" onClick={() => props.onGoToRouting()}>
        Go to routing
      </button>
    </div>
  );
};

export default SetupStepProviders;

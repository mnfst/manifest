import { Show, type Component } from 'solid-js';
import { CopyButton } from './SetupStepInstall.jsx';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
}

const SetupStepLocalConfigure: Component<Props> = (props) => {
  return (
    <div>
      <h3 style="margin: 0 0 4px; font-size: var(--font-size-base); font-weight: 600;">
        Your agent is ready
      </h3>
      <p style="margin: 0 0 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
        Your local server is running and your agent is pre-configured. Use{' '}
        <code style="font-family: var(--font-mono); font-size: var(--font-size-sm); background: hsl(var(--muted)); padding: 2px 6px; border-radius: 4px;">
          manifest/auto
        </code>{' '}
        as your model to route requests through Manifest.
      </p>

      <Show when={!!props.apiKey}>
        <div style="background: hsl(var(--chart-5) / 0.1); border: 1px solid hsl(var(--chart-5) / 0.3); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 12px; font-size: var(--font-size-sm); color: hsl(var(--foreground));">
          Copy your API key now -- it will not be shown again.
        </div>
        <div style="display: flex; align-items: center; gap: 8px; background: hsl(var(--muted)); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 16px; font-family: var(--font-mono); font-size: var(--font-size-sm); word-break: break-all;">
          {props.apiKey}
          <CopyButton text={props.apiKey!} />
        </div>
      </Show>

      <Show when={!props.apiKey && props.keyPrefix}>
        <div style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); font-family: var(--font-mono); padding: 10px 14px; background: hsl(var(--muted)); border-radius: var(--radius); margin-bottom: 16px;">
          Active key: {props.keyPrefix}...
        </div>
      </Show>

      <div style="background: hsl(var(--muted)); border-radius: var(--radius); padding: 14px; font-size: var(--font-size-sm); line-height: 1.6;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="hsl(var(--chart-4))"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Plugin installed and configured</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="hsl(var(--chart-4))"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>API key auto-generated</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="hsl(var(--chart-4))"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>
            Base URL:{' '}
            <code style="font-family: var(--font-mono); font-size: var(--font-size-xs);">
              {props.baseUrl}
            </code>
          </span>
        </div>
      </div>
    </div>
  );
};

export default SetupStepLocalConfigure;

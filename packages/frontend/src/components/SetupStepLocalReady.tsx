import { Show, type Component } from 'solid-js';
import ApiKeyDisplay from './ApiKeyDisplay.jsx';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
}

function CheckIcon() {
  return (
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
  );
}

const SetupStepLocalReady: Component<Props> = (props) => {
  return (
    <div>
      <h3 class="setup-step__heading">Your agent is ready</h3>
      <p class="setup-step__desc">
        Your local server is running and your agent is pre-configured. Use{' '}
        <code class="api-key-display__code">manifest/auto</code> as your model to route requests
        through Manifest.
      </p>

      <ApiKeyDisplay apiKey={props.apiKey} keyPrefix={props.keyPrefix} />

      <div class="setup-checklist">
        <div class="setup-checklist__item">
          <CheckIcon />
          <span>Plugin installed and configured</span>
        </div>
        <div class="setup-checklist__item">
          <CheckIcon />
          <span>API key auto-generated</span>
        </div>
        <div class="setup-checklist__item">
          <CheckIcon />
          <span>
            Base URL:{' '}
            <code class="api-key-display__code" style="font-size: var(--font-size-xs);">
              {props.baseUrl}
            </code>
          </span>
        </div>
      </div>

      <Show when={!props.apiKey}>
        <p class="setup-step__desc" style="margin-top: 16px; margin-bottom: 0;">
          Set <strong>manifest/auto</strong> as your model, send a message, and activity will appear
          on the dashboard within a few seconds.
        </p>
      </Show>
    </div>
  );
};

export default SetupStepLocalReady;

import { createSignal, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import CodeBlock from './CodeBlock.jsx';
import { highlight } from '../services/syntax-highlight.js';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
}

const EyeIcon: Component<{ open: boolean }> = (props) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <Show
      when={props.open}
      fallback={
        <>
          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
          <circle cx="12" cy="12" r="3" />
        </>
      }
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </Show>
  </svg>
);

const OnboardField: Component<{
  label: string;
  value: string;
  copyable?: boolean;
}> = (props) => (
  <div class="setup-onboard-fields__row" role="listitem">
    <span class="setup-onboard-fields__label">{props.label}</span>
    <span class="setup-onboard-fields__value">
      <code>{props.value}</code>
      <Show when={props.copyable}>
        <CopyButton text={props.value} />
      </Show>
    </span>
  </div>
);

const HermesSetup: Component<Props> = (props) => {
  const [keyRevealed, setKeyRevealed] = createSignal(false);
  const hasFullKey = () => !!props.apiKey;
  const masked = () => (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');
  const displayKey = () => (keyRevealed() && props.apiKey ? props.apiKey : masked());
  const copyKey = () => props.apiKey ?? masked();

  const yamlConfig = () =>
    `model:\n  provider: custom\n  base_url: ${props.baseUrl}\n  api_key: ${displayKey()}\n  default: auto`;
  const yamlConfigCopy = () =>
    `model:\n  provider: custom\n  base_url: ${props.baseUrl}\n  api_key: ${copyKey()}\n  default: auto`;

  return (
    <div class="setup-agents-card">
      <p class="setup-step__desc">
        Point Hermes at the Manifest endpoint to route requests through your configured providers.
      </p>

      <p class="setup-method__hint">Open the Hermes configuration file:</p>
      <CodeBlock code="hermes config edit" language="bash" />

      <p class="setup-method__hint" style="margin-top: 12px;">
        Add the following <code class="setup-model-hint__code">model:</code> section to your{' '}
        <code class="setup-model-hint__code">config.yaml</code>:
      </p>
      <div class="setup-cli-block">
        <div class="setup-cli-block__actions">
          <Show when={hasFullKey()}>
            <button
              class="setup-onboard-fields__eye"
              onClick={() => setKeyRevealed(!keyRevealed())}
              aria-label={keyRevealed() ? 'Hide API key' : 'Reveal API key'}
              title={keyRevealed() ? 'Hide key' : 'Reveal key'}
            >
              <EyeIcon open={keyRevealed()} />
            </button>
          </Show>
          <CopyButton text={yamlConfigCopy()} />
        </div>
        <div class="setup-method__code">
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
            <code class="hljs language-yaml" innerHTML={highlight(yamlConfig(), 'yaml')} />
          </pre>
        </div>
      </div>

      <div class="setup-onboard-fields" role="list" aria-label="Configuration values">
        <OnboardField label="Base URL" value={props.baseUrl} copyable />
        <div class="setup-onboard-fields__row" role="listitem">
          <span class="setup-onboard-fields__label">API Key</span>
          <span class="setup-onboard-fields__value">
            <code>{displayKey()}</code>
            <Show when={hasFullKey()}>
              <button
                class="setup-onboard-fields__eye"
                onClick={() => setKeyRevealed(!keyRevealed())}
                aria-label={keyRevealed() ? 'Hide API key' : 'Reveal API key'}
                title={keyRevealed() ? 'Hide key' : 'Reveal key'}
              >
                <EyeIcon open={keyRevealed()} />
              </button>
            </Show>
            <CopyButton text={copyKey()} />
          </span>
        </div>
        <OnboardField label="Model" value="auto" copyable />
      </div>
    </div>
  );
};

export default HermesSetup;

import { createSignal, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import CodeBlock from './CodeBlock.jsx';
import { highlight } from '../services/syntax-highlight.js';

type SubTab = 'cli' | 'wizard';

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
  const [subTab, setSubTab] = createSignal<SubTab>('cli');
  const [cliKeyRevealed, setCliKeyRevealed] = createSignal(false);
  const [wizKeyRevealed, setWizKeyRevealed] = createSignal(false);

  const hasFullKey = () => !!props.apiKey;
  const masked = () => (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');
  const copyKey = () => props.apiKey ?? masked();
  const cliKey = () => (cliKeyRevealed() && props.apiKey ? props.apiKey : masked());
  const wizKey = () => (wizKeyRevealed() && props.apiKey ? props.apiKey : masked());

  const yamlConfig = () =>
    `model:\n  provider: custom\n  base_url: ${props.baseUrl}\n  api_key: ${cliKey()}\n  default: auto`;
  const yamlConfigCopy = () =>
    `model:\n  provider: custom\n  base_url: ${props.baseUrl}\n  api_key: ${copyKey()}\n  default: auto`;

  return (
    <div class="setup-agents-card">
      <p class="setup-step__desc">
        Point Hermes at the Manifest endpoint to route requests across multiple models.
      </p>

      <div
        class="setup-segment setup-segment--full"
        role="tablist"
        aria-label="Configuration method"
      >
        <button
          class="setup-segment__btn"
          classList={{ 'setup-segment__btn--active': subTab() === 'cli' }}
          onClick={() => setSubTab('cli')}
          role="tab"
          aria-selected={subTab() === 'cli'}
        >
          Configuration file
        </button>
        <button
          class="setup-segment__btn"
          classList={{ 'setup-segment__btn--active': subTab() === 'wizard' }}
          onClick={() => setSubTab('wizard')}
          role="tab"
          aria-selected={subTab() === 'wizard'}
        >
          Hermes onboard
        </button>
      </div>

      <Show when={subTab() === 'cli'}>
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
                onClick={() => setCliKeyRevealed(!cliKeyRevealed())}
                aria-label={cliKeyRevealed() ? 'Hide API key' : 'Reveal API key'}
                title={cliKeyRevealed() ? 'Hide key' : 'Reveal key'}
              >
                <EyeIcon open={cliKeyRevealed()} />
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
          <OnboardField label="provider" value="custom" copyable />
          <OnboardField label="base_url" value={props.baseUrl} copyable />
          <div class="setup-onboard-fields__row" role="listitem">
            <span class="setup-onboard-fields__label">api_key</span>
            <span class="setup-onboard-fields__value">
              <code>{cliKey()}</code>
              <Show when={hasFullKey()}>
                <button
                  class="setup-onboard-fields__eye"
                  onClick={() => setCliKeyRevealed(!cliKeyRevealed())}
                  aria-label={cliKeyRevealed() ? 'Hide API key' : 'Reveal API key'}
                  title={cliKeyRevealed() ? 'Hide key' : 'Reveal key'}
                >
                  <EyeIcon open={cliKeyRevealed()} />
                </button>
              </Show>
              <CopyButton text={copyKey()} />
            </span>
          </div>
          <OnboardField label="default" value="auto" copyable />
        </div>
      </Show>

      <Show when={subTab() === 'wizard'}>
        <p class="setup-method__hint">
          Run the onboarding wizard and select <strong>Custom endpoint</strong> when prompted. Then
          enter the following values:
        </p>
        <CodeBlock code="hermes model" language="bash" />
        <div class="setup-onboard-fields" role="list" aria-label="Configuration values">
          <OnboardField label="API base URL" value={props.baseUrl} copyable />
          <div class="setup-onboard-fields__row" role="listitem">
            <span class="setup-onboard-fields__label">API Key</span>
            <span class="setup-onboard-fields__value">
              <code>{wizKey()}</code>
              <Show when={hasFullKey()}>
                <button
                  class="setup-onboard-fields__eye"
                  onClick={() => setWizKeyRevealed(!wizKeyRevealed())}
                  aria-label={wizKeyRevealed() ? 'Hide API key' : 'Reveal API key'}
                  title={wizKeyRevealed() ? 'Hide key' : 'Reveal key'}
                >
                  <EyeIcon open={wizKeyRevealed()} />
                </button>
              </Show>
              <CopyButton text={copyKey()} />
            </span>
          </div>
          <OnboardField label="Model name" value="auto" copyable />
        </div>
      </Show>
    </div>
  );
};

export default HermesSetup;

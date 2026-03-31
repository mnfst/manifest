import { createSignal, For, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';

type MethodId = 'cli' | 'onboard';

const METHOD_TABS: { id: MethodId; label: string }[] = [
  { id: 'cli', label: 'CLI configuration' },
  { id: 'onboard', label: 'Interactive wizard' },
];

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
  hideFullKey?: boolean;
}

const EyeOpen: Component = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeClosed: Component = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </svg>
);

const SetupStepAddProvider: Component<Props> = (props) => {
  const [activeTab, setActiveTab] = createSignal<MethodId>('cli');
  const [keyRevealed, setKeyRevealed] = createSignal(!props.hideFullKey);

  const hasFullKey = () => !!props.apiKey;
  const maskedKey = () => (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');
  const copyKey = () => props.apiKey ?? maskedKey();
  const displayKey = () => {
    if (!hasFullKey()) return maskedKey();
    return keyRevealed() ? props.apiKey! : maskedKey();
  };

  const buildCliSnippet = (key: string) => {
    const providerJson = JSON.stringify({
      baseUrl: props.baseUrl,
      api: 'openai-completions',
      apiKey: key,
      models: [{ id: 'auto', name: 'Manifest Auto' }],
    });
    return `openclaw config set models.providers.manifest '${providerJson}'
openclaw config set agents.defaults.model.primary manifest/auto
openclaw gateway restart`;
  };
  const cliSnippet = () => buildCliSnippet(displayKey());
  const cliSnippetForCopy = () => buildCliSnippet(copyKey());

  const onboardSnippet = () => `openclaw onboard`;

  return (
    <div>
      <h3 class="setup-step__heading">Add Manifest as a provider</h3>
      <p class="setup-step__desc">
        Register Manifest in your OpenClaw config to route each request to the best provider using
        the model <code class="setup-model-hint__code">manifest/auto</code>
      </p>

      <div class="setup-method-tabs">
        <div class="panel__tabs">
          <For each={METHOD_TABS}>
            {(t) => (
              <button
                class="panel__tab"
                classList={{ 'panel__tab--active': activeTab() === t.id }}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            )}
          </For>
        </div>

        <div class="setup-method-tabs__content">
          <Show when={activeTab() === 'cli'}>
            <p class="setup-method__hint">
              Set the provider config and default model directly via CLI commands.
            </p>
            <div
              class="setup-method__code"
              style={hasFullKey() ? 'padding-right: 80px;' : undefined}
            >
              <div class="setup-method__actions">
                <Show when={hasFullKey()}>
                  <button
                    class="btn btn--ghost btn--sm"
                    onClick={() => setKeyRevealed(!keyRevealed())}
                    aria-label={
                      keyRevealed() ? 'Hide API key in snippet' : 'Reveal API key in snippet'
                    }
                    title={keyRevealed() ? 'Hide key' : 'Reveal key'}
                    style="padding: 4px;"
                  >
                    {keyRevealed() ? <EyeClosed /> : <EyeOpen />}
                  </button>
                </Show>
                <CopyButton text={cliSnippetForCopy()} />
              </div>
              <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
                {cliSnippet()}
              </pre>
            </div>
          </Show>

          <Show when={activeTab() === 'onboard'}>
            <p class="setup-method__hint">
              Run the onboarding wizard and select <strong>Custom Provider</strong> when prompted.
              Then enter the following values:
            </p>
            <div class="setup-method__code" style="margin-bottom: 12px;">
              <CopyButton text={onboardSnippet()} />
              <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
                {onboardSnippet()}
              </pre>
            </div>
            <div class="setup-onboard-fields">
              <div class="setup-onboard-fields__row">
                <span class="setup-onboard-fields__label">API Base URL</span>
                <span class="setup-onboard-fields__value">
                  {props.baseUrl}
                  <CopyButton text={props.baseUrl} />
                </span>
              </div>
              <div class="setup-onboard-fields__row">
                <span class="setup-onboard-fields__label">API Key</span>
                <span class="setup-onboard-fields__value">
                  {displayKey()}
                  <Show when={hasFullKey()}>
                    <button
                      class="btn btn--ghost btn--sm"
                      onClick={() => setKeyRevealed(!keyRevealed())}
                      aria-label={
                        keyRevealed() ? 'Hide API key in wizard' : 'Reveal API key in wizard'
                      }
                      style="padding: 4px;"
                    >
                      {keyRevealed() ? <EyeClosed /> : <EyeOpen />}
                    </button>
                  </Show>
                  <CopyButton text={copyKey()} />
                </span>
              </div>
              <div class="setup-onboard-fields__row">
                <span class="setup-onboard-fields__label">Endpoint compatibility</span>
                <span class="setup-onboard-fields__value">OpenAI-compatible</span>
              </div>
              <div class="setup-onboard-fields__row">
                <span class="setup-onboard-fields__label">Model ID</span>
                <span class="setup-onboard-fields__value">
                  auto
                  <CopyButton text="auto" />
                </span>
              </div>
              <div class="setup-onboard-fields__row">
                <span class="setup-onboard-fields__label">Endpoint ID</span>
                <span class="setup-onboard-fields__value">
                  manifest
                  <CopyButton text="manifest" />
                </span>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default SetupStepAddProvider;

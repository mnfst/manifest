import { createSignal, For, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import ApiKeyDisplay from './ApiKeyDisplay.jsx';

type MethodId = 'cli' | 'onboard' | 'env';

const METHOD_TABS: { id: MethodId; label: string }[] = [
  { id: 'cli', label: 'CLI configuration' },
  { id: 'onboard', label: 'Interactive wizard' },
  { id: 'env', label: 'Environment variable' },
];

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
}

const SetupStepAddProvider: Component<Props> = (props) => {
  const [activeTab, setActiveTab] = createSignal<MethodId>('cli');

  const displayKey = () =>
    props.apiKey ?? (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');

  const cliSnippet = () => {
    const providerJson = JSON.stringify({
      baseUrl: props.baseUrl,
      api: 'openai-completions',
      apiKey: displayKey(),
      models: [{ id: 'auto', name: 'Manifest Auto' }],
    });
    return `openclaw config set models.providers.manifest '${providerJson}'
openclaw config set agents.defaults.model.primary manifest/auto
openclaw gateway restart`;
  };

  const onboardSnippet = () => `openclaw onboard`;

  const envSnippet = () => {
    const lines = [`export MANIFEST_API_KEY="${displayKey()}"`];
    if (props.baseUrl && !props.baseUrl.includes('app.manifest.build')) {
      lines.push(`export MANIFEST_ENDPOINT="${props.baseUrl}"`);
    }
    return lines.join('\n');
  };

  return (
    <div>
      <h3 class="setup-step__heading">Add Manifest as a provider</h3>
      <p class="setup-step__desc">
        Register Manifest in your OpenClaw config, then use{' '}
        <code class="api-key-display__code">manifest/auto</code> as the model to route each request
        to the best provider.
      </p>

      <ApiKeyDisplay apiKey={props.apiKey} keyPrefix={props.keyPrefix} />

      <div class="setup-info-grid">
        <div class="setup-info-grid__card">
          <div class="setup-info-grid__label">Base URL</div>
          <div class="setup-info-grid__value">
            <span>{props.baseUrl}</span>
            <CopyButton text={props.baseUrl} />
          </div>
        </div>
        <div class="setup-info-grid__card">
          <div class="setup-info-grid__label">Model</div>
          <div class="setup-info-grid__value">
            <span>manifest/auto</span>
            <CopyButton text="manifest/auto" />
          </div>
        </div>
      </div>

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
            <div class="setup-method__code">
              <CopyButton text={cliSnippet()} />
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
                  <CopyButton text={displayKey()} />
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
            </div>
          </Show>

          <Show when={activeTab() === 'env'}>
            <p class="setup-method__hint">
              OpenClaw detects this automatically. Add to your shell profile or{' '}
              <code class="api-key-display__code">~/.openclaw/.env</code> for persistence.
            </p>
            <div class="setup-method__code">
              <CopyButton text={envSnippet()} />
              <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
                {envSnippet()}
              </pre>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default SetupStepAddProvider;

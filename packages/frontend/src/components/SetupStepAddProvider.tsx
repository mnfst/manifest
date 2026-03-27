import { createSignal, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import ApiKeyDisplay from './ApiKeyDisplay.jsx';

type MethodId = 'cli' | 'onboard' | 'env';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
}

function ChevronIcon(props: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      class={`setup-method__chevron${props.open ? ' setup-method__chevron--open' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const SetupStepAddProvider: Component<Props> = (props) => {
  const [openMethod, setOpenMethod] = createSignal<MethodId>('cli');

  const displayKey = () =>
    props.apiKey ?? (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');

  const toggle = (id: MethodId) => {
    setOpenMethod((cur) => (cur === id ? (null as unknown as MethodId) : id));
  };

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

      {/* Method 1: Manual CLI configuration */}
      <div class="setup-method">
        <button
          class="setup-method__header"
          onClick={() => toggle('cli')}
          aria-expanded={openMethod() === 'cli'}
          aria-controls="method-cli"
        >
          CLI configuration
          <ChevronIcon open={openMethod() === 'cli'} />
        </button>
        <Show when={openMethod() === 'cli'}>
          <div class="setup-method__body" id="method-cli">
            <p class="setup-method__hint">
              Set the provider config and default model directly via CLI commands.
            </p>
            <div class="setup-method__code">
              <CopyButton text={cliSnippet()} />
              <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
                {cliSnippet()}
              </pre>
            </div>
          </div>
        </Show>
      </div>

      {/* Method 2: Interactive onboarding wizard */}
      <div class="setup-method">
        <button
          class="setup-method__header"
          onClick={() => toggle('onboard')}
          aria-expanded={openMethod() === 'onboard'}
          aria-controls="method-onboard"
        >
          Interactive wizard
          <ChevronIcon open={openMethod() === 'onboard'} />
        </button>
        <Show when={openMethod() === 'onboard'}>
          <div class="setup-method__body" id="method-onboard">
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
          </div>
        </Show>
      </div>

      {/* Method 3: Environment variable */}
      <div class="setup-method">
        <button
          class="setup-method__header"
          onClick={() => toggle('env')}
          aria-expanded={openMethod() === 'env'}
          aria-controls="method-env"
        >
          Environment variable
          <ChevronIcon open={openMethod() === 'env'} />
        </button>
        <Show when={openMethod() === 'env'}>
          <div class="setup-method__body" id="method-env">
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
          </div>
        </Show>
      </div>
    </div>
  );
};

export default SetupStepAddProvider;

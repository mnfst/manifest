import { createSignal, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import ApiKeyDisplay from './ApiKeyDisplay.jsx';

type MethodId = 'env' | 'onboard' | 'cli';

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
  const [openMethod, setOpenMethod] = createSignal<MethodId>('env');

  const displayKey = () =>
    props.apiKey ?? (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');

  const toggle = (id: MethodId) => {
    setOpenMethod((cur) => (cur === id ? (null as unknown as MethodId) : id));
  };

  const envSnippet = () => {
    const lines = [`export MANIFEST_API_KEY="${displayKey()}"`];
    if (props.baseUrl && !props.baseUrl.includes('app.manifest.build')) {
      lines.push(`export MANIFEST_ENDPOINT="${props.baseUrl}"`);
    }
    return lines.join('\n');
  };

  const onboardSnippet = () =>
    `openclaw onboard \\
  --auth-choice manifest-api-key \\
  --manifest-api-key "${displayKey()}" \\
  --non-interactive`;

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

      {/* Method 1: Environment variable (recommended) */}
      <div class={`setup-method${openMethod() === 'env' ? ' setup-method--recommended' : ''}`}>
        <button
          class="setup-method__header"
          onClick={() => toggle('env')}
          aria-expanded={openMethod() === 'env'}
          aria-controls="method-env"
        >
          Set an environment variable
          <span class="setup-method__badge">Recommended</span>
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

      {/* Method 2: One-command setup */}
      <div class="setup-method">
        <button
          class="setup-method__header"
          onClick={() => toggle('onboard')}
          aria-expanded={openMethod() === 'onboard'}
          aria-controls="method-onboard"
        >
          One-command setup
          <ChevronIcon open={openMethod() === 'onboard'} />
        </button>
        <Show when={openMethod() === 'onboard'}>
          <div class="setup-method__body" id="method-onboard">
            <p class="setup-method__hint">
              Runs the OpenClaw onboarding wizard non-interactively with your API key.
            </p>
            <div class="setup-method__code">
              <CopyButton text={onboardSnippet()} />
              <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">
                {onboardSnippet()}
              </pre>
            </div>
          </div>
        </Show>
      </div>

      {/* Method 3: Manual CLI */}
      <div class="setup-method">
        <button
          class="setup-method__header"
          onClick={() => toggle('cli')}
          aria-expanded={openMethod() === 'cli'}
          aria-controls="method-cli"
        >
          Manual CLI configuration
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
    </div>
  );
};

export default SetupStepAddProvider;

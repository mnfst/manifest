import { createSignal, Show, type Component } from 'solid-js';
import CopyButton from './CopyButton.jsx';
import CodeBlock from './CodeBlock.jsx';
import FrameworkSnippets from './FrameworkSnippets.jsx';
import { getOpenClawSnippet, getOpenClawWizardSnippet } from '../services/framework-snippets.js';

type SetupTab = 'toolkits' | 'agents';
type AgentId = 'openclaw' | 'hermes';
type AgentSubTab = 'cli' | 'wizard';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
  hideFullKey?: boolean;
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
  copyText?: string;
}> = (props) => (
  <div class="setup-onboard-fields__row" role="listitem">
    <span class="setup-onboard-fields__label">{props.label}</span>
    <span class="setup-onboard-fields__value">
      <code>{props.value}</code>
      <Show when={props.copyable || props.copyText}>
        <CopyButton text={props.copyText ?? props.value} />
      </Show>
    </span>
  </div>
);

const SetupStepAddProvider: Component<Props> = (props) => {
  const [activeTab, setActiveTab] = createSignal<SetupTab>('agents');
  const [activeAgent, setActiveAgent] = createSignal<AgentId>('openclaw');
  const [agentSubTab, setAgentSubTab] = createSignal<AgentSubTab>('cli');
  const [cliKeyRevealed, setCliKeyRevealed] = createSignal(false);
  const [wizardKeyRevealed, setWizardKeyRevealed] = createSignal(false);

  const hasFullKey = () => !!props.apiKey;
  const maskedKey = () => (props.keyPrefix ? `${props.keyPrefix}...` : 'mnfst_YOUR_KEY');
  const copyKey = () => props.apiKey ?? maskedKey();
  const keyHidden = () => !hasFullKey() || !cliKeyRevealed();
  const wizardKeyHidden = () => !hasFullKey() || !wizardKeyRevealed();
  const cliDisplayKey = () => (cliKeyRevealed() && props.apiKey ? props.apiKey : maskedKey());
  const wizardDisplayKey = () => (wizardKeyRevealed() && props.apiKey ? props.apiKey : maskedKey());

  const openClawCli = () => getOpenClawSnippet(props.baseUrl, cliDisplayKey());
  const openClawCliCopy = () => getOpenClawSnippet(props.baseUrl, copyKey());

  return (
    <div>
      <h3 class="setup-step__heading">Connect your agent to Manifest</h3>
      <p class="setup-step__desc">
        Point your agent at the Manifest endpoint using the model{' '}
        <code class="setup-model-hint__code">auto</code>
      </p>

      <div class="setup-segment" role="tablist" aria-label="Setup method">
        <button
          class="setup-segment__btn"
          classList={{ 'setup-segment__btn--active': activeTab() === 'agents' }}
          onClick={() => setActiveTab('agents')}
          role="tab"
          aria-selected={activeTab() === 'agents'}
          aria-controls="panel-agents"
        >
          Agents
        </button>
        <button
          class="setup-segment__btn"
          classList={{ 'setup-segment__btn--active': activeTab() === 'toolkits' }}
          onClick={() => setActiveTab('toolkits')}
          role="tab"
          aria-selected={activeTab() === 'toolkits'}
          aria-controls="panel-toolkits"
        >
          Toolkits
        </button>
      </div>

      <Show when={activeTab() === 'toolkits'}>
        <div id="panel-toolkits" role="tabpanel" aria-label="Toolkits">
          <FrameworkSnippets
            apiKey={props.apiKey}
            keyPrefix={props.keyPrefix}
            baseUrl={props.baseUrl}
            hideFullKey={props.hideFullKey}
          />
        </div>
      </Show>

      <Show when={activeTab() === 'agents'}>
        <div id="panel-agents" role="tabpanel" aria-label="Agents">
          <div class="setup-method-tabs">
            <div class="panel__tabs" role="tablist" aria-label="Agent framework">
              <button
                class="panel__tab"
                classList={{ 'panel__tab--active': activeAgent() === 'openclaw' }}
                onClick={() => setActiveAgent('openclaw')}
                role="tab"
                aria-selected={activeAgent() === 'openclaw'}
                aria-controls="panel-openclaw"
              >
                <img
                  src="/icons/openclaw.png"
                  alt=""
                  class="panel__tab-icon"
                  width="16"
                  height="16"
                />
                OpenClaw
              </button>
              <button
                class="panel__tab"
                classList={{ 'panel__tab--active': activeAgent() === 'hermes' }}
                onClick={() => setActiveAgent('hermes')}
                role="tab"
                aria-selected={activeAgent() === 'hermes'}
                aria-controls="panel-hermes"
              >
                <img
                  src="/icons/hermes.png"
                  alt=""
                  class="panel__tab-icon"
                  width="16"
                  height="16"
                />
                Hermes Agent
              </button>
            </div>
          </div>

          <Show when={activeAgent() === 'hermes'}>
            <div id="panel-hermes" role="tabpanel" aria-label="Hermes Agent">
              <div class="setup-agents-coming-soon">
                <p class="setup-agents-coming-soon__text">Coming soon</p>
              </div>
            </div>
          </Show>

          <Show when={activeAgent() === 'openclaw'}>
            <div id="panel-openclaw" role="tabpanel" aria-label="OpenClaw setup">
              <div class="setup-agents-card">
                <h4 class="setup-agents-card__title">Add Manifest as a provider</h4>
                <p class="setup-step__desc">
                  Register Manifest in your OpenClaw config to route each request to the best
                  provider using the model <code class="setup-model-hint__code">manifest/auto</code>
                </p>

                <div
                  class="setup-segment setup-segment--full"
                  role="tablist"
                  aria-label="Configuration method"
                >
                  <button
                    class="setup-segment__btn"
                    classList={{ 'setup-segment__btn--active': agentSubTab() === 'cli' }}
                    onClick={() => setAgentSubTab('cli')}
                    role="tab"
                    aria-selected={agentSubTab() === 'cli'}
                    aria-controls="panel-cli"
                  >
                    CLI configuration
                  </button>
                  <button
                    class="setup-segment__btn"
                    classList={{ 'setup-segment__btn--active': agentSubTab() === 'wizard' }}
                    onClick={() => setAgentSubTab('wizard')}
                    role="tab"
                    aria-selected={agentSubTab() === 'wizard'}
                    aria-controls="panel-wizard"
                  >
                    Interactive wizard
                  </button>
                </div>

                <Show when={agentSubTab() === 'cli'}>
                  <div id="panel-cli" role="tabpanel" aria-label="CLI configuration">
                    <p class="setup-method__hint">
                      Set the provider config and default model directly via CLI commands.
                    </p>
                    <div class="setup-cli-block">
                      <div class="setup-cli-block__actions">
                        <Show when={hasFullKey()}>
                          <button
                            class="modal-terminal__copy"
                            onClick={() => setCliKeyRevealed(!cliKeyRevealed())}
                            aria-label={cliKeyRevealed() ? 'Hide API key' : 'Reveal API key'}
                            title={cliKeyRevealed() ? 'Hide key' : 'Reveal key'}
                          >
                            <EyeIcon open={cliKeyRevealed()} />
                          </button>
                        </Show>
                        <CopyButton text={openClawCliCopy()} disabled={keyHidden()} />
                      </div>
                      <CodeBlock code={openClawCli()} language="bash" />
                    </div>
                  </div>
                </Show>

                <Show when={agentSubTab() === 'wizard'}>
                  <div id="panel-wizard" role="tabpanel" aria-label="Interactive wizard">
                    <p class="setup-method__hint">
                      Run the onboarding wizard and select <strong>Custom Provider</strong> when
                      prompted. Then enter the following values:
                    </p>
                    <CodeBlock code={getOpenClawWizardSnippet()} language="bash" />

                    <div class="setup-onboard-fields" role="list" aria-label="Configuration values">
                      <OnboardField label="API Base URL" value={props.baseUrl} copyable />
                      <div class="setup-onboard-fields__row" role="listitem">
                        <span class="setup-onboard-fields__label">API Key</span>
                        <span class="setup-onboard-fields__value">
                          <code>{wizardDisplayKey()}</code>
                          <Show when={hasFullKey()}>
                            <button
                              class="modal-terminal__copy"
                              onClick={() => setWizardKeyRevealed(!wizardKeyRevealed())}
                              aria-label={wizardKeyRevealed() ? 'Hide API key' : 'Reveal API key'}
                              title={wizardKeyRevealed() ? 'Hide key' : 'Reveal key'}
                            >
                              <EyeIcon open={wizardKeyRevealed()} />
                            </button>
                          </Show>
                          <CopyButton text={copyKey()} disabled={wizardKeyHidden()} />
                        </span>
                      </div>
                      <OnboardField label="Endpoint compatibility" value="OpenAI-compatible" />
                      <OnboardField label="Model ID" value="auto" copyable />
                      <OnboardField label="Endpoint ID" value="manifest" copyable />
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default SetupStepAddProvider;

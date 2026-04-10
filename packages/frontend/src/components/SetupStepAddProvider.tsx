import { createSignal, createMemo, Show, Switch, Match, type Component } from 'solid-js';
import FrameworkSnippets from './FrameworkSnippets.jsx';
import OpenClawSetup from './OpenClawSetup.jsx';
import HermesSetup from './HermesSetup.jsx';
import type { ToolkitId } from '../services/framework-snippets.js';

type SetupTab = 'toolkits' | 'agents';
type AgentId = 'openclaw' | 'hermes';

interface Props {
  apiKey: string | null;
  keyPrefix: string | null;
  baseUrl: string;
  hideFullKey?: boolean;
  platform?: string | null;
}

const PLATFORM_TO_TOOLKIT: Record<string, ToolkitId> = {
  'openai-sdk': 'openai-sdk',
  'vercel-ai-sdk': 'vercel-ai-sdk',
  langchain: 'langchain',
  curl: 'curl',
};

const SetupStepAddProvider: Component<Props> = (props) => {
  const [activeTab, setActiveTab] = createSignal<SetupTab>('agents');
  const [activeAgent, setActiveAgent] = createSignal<AgentId>('openclaw');

  const snippetProps = createMemo(() => ({
    apiKey: props.apiKey,
    keyPrefix: props.keyPrefix,
    baseUrl: props.baseUrl,
  }));

  const isFiltered = () => !!props.platform;
  const isPersonalAgent = () => props.platform === 'openclaw' || props.platform === 'hermes';
  const toolkitId = () => (props.platform ? PLATFORM_TO_TOOLKIT[props.platform] : undefined);

  return (
    <div>
      <h3 class="setup-step__heading">
        {props.platform === 'hermes'
          ? 'Connect your Hermes agent to Manifest'
          : props.platform === 'openclaw'
            ? 'Connect your OpenClaw agent to Manifest'
            : 'Connect your agent to Manifest'}
      </h3>

      {/* Platform-filtered mode: show only relevant content */}
      <Show when={isFiltered()}>
        <Switch>
          <Match when={props.platform === 'openclaw'}>
            <OpenClawSetup {...snippetProps()} />
          </Match>
          <Match when={props.platform === 'hermes'}>
            <HermesSetup {...snippetProps()} />
          </Match>
          <Match when={toolkitId()}>
            <FrameworkSnippets
              {...snippetProps()}
              hideFullKey={props.hideFullKey}
              defaultToolkit={toolkitId()!}
            />
          </Match>
          <Match when={props.platform === 'other'}>
            <FrameworkSnippets
              {...snippetProps()}
              hideFullKey={props.hideFullKey}
              defaultToolkit="curl"
            />
          </Match>
        </Switch>
      </Show>

      {/* Default / "other": show full tabbed UI */}
      <Show when={!isFiltered()}>
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
          >
            Agents
          </button>
          <button
            class="setup-segment__btn"
            classList={{ 'setup-segment__btn--active': activeTab() === 'toolkits' }}
            onClick={() => setActiveTab('toolkits')}
            role="tab"
            aria-selected={activeTab() === 'toolkits'}
          >
            Toolkits
          </button>
        </div>

        <Show when={activeTab() === 'toolkits'}>
          <FrameworkSnippets {...snippetProps()} hideFullKey={props.hideFullKey} />
        </Show>

        <Show when={activeTab() === 'agents'}>
          <div class="setup-method-tabs">
            <div class="panel__tabs" role="tablist" aria-label="Agent framework">
              <button
                class="panel__tab"
                classList={{ 'panel__tab--active': activeAgent() === 'openclaw' }}
                onClick={() => setActiveAgent('openclaw')}
                role="tab"
                aria-selected={activeAgent() === 'openclaw'}
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

          <Switch>
            <Match when={activeAgent() === 'openclaw'}>
              <OpenClawSetup {...snippetProps()} />
            </Match>
            <Match when={activeAgent() === 'hermes'}>
              <HermesSetup {...snippetProps()} />
            </Match>
          </Switch>
        </Show>
      </Show>
    </div>
  );
};

export default SetupStepAddProvider;

import { Meta, Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createSignal, For, Show, type Component } from 'solid-js';
import { agentDisplayName } from '../services/agent-display-name.js';
import { toast } from '../services/toast-store.js';

interface FreeModel {
  model_id: string;
  context: string;
  max_output: string;
  modality: string;
  trial_rate_limit: string;
}

interface FreeProvider {
  name: string;
  logo?: string;
  description: string;
  tags?: string[];
  apiKeyUrl: string;
  baseUrl: string;
  warning: string;
  models: FreeModel[];
}

const PROVIDERS: FreeProvider[] = [
  {
    name: 'Cohere',
    logo: '/icons/cohere.svg',
    description: '',
    tags: ['Up to 1,000 calls/month', 'No credit card required'],
    apiKeyUrl: 'https://dashboard.cohere.com/api-keys',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    warning:
      'Trial keys cannot be used for production or commercial workloads. Data may be used for training.',
    models: [
      {
        model_id: 'command-a-03-2025',
        context: '256K',
        max_output: '8K',
        modality: 'Text',
        trial_rate_limit: '20 req / min',
      },
      {
        model_id: 'command-a-reasoning-08-2025',
        context: '256K',
        max_output: '32K',
        modality: 'Text',
        trial_rate_limit: '20 req / min',
      },
    ],
  },
];

const ExternalLinkIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    style="margin-left: 4px;"
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CopyButton: Component<{ text: string }> = (props) => {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <button
      class="btn btn--outline btn--sm"
      style="padding: 2px 8px; font-size: var(--font-size-xs);"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
    >
      {copied() ? 'Copied' : 'Copy'}
    </button>
  );
};

const ConnectButton: Component<{ provider: FreeProvider }> = (props) => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const models = () => props.provider.models.map((m) => `${m.model_id}:0:0`).join(',');

  const href = () =>
    `/agents/${encodeURIComponent(agentName())}/routing?provider=custom&name=${encodeURIComponent(props.provider.name)}&baseUrl=${encodeURIComponent(props.provider.baseUrl)}&models=${encodeURIComponent(models())}`;

  return (
    <a href={href()} class="btn btn--primary btn--sm" style="text-decoration: none;">
      Connect {props.provider.name}
    </a>
  );
};

const FreeModels: Component = () => {
  return (
    <div class="container--lg">
      <Title>Free Models - Manifest</Title>
      <Meta
        name="description"
        content="Free LLM models you can use with Manifest. No credit card required."
      />
      <div class="page-header">
        <div>
          <h1>Free Models</h1>
          <span class="breadcrumb">
            Cloud providers offering free API access for {agentDisplayName() ?? 'your agent'}
          </span>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-size: var(--font-size-xs); font-weight: 600; flex-shrink: 0;">
            1
          </span>
          <span style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));">
            Get your free API key from the provider website
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-size: var(--font-size-xs); font-weight: 600; flex-shrink: 0;">
            2
          </span>
          <span style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));">
            Hit the provider Connect button, paste your key, and validate the connection
          </span>
        </div>
      </div>

      <For each={PROVIDERS}>
        {(provider) => (
          <div class="panel" style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 8px;">
              <h2 style="margin: 0; font-size: var(--font-size-lg); display: flex; align-items: center; gap: 8px;">
                {provider.logo && <img src={provider.logo} alt="" style="height: 20px;" />}
                {provider.name}
              </h2>
              <div style="display: flex; gap: 8px; flex-shrink: 0;">
                <a
                  href={provider.apiKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn btn--outline btn--sm"
                  style="text-decoration: none;"
                >
                  Get API key
                  <ExternalLinkIcon />
                </a>
                <ConnectButton provider={provider} />
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 16px; flex-wrap: wrap;">
              <For each={provider.tags ?? []}>
                {(tag) => (
                  <span style="display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-size-sm); color: hsl(var(--foreground)); white-space: nowrap;">
                    <span style="width: 5px; height: 5px; border-radius: 50%; background: hsl(var(--foreground)); flex-shrink: 0;" />
                    {tag}
                  </span>
                )}
              </For>
            </div>

            {(() => {
              const [showModels, setShowModels] = createSignal(true);
              return (
                <>
                  <div class="free-models-base-url-row">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                      <span style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); flex-shrink: 0;">
                        Base URL:
                      </span>
                      <code style="font-family: var(--font-mono); font-size: var(--font-size-xs); background: hsl(var(--muted) / 0.5); padding: 4px 8px; border-radius: var(--radius); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">
                        {provider.baseUrl}
                      </code>
                      <CopyButton text={provider.baseUrl} />
                    </div>
                    <button
                      style="display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-size-sm); color: hsl(var(--foreground)); padding: 0; background: none; border: none; cursor: pointer; white-space: nowrap; margin-left: auto; font-weight: 500;"
                      onClick={() => setShowModels((v) => !v)}
                    >
                      {showModels() ? 'Hide models' : `Show models (${provider.models.length})`}
                      <img
                        src="/icons/caret-down.svg"
                        alt=""
                        class="free-models-caret"
                        style={`width: 20px; height: 20px; transition: transform 250ms ease; transform: rotate(${showModels() ? '180deg' : '0deg'});`}
                      />
                    </button>
                  </div>

                  <div
                    class="free-models-accordion"
                    classList={{ 'free-models-accordion--open': showModels() }}
                  >
                    <div>
                      <Show when={provider.warning}>
                        <div style="display: flex; align-items: flex-start; gap: 8px; padding: 10px 14px; border-radius: var(--radius); background: hsl(var(--chart-5) / 0.1); margin-top: 16px; margin-bottom: 16px; font-size: var(--font-size-sm);">
                          <span style="flex-shrink: 0; color: hsl(var(--chart-5));">&#9888;</span>
                          <span style="color: hsl(var(--foreground) / 0.8);">
                            {provider.warning}
                          </span>
                        </div>
                      </Show>

                      <table
                        class="data-table"
                        style={provider.warning ? undefined : 'margin-top: 16px;'}
                      >
                        <thead>
                          <tr>
                            <th>Model Name</th>
                            <th>Context</th>
                            <th>Max Output</th>
                            <th>Modality</th>
                            <th>Trial Rate Limit</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={provider.models}>
                            {(model) => (
                              <tr>
                                <td style="font-family: var(--font-mono); font-size: var(--font-size-xs);">
                                  {model.model_id}
                                </td>
                                <td style="font-size: var(--font-size-sm);">{model.context}</td>
                                <td style="font-size: var(--font-size-sm);">{model.max_output}</td>
                                <td style="font-size: var(--font-size-sm);">{model.modality}</td>
                                <td style="font-size: var(--font-size-sm);">
                                  {model.trial_rate_limit}
                                </td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </For>
    </div>
  );
};

export default FreeModels;

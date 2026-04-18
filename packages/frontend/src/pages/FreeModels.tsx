import { Meta, Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import ErrorState from '../components/ErrorState.jsx';
import { agentDisplayName } from '../services/agent-display-name.js';
import { getFreeModels, type FreeProviderDto } from '../services/api.js';
import { PROVIDERS } from '../services/providers.js';
import { checkIsLocalMode } from '../services/setup-status.js';
import { toast } from '../services/toast-store.js';

/** Logos that have a `-dark-mode` variant in /icons/ */
const DARK_MODE_LOGOS = new Set([
  '/icons/github.svg',
  '/icons/ollama.svg',
  '/icons/zai.svg',
  '/icons/cerebras.svg',
]);

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

/**
 * Map free-model provider names to built-in provider IDs.
 * When a match exists, the Connect button links directly to the
 * provider modal instead of the custom-provider form.
 */
const FREE_TO_BUILTIN: Record<string, string> = {
  Cohere: 'custom',
  'Google Gemini': 'gemini',
  'Mistral AI': 'mistral',
  'Z AI': 'zai',
  Groq: 'custom',
  'Hugging Face': 'custom',
  'Kilo Code': 'custom',
  'NVIDIA NIM': 'custom',
  'Ollama Cloud': 'ollama',
  OpenRouter: 'openrouter',
  SiliconFlow: 'custom',
  Cerebras: 'custom',
  'Cloudflare Workers AI': 'custom',
  'GitHub Models': 'custom',
  'LLM7.io': 'custom',
};

const ConnectButton: Component<{ provider: FreeProviderDto }> = (props) => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);
  const [isLocal] = createResource(() => checkIsLocalMode());

  const builtinId = () => FREE_TO_BUILTIN[props.provider.name];
  const builtin = () => {
    const id = builtinId();
    return id && id !== 'custom' ? PROVIDERS.find((p) => p.id === id) : undefined;
  };

  const models = () => {
    const withId = props.provider.models.filter((m) => m.id);
    if (withId.length === 0) return '';
    return withId.map((m) => `${m.id}:0:0`).join(',');
  };

  const href = () => {
    const b = builtin();
    if (b) {
      return `/agents/${encodeURIComponent(agentName())}/routing?provider=${b.id}`;
    }
    const base = `/agents/${encodeURIComponent(agentName())}/routing?provider=custom&name=${encodeURIComponent(props.provider.name)}&baseUrl=${encodeURIComponent(props.provider.base_url!)}`;
    const m = models();
    return m ? `${base}&models=${encodeURIComponent(m)}` : base;
  };

  // Ollama (local-only) is disabled in cloud mode
  const isOllamaLocal = () => {
    const b = builtin();
    return b?.localOnly === true;
  };

  return (
    <Show
      when={!isOllamaLocal() || isLocal()}
      fallback={
        <span class="free-models-disabled-btn" data-tooltip="Available in local mode only">
          Connect {props.provider.name}
        </span>
      }
    >
      <a href={href()} class="btn btn--primary btn--sm" style="text-decoration: none;">
        Connect {props.provider.name}
      </a>
    </Show>
  );
};

const FreeModels: Component = () => {
  const [data] = createResource(() => getFreeModels());

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
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-size: var(--font-size-xs); font-weight: 600; flex-shrink: 0;">
            3
          </span>
          <span style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));">
            Done! The provider models are now included in your routing. Customize tiers and
            preferences from the routing page.
          </span>
        </div>
      </div>

      <Show when={!data.loading} fallback={<div class="loading-spinner" />}>
        <Show when={!data.error} fallback={<ErrorState message="Failed to load free models" />}>
          <For each={data()?.providers ?? []}>
            {(provider) => (
              <div class="panel" style="margin-bottom: 24px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 8px;">
                  <h2 style="margin: 0; font-size: var(--font-size-lg); display: flex; align-items: center; gap: 8px;">
                    {provider.logo && (() => {
                      const dark = provider.logo.replace(/\.([^.]+)$/, '-dark-mode.$1');
                      const hasDark = DARK_MODE_LOGOS.has(provider.logo);
                      return hasDark ? (
                        <>
                          <img src={provider.logo} alt="" class="free-models-logo-light" style="height: 20px;" />
                          <img src={dark} alt="" class="free-models-logo-dark" style="height: 20px;" />
                        </>
                      ) : (
                        <img src={provider.logo} alt="" style="height: 20px;" />
                      );
                    })()}
                    {provider.name}
                  </h2>
                  <div style="display: flex; gap: 8px; flex-shrink: 0;">
                    <a
                      href={provider.api_key_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn btn--outline btn--sm"
                      style="text-decoration: none;"
                    >
                      Get API key
                      <ExternalLinkIcon />
                    </a>
                    <Show when={provider.base_url}>
                      <ConnectButton provider={provider} />
                    </Show>
                  </div>
                </div>
                <Show when={provider.tags.length > 0}>
                  <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 16px; flex-wrap: wrap;">
                    <For each={provider.tags}>
                      {(tag) => (
                        <span style="display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-size-sm); color: hsl(var(--foreground)); white-space: nowrap;">
                          <span style="width: 5px; height: 5px; border-radius: 50%; background: hsl(var(--foreground)); flex-shrink: 0;" />
                          {tag}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={!provider.tags.length}>
                  <div style="margin-bottom: 16px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));">
                    {provider.description}
                  </div>
                </Show>

                {(() => {
                  const [showModels, setShowModels] = createSignal(false);
                  const displayModels = () => provider.models.filter((m) => m.id);
                  return (
                    <>
                      <Show when={provider.base_url}>
                        <div class="free-models-base-url-row">
                          <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                            <span style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); flex-shrink: 0;">
                              Base URL:
                            </span>
                            <code style="font-family: var(--font-mono); font-size: var(--font-size-xs); background: hsl(var(--muted) / 0.5); padding: 4px 8px; border-radius: var(--radius); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">
                              {provider.base_url}
                            </code>
                            <CopyButton text={provider.base_url!} />
                          </div>
                          <button
                            style="display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-size-sm); color: hsl(var(--foreground)); padding: 0; background: none; border: none; cursor: pointer; white-space: nowrap; margin-left: auto; font-weight: 500;"
                            onClick={() => setShowModels((v) => !v)}
                          >
                            {showModels()
                              ? 'Hide models'
                              : `Show models (${displayModels().length})`}
                            <img
                              src="/icons/caret-down.svg"
                              alt=""
                              class="free-models-caret"
                              style={`width: 20px; height: 20px; transition: transform 250ms ease; transform: rotate(${showModels() ? '180deg' : '0deg'});`}
                            />
                          </button>
                        </div>
                      </Show>
                      <Show when={!provider.base_url}>
                        <button
                          style="display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-size-sm); color: hsl(var(--foreground)); padding: 0; background: none; border: none; cursor: pointer; white-space: nowrap; font-weight: 500;"
                          onClick={() => setShowModels((v) => !v)}
                        >
                          {showModels()
                            ? 'Hide models'
                            : `Show models (${displayModels().length})`}
                          <img
                            src="/icons/caret-down.svg"
                            alt=""
                            class="free-models-caret"
                            style={`width: 20px; height: 20px; transition: transform 250ms ease; transform: rotate(${showModels() ? '180deg' : '0deg'});`}
                          />
                        </button>
                      </Show>

                      <div
                        class="free-models-accordion"
                        classList={{ 'free-models-accordion--open': showModels() }}
                      >
                        <div>
                          <Show when={provider.warning}>
                            <div style="display: flex; align-items: flex-start; gap: 8px; padding: 10px 14px; border-radius: var(--radius); background: #f7f5ed; margin-top: 16px; margin-bottom: 16px; font-size: var(--font-size-sm);">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                style="flex-shrink: 0; color: hsl(var(--primary)); margin-top: 1px;"
                              >
                                <path d="M12 17c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1s-1 .45-1 1v4c0 .55.45 1 1 1M12 7a1 1 0 1 0 0 2 1 1 0 1 0 0-2" />
                                <path d="M12 22c5.51 0 10-4.49 10-10S17.51 2 12 2 2 6.49 2 12s4.49 10 10 10m0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8" />
                              </svg>
                              <span style="color: hsl(var(--foreground) / 0.8);">
                                {provider.warning}
                              </span>
                            </div>
                          </Show>

                          <table
                            class="data-table"
                            style={`table-layout: fixed; width: 100%;${provider.warning ? '' : ' margin-top: 16px;'}`}
                          >
                            <colgroup>
                              <col style="width: 36%" />
                              <col style="width: 12%" />
                              <col style="width: 14%" />
                              <col style="width: 16%" />
                              <col style="width: 22%" />
                            </colgroup>
                            <thead>
                              <tr>
                                <th>Model Name</th>
                                <th>Context</th>
                                <th>Max Output</th>
                                <th>Modality</th>
                                <th>Rate Limit</th>
                              </tr>
                            </thead>
                            <tbody>
                              <For each={displayModels()}>
                                {(model) => (
                                  <tr>
                                    <td style="font-family: var(--font-mono); font-size: var(--font-size-xs);">
                                      {model.id}
                                    </td>
                                    <td style="font-size: var(--font-size-sm);">{model.context}</td>
                                    <td style="font-size: var(--font-size-sm);">
                                      {model.max_output}
                                    </td>
                                    <td style="font-size: var(--font-size-sm);">
                                      {model.modality}
                                    </td>
                                    <td style="font-size: var(--font-size-sm);">
                                      {model.rate_limit || '\u2014'}
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
        </Show>
      </Show>
    </div>
  );
};

export default FreeModels;

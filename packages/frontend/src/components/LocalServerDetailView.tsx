import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { LOCAL_SERVER_HINTS, type LocalServerHint } from 'manifest-shared';
import type { ProviderDef } from '../services/providers.js';
import { createCustomProvider, probeCustomProvider } from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { checkLocalLlmHost } from '../services/setup-status.js';
import { providerIcon } from './ProviderIcon.js';

interface Props {
  agentName: string;
  provider: ProviderDef;
  onConnected: () => void;
  onBack: () => void;
  /** Open the full custom-provider form with our current URL as prefill. */
  onCustomize: (prefill: { name: string; baseUrl: string }) => void;
}

interface ProbeState {
  models: string[];
  baseUrl: string;
}

const LocalServerDetailView: Component<Props> = (props) => {
  const hint = (): LocalServerHint | undefined => LOCAL_SERVER_HINTS[props.provider.id];
  const defaultPort = () => props.provider.defaultLocalPort ?? hint()?.defaultPort;

  const [hostResource] = createResource(() => checkLocalLlmHost());
  const resolvedBaseUrl = () => {
    const host = hostResource() ?? 'localhost';
    const port = defaultPort();
    return port ? `http://${host}:${port}/v1` : '';
  };

  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const [connecting, setConnecting] = createSignal(false);
  const [refreshKey, setRefreshKey] = createSignal(0);

  const [probe] = createResource(
    () => ({ key: refreshKey(), url: resolvedBaseUrl() }),
    async ({ url }): Promise<ProbeState> => {
      if (!url) return { models: [], baseUrl: '' };
      const { models } = await probeCustomProvider(props.agentName, url);
      const names = models.map((m) => m.model_name);
      setSelected(new Set(names));
      return { models: names, baseUrl: url };
    },
  );

  const retry = () => setRefreshKey((k) => k + 1);

  const toggleModel = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const copyCommand = async () => {
    const cmd = hint()?.setupCommand;
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      toast.success('Command copied to clipboard');
    } catch {
      toast.error('Copy failed — select the command and copy it manually');
    }
  };

  const handleConnect = async () => {
    const state = probe();
    if (!state || state.models.length === 0) return;
    const picked = Array.from(selected());
    if (picked.length === 0) {
      toast.error('Select at least one model');
      return;
    }
    setConnecting(true);
    try {
      await createCustomProvider(props.agentName, {
        name: props.provider.name,
        base_url: state.baseUrl,
        models: picked.map((name) => ({
          model_name: name,
          input_price_per_million_tokens: 0,
          output_price_per_million_tokens: 0,
        })),
      });
      toast.success(
        `${props.provider.name} connected (${picked.length} model${picked.length === 1 ? '' : 's'})`,
      );
      props.onConnected();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to connect ${props.provider.name}`);
    } finally {
      setConnecting(false);
    }
  };

  const isSingleModel = () => hint()?.singleModel === true;

  return (
    <div class="provider-detail">
      <button class="provider-detail__back" onClick={props.onBack} aria-label="Back to providers">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <div class="routing-modal__header" style="border: none; padding: 0; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span class="provider-toggle__icon" style="flex-shrink: 0;">
            {providerIcon(props.provider.id, 28) ?? (
              <span
                class="provider-card__logo-letter"
                style={{ background: props.provider.color, width: '28px', height: '28px' }}
              >
                {props.provider.initial}
              </span>
            )}
          </span>
          <div>
            <div class="routing-modal__title">Connect {props.provider.name}</div>
            <div class="routing-modal__subtitle">{props.provider.subtitle}</div>
          </div>
        </div>
      </div>

      <Show
        when={!probe.loading}
        fallback={
          <div
            class="provider-detail__probe-status"
            style="display: flex; align-items: center; gap: 8px; padding: 12px 0; color: hsl(var(--muted-foreground));"
          >
            <span class="spinner" aria-hidden="true" />
            <span>Checking {resolvedBaseUrl() || 'the server'}…</span>
          </div>
        }
      >
        <Show
          when={!probe.error && probe()?.models?.length}
          fallback={
            <FailureState
              hint={hint()}
              error={probe.error}
              onRetry={retry}
              onCustomize={() =>
                props.onCustomize({ name: props.provider.name, baseUrl: resolvedBaseUrl() })
              }
            />
          }
        >
          <SuccessState
            models={probe()?.models ?? []}
            baseUrl={probe()?.baseUrl ?? ''}
            selected={selected()}
            onToggle={toggleModel}
            singleModel={isSingleModel()}
          />

          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 16px;">
            <button
              type="button"
              class="btn btn--outline btn--sm"
              onClick={() =>
                props.onCustomize({ name: props.provider.name, baseUrl: resolvedBaseUrl() })
              }
            >
              Advanced — customize URL or pricing
            </button>
            <button
              type="button"
              class="btn btn--primary btn--sm provider-detail__action"
              disabled={connecting() || selected().size === 0}
              onClick={handleConnect}
            >
              {connecting() ? (
                <span class="spinner" />
              ) : isSingleModel() ? (
                `Connect ${props.provider.name}`
              ) : (
                `Connect ${selected().size} model${selected().size === 1 ? '' : 's'}`
              )}
            </button>
          </div>
        </Show>
      </Show>

      <Show when={hint()}>
        <DockerCaveat hint={hint()!} onCopyCommand={copyCommand} />
      </Show>
    </div>
  );
};

/* ── Probe success ────────────────────────────────── */

const SuccessState: Component<{
  models: string[];
  baseUrl: string;
  selected: Set<string>;
  onToggle: (name: string) => void;
  singleModel: boolean;
}> = (p) => {
  return (
    <div>
      <div
        class="provider-detail__success"
        style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: hsl(var(--success)); font-size: var(--font-size-sm);"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>
          {p.singleModel
            ? 'Server is reachable.'
            : `Found ${p.models.length} model${p.models.length === 1 ? '' : 's'} at ${p.baseUrl}`}
        </span>
      </div>
      <Show
        when={!p.singleModel}
        fallback={
          <div
            class="provider-detail__single-model"
            style="padding: 12px 14px; border: 1px solid hsl(var(--border)); border-radius: var(--radius); font-family: var(--font-mono, monospace); font-size: var(--font-size-sm);"
          >
            {p.models[0]}
          </div>
        }
      >
        <div
          class="provider-detail__model-list"
          style="display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto;"
        >
          <For each={p.models}>
            {(name) => (
              <label
                class="provider-detail__model-row"
                style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius); cursor: pointer;"
              >
                <input
                  type="checkbox"
                  checked={p.selected.has(name)}
                  onChange={() => p.onToggle(name)}
                />
                <span style="font-family: var(--font-mono, monospace); font-size: var(--font-size-sm);">
                  {name}
                </span>
              </label>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

/* ── Probe failure ────────────────────────────────── */

const FailureState: Component<{
  hint?: LocalServerHint;
  error: unknown;
  onRetry: () => void;
  onCustomize: () => void;
}> = (p) => {
  const errorMsg = () =>
    p.error instanceof Error ? p.error.message : 'Could not reach the server';

  return (
    <div class="provider-detail__failure">
      <div class="provider-detail__error" role="alert" style="margin-bottom: 14px;">
        {errorMsg()}
      </div>

      <Show when={p.hint}>
        <div class="provider-detail__setup" style="margin-bottom: 14px;">
          <div style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: 6px;">
            Start the server with:
          </div>
          <pre
            class="provider-detail__setup-cmd"
            style="margin: 0; padding: 10px 12px; background: hsl(var(--muted)); border-radius: var(--radius); font-family: var(--font-mono, monospace); font-size: var(--font-size-xs); white-space: pre-wrap; word-break: break-all;"
          >
            {p.hint!.setupCommand}
          </pre>
        </div>
      </Show>

      <div style="display: flex; align-items: center; gap: 8px;">
        <button type="button" class="btn btn--primary btn--sm" onClick={p.onRetry}>
          Retry
        </button>
        <button type="button" class="btn btn--outline btn--sm" onClick={p.onCustomize}>
          Customize URL
        </button>
        <Show when={p.hint?.docsUrl}>
          <a
            href={p.hint!.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="provider-detail__docs-link"
            style="margin-left: auto; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));"
          >
            Docs ↗
          </a>
        </Show>
      </div>
    </div>
  );
};

/* ── Docker caveat footer ─────────────────────────── */

const DockerCaveat: Component<{ hint: LocalServerHint; onCopyCommand: () => void }> = (p) => {
  const [hostResource] = createResource(() => checkLocalLlmHost());
  const showCaveat = () => !!p.hint.dockerBindNote && hostResource() === 'host.docker.internal';

  return (
    <Show when={showCaveat()}>
      <div
        class="provider-detail__caveat"
        style="margin-top: 20px; padding: 10px 12px; background: hsl(var(--warning) / 0.1); border-left: 3px solid hsl(var(--warning)); border-radius: var(--radius); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));"
      >
        <strong style="color: hsl(var(--foreground));">Running Manifest in Docker:</strong>{' '}
        {p.hint.dockerBindNote}{' '}
        <button
          type="button"
          onClick={p.onCopyCommand}
          style="background: none; border: none; padding: 0; color: hsl(var(--primary)); cursor: pointer; text-decoration: underline;"
        >
          Copy the start command
        </button>
      </div>
    </Show>
  );
};

export default LocalServerDetailView;

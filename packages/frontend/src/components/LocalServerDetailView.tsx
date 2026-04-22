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
}

interface ProbeState {
  models: string[];
  baseUrl: string;
}

const LocalServerDetailView: Component<Props> = (props) => {
  const hint = (): LocalServerHint | undefined => LOCAL_SERVER_HINTS[props.provider.id];

  const [hostResource] = createResource(() => checkLocalLlmHost());
  // `defaultLocalPort` is the gate that routes the tile click here in
  // the first place (see ProviderApiKeyTab), so it's always defined.
  const resolvedBaseUrl = () =>
    `http://${hostResource() ?? 'localhost'}:${props.provider.defaultLocalPort!}/v1`;

  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const [connecting, setConnecting] = createSignal(false);
  const [refreshKey, setRefreshKey] = createSignal(0);
  // First probe seeds "all selected"; subsequent probes intersect-preserve
  // the user's current checks against the newly-discovered model list.
  const [hasSeeded, setHasSeeded] = createSignal(false);

  const [probe] = createResource(
    () => ({ key: refreshKey(), url: resolvedBaseUrl() }),
    async ({ url }): Promise<ProbeState> => {
      const { models } = await probeCustomProvider(props.agentName, url);
      const names = models.map((m) => m.model_name);
      setSelected((prev) => {
        if (!hasSeeded()) {
          setHasSeeded(true);
          return new Set(names);
        }
        const available = new Set(names);
        const next = new Set<string>();
        for (const n of prev) if (available.has(n)) next.add(n);
        return next;
      });
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

  const handleConnect = async () => {
    const state = probe();
    if (!state || state.models.length === 0) return;
    const picked = Array.from(selected());
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
        when={!probe.loading || probe()}
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
              providerName={props.provider.name}
              hint={hint()}
              error={probe.error}
              onRetry={retry}
            />
          }
        >
          <SuccessState
            models={probe()?.models ?? []}
            baseUrl={probe()?.baseUrl ?? ''}
            selected={selected()}
            onToggle={toggleModel}
            refreshing={probe.loading}
            onRefresh={retry}
          />

          <div style="display: flex; align-items: center; justify-content: flex-end; margin-top: 16px; gap: 12px;">
            <Show when={hint()?.installUrl}>
              <a
                href={hint()!.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="provider-detail__docs-link"
                style="margin-right: auto; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));"
              >
                Get {props.provider.name} ↗
              </a>
            </Show>
            <button
              type="button"
              class="btn btn--primary btn--sm provider-detail__action"
              disabled={connecting() || selected().size === 0 || probe.loading}
              onClick={handleConnect}
            >
              {connecting() ? (
                <span class="spinner" />
              ) : (
                `Connect ${selected().size} model${selected().size === 1 ? '' : 's'}`
              )}
            </button>
          </div>
        </Show>
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
  refreshing: boolean;
  onRefresh: () => void;
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
          {`Found ${p.models.length} model${p.models.length === 1 ? '' : 's'} at ${p.baseUrl}`}
        </span>
        <button
          type="button"
          class="provider-detail__refresh"
          onClick={p.onRefresh}
          disabled={p.refreshing}
          aria-label={p.refreshing ? 'Refreshing model list' : 'Refresh model list'}
          aria-busy={p.refreshing}
          style="margin-left: auto; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; background: transparent; color: hsl(var(--muted-foreground)); border-radius: var(--radius); cursor: pointer;"
        >
          <Show when={!p.refreshing} fallback={<span class="spinner" aria-hidden="true" />}>
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
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </Show>
        </button>
      </div>
      <div
        class="provider-detail__model-list"
        style={`display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; opacity: ${p.refreshing ? 0.6 : 1}; pointer-events: ${p.refreshing ? 'none' : 'auto'}; transition: opacity 120ms;`}
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
    </div>
  );
};

/* ── Probe failure ────────────────────────────────── */

const FailureState: Component<{
  providerName: string;
  hint?: LocalServerHint;
  error: unknown;
  onRetry: () => void;
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
        <Show when={p.hint?.installUrl}>
          <a
            href={p.hint!.installUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="provider-detail__docs-link"
            style="margin-left: auto; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));"
          >
            Get {p.providerName} ↗
          </a>
        </Show>
      </div>

      {/* Docker fix card lives here (failure-only) — when the probe
          succeeds there's nothing to teach. */}
      <Show when={p.hint}>
        <DockerCaveat hint={p.hint!} />
      </Show>
    </div>
  );
};

/* ── Docker caveat footer ─────────────────────────── */

const DockerCaveat: Component<{ hint: LocalServerHint }> = (p) => {
  const [hostResource] = createResource(() => checkLocalLlmHost());
  const showCaveat = () => !!p.hint.dockerBindNote && hostResource() === 'host.docker.internal';
  const bindCommand = () => p.hint.dockerBindCommand ?? p.hint.setupCommand;
  const [copied, setCopied] = createSignal(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bindCommand());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — select the command and copy it manually');
    }
  };

  return (
    <Show when={showCaveat()}>
      <div
        class="provider-detail__caveat"
        style="margin-top: 20px; padding: 12px 14px; background: hsl(var(--warning) / 0.1); border-left: 3px solid hsl(var(--warning)); border-radius: var(--radius); font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));"
      >
        <div style="color: hsl(var(--foreground)); font-weight: 600; margin-bottom: 6px;">
          Running Manifest in Docker
        </div>
        <div style="margin-bottom: 10px;">{p.hint.dockerBindNote}</div>

        <Show when={p.hint.dockerGuiFix}>
          <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px;">
            <span style="flex-shrink: 0; color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; min-width: 32px;">
              GUI
            </span>
            <span style="color: hsl(var(--foreground));">{p.hint.dockerGuiFix}</span>
          </div>
        </Show>

        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="flex-shrink: 0; color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; min-width: 32px;">
            CLI
          </span>
          <code style="flex: 1; padding: 4px 8px; background: hsl(var(--muted)); border-radius: var(--radius); font-family: var(--font-mono, monospace); font-size: var(--font-size-xs); color: hsl(var(--foreground)); overflow-x: auto; white-space: nowrap;">
            {bindCommand()}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-label={copied() ? 'Copied' : 'Copy command'}
            style="flex-shrink: 0; padding: 4px 10px; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: var(--radius); color: hsl(var(--foreground)); font-size: var(--font-size-xs); cursor: pointer;"
          >
            {copied() ? 'Copied' : 'Copy'}
          </button>
        </div>

        <Show when={p.hint.persistsBindAcrossLaunches}>
          <div style="margin-top: 10px; font-size: var(--font-size-xs);">
            One-time setup — the server remembers this setting across restarts.
          </div>
        </Show>
      </div>
    </Show>
  );
};

export default LocalServerDetailView;

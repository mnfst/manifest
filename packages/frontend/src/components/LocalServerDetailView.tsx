import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { LOCAL_SERVER_HINTS, type LocalServerHint } from 'manifest-shared';
import type { ProviderDef } from '../services/providers.js';
import {
  createCustomProvider,
  deleteCustomProvider,
  probeCustomProvider,
  updateCustomProvider,
  type CustomProviderData,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { checkLocalLlmHost } from '../services/setup-status.js';
import { providerIcon } from './ProviderIcon.js';

interface Props {
  agentName: string;
  provider: ProviderDef;
  /** When set, the view opens in edit mode for an existing custom provider. */
  editData?: CustomProviderData;
  onConnected: () => void;
  onBack: () => void;
  /**
   * Optional: open the generic custom-provider form as an escape hatch.
   * Surfaced under the setup command when the provider hint supplies a
   * `notReachableHint` (llama.cpp pre-b3800 builds don't expose
   * `/v1/models`, so the probe can 404 even when the server is up).
   */
  onOpenCustomForm?: () => void;
}

interface ProbeState {
  models: string[];
  baseUrl: string;
}

const LocalServerDetailView: Component<Props> = (props) => {
  const isEdit = () => !!props.editData;
  const hint = (): LocalServerHint | undefined => LOCAL_SERVER_HINTS[props.provider.id];

  const [hostResource] = createResource(() => checkLocalLlmHost());
  // `defaultLocalPort` is the gate that routes the tile click here in
  // the first place (see ProviderApiKeyTab), so it's always defined.
  const resolvedBaseUrl = () => {
    if (props.editData) return props.editData.base_url;
    return `http://${hostResource() ?? 'localhost'}:${props.provider.defaultLocalPort!}/v1`;
  };

  // In edit mode, pre-select only the models that are already connected.
  const initialSelected = () =>
    props.editData ? new Set(props.editData.models.map((m) => m.model_name)) : new Set<string>();

  const [selected, setSelected] = createSignal<Set<string>>(initialSelected());
  const [connecting, setConnecting] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [refreshKey, setRefreshKey] = createSignal(0);
  // First probe seeds "all selected" (connect mode) or keeps the edit
  // selection (edit mode); subsequent probes intersect-preserve.
  const [hasSeeded, setHasSeeded] = createSignal(isEdit());

  const [probe] = createResource(
    () => ({ key: refreshKey(), url: resolvedBaseUrl() }),
    async ({ url }): Promise<ProbeState> => {
      const wasConnected = hasSeeded();
      try {
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
      } catch (err) {
        if (wasConnected) {
          toast.error(`${props.provider.name} is no longer reachable`);
        }
        throw err;
      }
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
      if (props.editData) {
        await updateCustomProvider(props.agentName, props.editData.id, {
          models: picked.map((name) => ({
            model_name: name,
            input_price_per_million_tokens: 0,
            output_price_per_million_tokens: 0,
          })),
        });
        toast.success(
          `${props.provider.name} updated (${picked.length} model${picked.length === 1 ? '' : 's'})`,
        );
      } else {
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
      }
      props.onConnected();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to connect ${props.provider.name}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDelete = async () => {
    if (!props.editData) return;
    setDeleting(true);
    try {
      await deleteCustomProvider(props.agentName, props.editData.id);
      toast.success(`${props.provider.name} disconnected`);
      props.onConnected();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to disconnect ${props.provider.name}`,
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div class="provider-detail">
      <button class="modal-back-btn" onClick={props.onBack} aria-label="Back to providers">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M14.71 7.29a.996.996 0 0 0-1.41 0l-4 4a.996.996 0 0 0 0 1.41l4 4c.2.2.45.29.71.29s.51-.1.71-.29a.996.996 0 0 0 0-1.41L11.43 12l3.29-3.29a.996.996 0 0 0 0-1.41Z" />
        </svg>
      </button>

      {/* Title */}
      <div class="routing-modal__header" style="border: none; padding: 0; margin-bottom: 15px;">
        <div>
          <div class="routing-modal__title">{isEdit() ? 'Edit provider' : 'Connect providers'}</div>
        </div>
      </div>

      {/* Provider row */}
      <div class="provider-detail__header">
        <span class="provider-detail__icon">
          {providerIcon(props.provider.id, 28) ?? (
            <span
              class="provider-card__logo-letter"
              style={{
                background: props.provider.color,
                width: '32px',
                height: '32px',
                'font-size': '13px',
              }}
            >
              {props.provider.initial}
            </span>
          )}
        </span>
        <div class="provider-detail__title-group">
          <div class="provider-detail__name">{props.provider.name}</div>
        </div>
      </div>

      <div class="routing-modal__subtitle" style="margin-bottom: 20px;">
        {props.provider.subtitle}
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
            <Show
              when={!probe.error && probe() && probe()!.models.length === 0}
              fallback={
                <FailureState
                  providerName={props.provider.name}
                  hint={hint()}
                  error={probe.error}
                  onRetry={retry}
                  onOpenCustomForm={props.onOpenCustomForm}
                />
              }
            >
              <EmptyModelsState
                providerName={props.provider.name}
                baseUrl={probe()?.baseUrl ?? ''}
                onRetry={retry}
              />
            </Show>
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
            <Show when={isEdit()}>
              <button
                type="button"
                class="btn btn--outline btn--sm"
                style="margin-right: auto;"
                disabled={deleting()}
                onClick={handleDelete}
              >
                {deleting() ? <span class="spinner" /> : 'Delete provider'}
              </button>
            </Show>
            <button
              type="button"
              class="btn btn--primary btn--sm provider-detail__action"
              disabled={connecting() || selected().size === 0 || probe.loading}
              onClick={handleConnect}
            >
              {connecting() ? (
                <span class="spinner" />
              ) : isEdit() ? (
                'Save changes'
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
      {/* Header row: model count + refresh */}
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: var(--font-size-sm); font-weight: 600; color: hsl(var(--foreground));">
          {`${p.models.length} model${p.models.length === 1 ? '' : 's'} available at ${p.baseUrl}`}
        </span>
        <button
          type="button"
          title="Refresh"
          onClick={p.onRefresh}
          disabled={p.refreshing}
          aria-label="Refresh model list"
          style="margin-left: auto; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 1px solid hsl(var(--border)); background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); border-radius: var(--radius); cursor: pointer; flex-shrink: 0;"
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

      {/* Model list with toggle switches */}
      <div
        class="provider-detail__model-list"
        style={`display: flex; flex-direction: column; max-height: 240px; overflow-y: auto; border-top: 1px solid hsl(var(--border)); opacity: ${p.refreshing ? 0.6 : 1}; pointer-events: ${p.refreshing ? 'none' : 'auto'}; transition: opacity 120ms;`}
      >
        <For each={p.models}>
          {(name) => (
            <button
              type="button"
              class="provider-toggle"
              style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 0; border: none; background: transparent; cursor: pointer; border-bottom: 1px solid hsl(var(--border));"
              onClick={() => p.onToggle(name)}
            >
              <span style="font-size: var(--font-size-sm); color: hsl(var(--foreground));">
                {name}
              </span>
              <span
                class="provider-toggle__switch"
                classList={{ 'provider-toggle__switch--on': p.selected.has(name) }}
              >
                <span class="provider-toggle__switch-thumb" />
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
};

/* ── Server reachable but no models loaded ────────── */

const EmptyModelsState: Component<{
  providerName: string;
  baseUrl: string;
  onRetry: () => void;
}> = (p) => {
  return (
    <div class="provider-detail__failure">
      <div style="margin-bottom: 14px; display: flex; align-items: flex-start; gap: 8px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); padding: 12px 14px; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: var(--radius);">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          style="flex-shrink: 0; margin-top: 1px;"
        >
          <g fill="currentColor" opacity="0.4">
            <path d="m19,3H5c-1.65,0-3,1.35-3,3v2c0,1.65,1.35,3,3,3h14c1.65,0,3-1.35,3-3v-2c0-1.65-1.35-3-3-3Zm1,5c0,.55-.45,1-1,1H5c-.55,0-1-.45-1-1v-2c0-.55.45-1,1-1h14c.55,0,1,.45,1,1v2Z" />
          </g>
          <g fill="currentColor" opacity="1">
            <path d="m19,13H5c-1.65,0-3,1.35-3,3v2c0,1.65,1.35,3,3,3h14c1.65,0,3-1.35,3-3v-2c0-1.65-1.35-3-3-3Zm1,5c0,.55-.45,1-1,1H5c-.55,0-1-.45-1-1v-2c0-.55.45-1,1-1h14c.55,0,1,.45,1,1v2Z" />
            <path d="M18 16A1 1 0 1 0 18 18 1 1 0 1 0 18 16z" />
            <path d="M15 16A1 1 0 1 0 15 18 1 1 0 1 0 15 16z" />
            <path d="M18 6A1 1 0 1 0 18 8 1 1 0 1 0 18 6z" />
            <path d="M15 6A1 1 0 1 0 15 8 1 1 0 1 0 15 6z" />
          </g>
        </svg>
        <span>
          Server is running at {p.baseUrl}, but no models are loaded. Open {p.providerName} and load
          a model to see it here.
        </span>
      </div>

      <video
        src="/icons/lmstudio-load-models.mp4"
        autoplay
        loop
        muted
        playsinline
        disablepictureinpicture
        style="margin-bottom: 14px; width: 100%; border-radius: var(--radius); border: 1px solid hsl(var(--border)); pointer-events: none;"
      />

      <div style="display: flex; align-items: center; gap: 8px;">
        <button
          type="button"
          class="btn btn--primary btn--sm"
          style="margin-left: auto;"
          onClick={p.onRetry}
        >
          Retry
        </button>
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
  onOpenCustomForm?: () => void;
}> = (p) => {
  const errorMsg = () =>
    p.error instanceof Error ? p.error.message : 'Could not reach the server';
  const [hostResource] = createResource(() => checkLocalLlmHost());
  const isDocker = () => !!p.hint?.dockerBindNote && hostResource() === 'host.docker.internal';
  const [copied, setCopied] = createSignal(false);
  const copyCommand = async () => {
    if (!p.hint) return;
    try {
      await navigator.clipboard.writeText(p.hint.setupCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed — select the command and copy it manually');
    }
  };

  return (
    <div class="provider-detail__failure">
      {/* Docker caveat first — it's a prerequisite for the server to be reachable */}
      <Show when={p.hint}>
        <DockerCaveat hint={p.hint!} errorMsg={errorMsg()} />
      </Show>

      {/* Error card — only shown outside Docker (DockerCaveat renders it inline when in Docker) */}
      <Show when={!isDocker()}>
        <div style="margin-bottom: 14px; display: flex; align-items: flex-start; gap: 8px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); padding: 12px 14px; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: var(--radius); white-space: pre-line;">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            style="flex-shrink: 0; margin-top: 1px;"
          >
            <g fill="currentColor" opacity="0.4">
              <path d="m19,3H5c-1.65,0-3,1.35-3,3v2c0,1.65,1.35,3,3,3h14c1.65,0,3-1.35,3-3v-2c0-1.65-1.35-3-3-3Zm1,5c0,.55-.45,1-1,1H5c-.55,0-1-.45-1-1v-2c0-.55.45-1,1-1h14c.55,0,1,.45,1,1v2Z" />
            </g>
            <g fill="currentColor" opacity="1">
              <path d="m19,13H5c-1.65,0-3,1.35-3,3v2c0,1.65,1.35,3,3,3h14c1.65,0,3-1.35,3-3v-2c0-1.65-1.35-3-3-3Zm1,5c0,.55-.45,1-1,1H5c-.55,0-1-.45-1-1v-2c0-.55.45-1,1-1h14c.55,0,1,.45,1,1v2Z" />
              <path d="M18 16A1 1 0 1 0 18 18 1 1 0 1 0 18 16z" />
              <path d="M15 16A1 1 0 1 0 15 18 1 1 0 1 0 15 16z" />
              <path d="M18 6A1 1 0 1 0 18 8 1 1 0 1 0 18 6z" />
              <path d="M15 6A1 1 0 1 0 15 8 1 1 0 1 0 15 6z" />
            </g>
          </svg>
          {errorMsg()}
        </div>
      </Show>

      <Show when={p.hint}>
        <div class="provider-detail__setup" style="margin-bottom: 20px;">
          <div style="font-size: var(--font-size-sm); font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 8px;">
            {isDocker() ? '2. Start server command' : 'Start server command'}
          </div>
          <div style="position: relative;">
            <pre
              class="provider-detail__setup-cmd"
              style="margin: 0; padding: 10px 40px 10px 12px; background: hsl(var(--muted)); border-radius: var(--radius); font-family: var(--font-mono, monospace); font-size: var(--font-size-xs); white-space: pre-wrap; word-break: break-all;"
            >
              {p.hint!.setupCommand}
            </pre>
            <button
              type="button"
              title={copied() ? 'Copied!' : 'Copy'}
              onClick={copyCommand}
              style="position: absolute; top: 50%; right: 8px; transform: translateY(-50%); display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; background: transparent; color: hsl(var(--muted-foreground)); cursor: pointer; border-radius: var(--radius);"
            >
              <Show
                when={!copied()}
                fallback={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </Show>
            </button>
          </div>
          <Show when={p.hint!.setupNote}>
            <div style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin-top: 8px; line-height: 1.5;">
              {p.hint!.setupNote}
            </div>
          </Show>
          {/* GUI-launch fallback + setup video are LM-Studio specific; gate
              them on `persistsBindAcrossLaunches`, which today identifies
              GUI-wrapped local providers (CLI-only providers like llama.cpp
              don't have a "Developer → Start Server" menu to point at). */}
          <Show when={p.hint!.persistsBindAcrossLaunches}>
            <div style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin-top: 12px;">
              Or open {p.providerName} → Developer → Start Server
            </div>
            <video
              src="/icons/lmstudio-start-server.mp4"
              autoplay
              loop
              muted
              playsinline
              disablepictureinpicture
              style="margin-top: 12px; width: 100%; border-radius: var(--radius); border: 1px solid hsl(var(--border)); pointer-events: none;"
            />
          </Show>
          <Show when={p.hint!.notReachableHint}>
            {(hint) => (
              <div style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin-top: 12px; line-height: 1.5;">
                {hint().before}
                <Show
                  when={p.onOpenCustomForm}
                  fallback={<span>&ldquo;{hint().linkLabel}&rdquo;</span>}
                >
                  <button
                    type="button"
                    class="link-button"
                    onClick={p.onOpenCustomForm}
                    style="background: none; border: none; padding: 0; color: hsl(var(--primary)); text-decoration: underline; cursor: pointer; font: inherit;"
                  >
                    {hint().linkLabel}
                  </button>
                </Show>
                {hint().after}
              </div>
            )}
          </Show>
        </div>
      </Show>

      <div style="display: flex; align-items: center; gap: 8px;">
        <Show when={p.hint?.installUrl}>
          <a
            href={p.hint!.installUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn--outline btn--sm"
            style="text-decoration: none;"
          >
            Get {p.providerName} ↗
          </a>
        </Show>
        <button
          type="button"
          class="btn btn--primary btn--sm"
          style="margin-left: auto;"
          onClick={p.onRetry}
        >
          Retry
        </button>
      </div>
    </div>
  );
};

/* ── Docker caveat with GUI/CLI tabs ──────────────── */

const DockerCaveat: Component<{ hint: LocalServerHint; errorMsg: string }> = (p) => {
  const [hostResource] = createResource(() => checkLocalLlmHost());
  const showCaveat = () => !!p.hint.dockerBindNote && hostResource() === 'host.docker.internal';
  const bindCommand = () => p.hint.dockerBindCommand ?? p.hint.setupCommand;
  const [copied, setCopied] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'gui' | 'cli'>('gui');
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
        style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));"
      >
        {/* Alert cards: overview of both problems */}
        <div style="margin-bottom: 14px; display: flex; align-items: flex-start; gap: 8px; padding: 12px 14px; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: var(--radius);">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            fill="currentColor"
            viewBox="0 0 24 24"
            style="flex-shrink: 0; margin-top: 1px;"
          >
            <path d="M20.17 9.82a5 5 0 0 0-.84.07 3.12 3.12 0 0 0-1.43-2.14l-.28-.16-.19.27a3.7 3.7 0 0 0-.51 1.19 2.84 2.84 0 0 0 .33 2.22 4.1 4.1 0 0 1-1.45.35H2.63a.63.63 0 0 0-.63.62 9.6 9.6 0 0 0 .58 3.39 5 5 0 0 0 2 2.6 8.86 8.86 0 0 0 4.42.95 13.3 13.3 0 0 0 2.42-.18 10.1 10.1 0 0 0 3.19-1.15A8.9 8.9 0 0 0 16.78 16a12 12 0 0 0 2.13-3.67h.19a3.08 3.08 0 0 0 2.23-.84 2.36 2.36 0 0 0 .59-.87l.08-.22-.2-.16a2.7 2.7 0 0 0-1.63-.42" />
            <path d="M5.61 9.35H3.85a.16.16 0 0 0-.16.15v1.58a.16.16 0 0 0 .16.15h1.76a.16.16 0 0 0 .16-.15V9.5a.16.16 0 0 0-.16-.15m2.44 0H6.28a.16.16 0 0 0-.16.15v1.58a.16.16 0 0 0 .16.15h1.77a.15.15 0 0 0 .15-.15V9.5a.15.15 0 0 0-.15-.15m2.47 0H8.75a.15.15 0 0 0-.15.15v1.58a.15.15 0 0 0 .15.15h1.77a.15.15 0 0 0 .15-.15V9.5a.15.15 0 0 0-.15-.15m.67 0a.15.15 0 0 0-.19.15v1.58a.15.15 0 0 0 .15.15H13a.15.15 0 0 0 .15-.15V9.5a.15.15 0 0 0-.15-.15zM6.28 7.09H8a.16.16 0 0 1 .16.16v1.56A.16.16 0 0 1 8 9H6.28a.15.15 0 0 1-.15-.15V7.24a.15.15 0 0 1 .15-.15m2.47 0h1.77a.15.15 0 0 1 .15.15v1.57a.16.16 0 0 1-.16.16H8.75a.15.15 0 0 1-.15-.15V7.24a.15.15 0 0 1 .15-.15m2.44 0H13a.15.15 0 0 1 .15.15v1.57A.15.15 0 0 1 13 9h-1.81a.16.16 0 0 1-.19-.19V7.24a.15.15 0 0 1 .19-.15" />
            <rect width="2.07" height="1.88" x="11.04" y="4.82" rx=".15" />
            <path d="M13.65 9.35a.15.15 0 0 0-.15.15v1.58a.15.15 0 0 0 .15.15h1.77a.15.15 0 0 0 .15-.15V9.5a.15.15 0 0 0-.15-.15z" />
          </svg>
          <span>{p.hint.dockerBindNote}</span>
        </div>

        <div style="margin-bottom: 20px; display: flex; align-items: flex-start; gap: 8px; padding: 12px 14px; background: hsl(var(--background)); border: 1px solid hsl(var(--border)); border-radius: var(--radius); white-space: pre-line;">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            style="flex-shrink: 0; margin-top: 1px;"
          >
            <g fill="currentColor" opacity="0.4">
              <path d="m19,3H5c-1.65,0-3,1.35-3,3v2c0,1.65,1.35,3,3,3h14c1.65,0,3-1.35,3-3v-2c0-1.65-1.35-3-3-3Zm1,5c0,.55-.45,1-1,1H5c-.55,0-1-.45-1-1v-2c0-.55.45-1,1-1h14c.55,0,1,.45,1,1v2Z" />
            </g>
            <g fill="currentColor" opacity="1">
              <path d="m19,13H5c-1.65,0-3,1.35-3,3v2c0,1.65,1.35,3,3,3h14c1.65,0,3-1.35,3-3v-2c0-1.65-1.35-3-3-3Zm1,5c0,.55-.45,1-1,1H5c-.55,0-1-.45-1-1v-2c0-.55.45-1,1-1h14c.55,0,1,.45,1,1v2Z" />
              <path d="M18 16A1 1 0 1 0 18 18 1 1 0 1 0 18 16z" />
              <path d="M15 16A1 1 0 1 0 15 18 1 1 0 1 0 15 16z" />
              <path d="M18 6A1 1 0 1 0 18 8 1 1 0 1 0 18 6z" />
              <path d="M15 6A1 1 0 1 0 15 8 1 1 0 1 0 15 6z" />
            </g>
          </svg>
          {p.errorMsg}
        </div>

        {/* Step 1: Running Manifest in Docker */}
        <div style="font-size: var(--font-size-sm); font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 12px;">
          1. Running Manifest in Docker
        </div>

        {/* Tabs: GUI / CLI */}
        <Show when={p.hint.dockerGuiFix}>
          <div class="panel__tabs" style="margin-bottom: 12px; width: 100%;">
            <button
              type="button"
              class="panel__tab"
              classList={{ 'panel__tab--active': activeTab() === 'gui' }}
              onClick={() => setActiveTab('gui')}
              style="flex: 1;"
            >
              GUI
            </button>
            <button
              type="button"
              class="panel__tab"
              classList={{ 'panel__tab--active': activeTab() === 'cli' }}
              onClick={() => setActiveTab('cli')}
              style="flex: 1;"
            >
              CLI
            </button>
          </div>

          {/* GUI tab content */}
          <Show when={activeTab() === 'gui'}>
            <div style="margin-bottom: 16px; color: hsl(var(--foreground)); font-size: var(--font-size-sm);">
              {p.hint.dockerGuiFix}
            </div>
          </Show>
        </Show>

        {/* CLI tab content (also shown when no GUI fix available) */}
        <Show when={activeTab() === 'cli' || !p.hint.dockerGuiFix}>
          <div style="position: relative; margin-bottom: 16px;">
            <pre style="margin: 0; padding: 10px 40px 10px 12px; background: hsl(var(--muted)); border-radius: var(--radius); font-family: var(--font-mono, monospace); font-size: var(--font-size-xs); white-space: pre-wrap; word-break: break-all;">
              {bindCommand()}
            </pre>
            <button
              type="button"
              onClick={copy}
              title={copied() ? 'Copied!' : 'Copy'}
              aria-label={copied() ? 'Copied' : 'Copy command'}
              style="position: absolute; top: 50%; right: 8px; transform: translateY(-50%); display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; background: transparent; color: hsl(var(--muted-foreground)); cursor: pointer; border-radius: var(--radius);"
            >
              <Show
                when={!copied()}
                fallback={
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </Show>
            </button>
          </div>
        </Show>

        <Show when={p.hint.persistsBindAcrossLaunches}>
          <div style="margin-bottom: 20px; font-size: var(--font-size-xs);">
            You only need to do this once. The server remembers this setting across restarts.
          </div>
        </Show>
      </div>
    </Show>
  );
};

export default LocalServerDetailView;

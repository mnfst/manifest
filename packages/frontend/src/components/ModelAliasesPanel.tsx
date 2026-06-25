import { createEffect, createMemo, createSignal, For, Show, type Component } from 'solid-js';
import type {
  AvailableModel,
  AuthType,
  CreateModelAliasInput,
  ModelAlias,
  ModelRoute,
  RequestParamDefaults,
  UpdateModelAliasInput,
} from '../services/api.js';

interface DirectRouteOption {
  key: string;
  route: ModelRoute;
  label: string;
  suggestedId: string;
}

interface Props {
  aliases: ModelAlias[];
  models: AvailableModel[];
  onCreate: (input: CreateModelAliasInput) => Promise<void>;
  onUpdate: (id: string, patch: UpdateModelAliasInput) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const REASONING_EFFORTS = ['', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;

const ModelAliasesPanel: Component<Props> = (props) => {
  const [selectedKey, setSelectedKey] = createSignal('');
  const [modelId, setModelId] = createSignal('');
  const [displayName, setDisplayName] = createSignal('');
  const [reasoningEffort, setReasoningEffort] = createSignal('');
  const [creating, setCreating] = createSignal(false);

  const routeOptions = createMemo<DirectRouteOption[]>(() =>
    props.models
      .filter((model): model is AvailableModel & { auth_type: AuthType } => !!model.auth_type)
      .map((model, index) => {
        const route = {
          provider: model.provider,
          authType: model.auth_type,
          model: model.model_name,
        };
        return {
          key: `${index}:${route.provider}:${route.authType}:${route.model}`,
          route,
          label: `${displayProvider(route.provider)} ${authLabel(route.authType)} / ${
            model.display_name ?? route.model
          }`,
          suggestedId: suggestedModelId(route),
        };
      }),
  );

  const selectedOption = () => routeOptions().find((option) => option.key === selectedKey());

  createEffect(() => {
    const first = routeOptions()[0];
    if (!selectedKey() && first) {
      setSelectedKey(first.key);
      setModelId(first.suggestedId);
    }
  });

  const handleSelect = (key: string) => {
    setSelectedKey(key);
    const next = routeOptions().find((option) => option.key === key);
    if (next) setModelId(next.suggestedId);
  };

  const createAlias = async () => {
    const option = selectedOption();
    const id = modelId().trim();
    if (!option || !id) return;
    setCreating(true);
    try {
      await props.onCreate({
        model_id: id,
        display_name: displayName().trim() || null,
        source_kind: 'direct',
        route: option.route,
        request_params: reasoningParams(option.route, reasoningEffort()),
        response_mode: 'buffered',
      });
      setDisplayName('');
      setReasoningEffort('');
      setModelId(option.suggestedId);
    } finally {
      setCreating(false);
    }
  };

  return (
    <section class="model-aliases-panel">
      <div class="model-aliases-panel__header">
        <div>
          <h2 class="routing-section__title">Model aliases</h2>
          <p class="routing-section__subtitle">Advertise opt-in model IDs through `/v1/models`.</p>
        </div>
      </div>

      <div class="model-aliases-panel__create">
        <label class="model-aliases-panel__field">
          <span>Route</span>
          <select value={selectedKey()} onInput={(e) => handleSelect(e.currentTarget.value)}>
            <For each={routeOptions()}>
              {(option) => <option value={option.key}>{option.label}</option>}
            </For>
          </select>
        </label>
        <label class="model-aliases-panel__field">
          <span>Model ID</span>
          <input
            value={modelId()}
            onInput={(e) => setModelId(e.currentTarget.value)}
            placeholder="openai-api/gpt-5"
          />
        </label>
        <label class="model-aliases-panel__field">
          <span>Display</span>
          <input
            value={displayName()}
            onInput={(e) => setDisplayName(e.currentTarget.value)}
            placeholder="Optional"
          />
        </label>
        <label class="model-aliases-panel__field model-aliases-panel__field--short">
          <span>Reasoning</span>
          <select
            value={reasoningEffort()}
            onInput={(e) => setReasoningEffort(e.currentTarget.value)}
          >
            <For each={REASONING_EFFORTS}>
              {(effort) => <option value={effort}>{effort || 'Default'}</option>}
            </For>
          </select>
        </label>
        <button
          type="button"
          class="btn btn--primary btn--sm"
          disabled={creating() || !selectedOption() || !modelId().trim()}
          onClick={createAlias}
        >
          {creating() ? 'Adding...' : 'Add alias'}
        </button>
      </div>

      <Show
        when={props.aliases.length > 0}
        fallback={<div class="model-aliases-panel__empty">No aliases configured.</div>}
      >
        <div class="model-aliases-panel__list">
          <For each={props.aliases}>
            {(alias) => (
              <ModelAliasRow
                alias={alias}
                onUpdate={props.onUpdate}
                onToggle={props.onToggle}
                onDelete={props.onDelete}
              />
            )}
          </For>
        </div>
      </Show>
    </section>
  );
};

const ModelAliasRow: Component<{
  alias: ModelAlias;
  onUpdate: (id: string, patch: UpdateModelAliasInput) => Promise<void>;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}> = (props) => {
  const [modelId, setModelId] = createSignal(props.alias.model_id);
  const [displayName, setDisplayName] = createSignal(props.alias.display_name ?? '');
  const [saving, setSaving] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  createEffect(() => {
    setModelId(props.alias.model_id);
    setDisplayName(props.alias.display_name ?? '');
  });

  const changed = () =>
    modelId().trim() !== props.alias.model_id ||
    (displayName().trim() || null) !== props.alias.display_name;

  const save = async () => {
    if (!changed()) return;
    setSaving(true);
    try {
      await props.onUpdate(props.alias.id, {
        model_id: modelId().trim(),
        display_name: displayName().trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await props.onDelete(props.alias.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div class="model-alias-row">
      <div class="model-alias-row__main">
        <input
          class="model-alias-row__id"
          value={modelId()}
          onInput={(e) => setModelId(e.currentTarget.value)}
        />
        <input
          class="model-alias-row__display"
          value={displayName()}
          onInput={(e) => setDisplayName(e.currentTarget.value)}
          placeholder="Display name"
        />
        <span class="model-alias-row__meta">{describeAlias(props.alias)}</span>
      </div>
      <div class="model-alias-row__actions">
        <button
          type="button"
          class="btn btn--outline btn--sm"
          disabled={saving() || !changed()}
          onClick={save}
        >
          {saving() ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          class="btn btn--outline btn--sm"
          onClick={() => props.onToggle(props.alias.id, !props.alias.enabled)}
        >
          {props.alias.enabled ? 'Hide' : 'Show'}
        </button>
        <button
          type="button"
          class="btn btn--outline btn--sm"
          disabled={deleting()}
          onClick={remove}
        >
          {deleting() ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
};

export function suggestedModelId(route: ModelRoute): string {
  const provider = route.provider.toLowerCase();
  const model = route.model.toLowerCase();
  if (model.startsWith(`${provider}/`)) return model;
  return `${provider}-${authSlug(route.authType)}/${model}`;
}

function reasoningParams(route: ModelRoute, effort: string): RequestParamDefaults | null {
  if (!effort) return null;
  if (route.authType === 'subscription') return { reasoning: { effort } };
  return { reasoning_effort: effort };
}

function describeAlias(alias: ModelAlias): string {
  if (alias.source_kind === 'direct' && alias.route) {
    const route = alias.route;
    const key = route.keyLabel ? ` · ${route.keyLabel}` : '';
    const effort = reasoningEffort(alias.request_params);
    return `${displayProvider(route.provider)} ${authLabel(route.authType)}${key} · ${
      route.model
    }${effort ? ` · ${effort}` : ''}`;
  }
  if (alias.source_kind === 'tier') return `Tier · ${alias.source_key}`;
  if (alias.source_kind === 'specificity') return `Task · ${alias.source_key}`;
  return `Header tier · ${alias.source_key}`;
}

function reasoningEffort(params: RequestParamDefaults | null): string | null {
  const flat = params?.reasoning_effort;
  if (typeof flat === 'string') return flat;
  const nested = params?.reasoning;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const effort = (nested as { effort?: unknown }).effort;
    return typeof effort === 'string' ? effort : null;
  }
  return null;
}

function authLabel(authType: AuthType): string {
  if (authType === 'api_key') return 'API';
  if (authType === 'subscription') return 'Subscription';
  return 'Local';
}

function authSlug(authType: AuthType): string {
  if (authType === 'api_key') return 'api';
  return authType;
}

function displayProvider(provider: string): string {
  if (provider.startsWith('custom:')) return 'Custom';
  return provider;
}

export default ModelAliasesPanel;

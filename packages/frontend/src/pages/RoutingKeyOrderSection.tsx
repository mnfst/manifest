import {
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
  type Accessor,
  type Component,
} from 'solid-js';
import type { KeyRotationRuleScope } from 'manifest-shared';
import {
  listKeyRules,
  saveKeyRules,
  type KeyRotationRule,
  type KeyRotationRuleInput,
} from '../services/api/key-rules.js';
import type {
  AuthType,
  AvailableModel,
  CustomProviderData,
  RoutingProvider,
} from '../services/api.js';
import { PROVIDERS } from '../services/providers.js';
import { providerIcon } from '../components/ProviderIcon.js';
import { customProviderColor } from '../services/formatters.js';
import { toast } from '../services/toast-store.js';
import '../styles/routing-key-order.css';

/**
 * Key order rules section for the Routing page. Two tiers, one shared
 * persistence model:
 *
 *  - Provider rules (`scope: 'provider'`): one ordered key list per provider,
 *    applied to EVERY model of that provider.
 *  - Model overrides (`scope: 'model'`): one ordered key list per model,
 *    which wins over the provider rule for that model.
 *
 * Precedence (backend, KeyRotationRuleService.getRule): a model-scope rule
 * wins for its model; otherwise the provider rule for the model's provider
 * applies; otherwise the route's pinned/default key.
 *
 * The whole rule list is the unit of persistence (PUT replaces it), so every
 * mutation — add, edit, delete, reorder, remove-key — computes the next list
 * and saves it in one call. A single in-flight save gates the rest of the
 * section so two rapid mutations can't race each other's full-list replace.
 */

export interface RoutingKeyOrderSectionProps {
  agentName: Accessor<string>;
  models: Accessor<AvailableModel[]>;
  connectedProviders: Accessor<RoutingProvider[]>;
  customProviders: Accessor<CustomProviderData[]>;
}

/** Browser-safe UUID v4 (crypto.randomUUID with a fallback). */
function browserUuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') return g.crypto.randomUUID();
  return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Active (has a key, enabled, non-local) key rows for a provider, by priority. */
function activeKeyRows(providers: RoutingProvider[], providerId: string): RoutingProvider[] {
  return providers
    .filter(
      (p) =>
        p.provider.toLowerCase() === providerId.toLowerCase() &&
        p.is_active &&
        p.has_api_key &&
        p.auth_type !== 'local',
    )
    .slice()
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Every selectable key label for a provider, ordered by priority. When the
 * model resolves to a known auth type (api_key vs subscription) that chain's
 * labels come first; labels are deduped case-insensitively.
 */
function orderedKeyLabels(
  providers: RoutingProvider[],
  providerId: string,
  modelAuthType?: string,
): string[] {
  const rows = activeKeyRows(providers, providerId);
  const rank = (r: RoutingProvider): number =>
    r.auth_type === modelAuthType ? 0 : r.auth_type === 'api_key' ? 1 : 2;
  const sorted = rows.slice().sort((a, b) => a.priority - b.priority || rank(a) - rank(b));
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const row of sorted) {
    const label = row.label || 'Default';
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

/** Auth type of a model served by a provider, when the model list knows it. */
function modelAuthType(
  models: AvailableModel[],
  providerId: string,
  model: string,
): AuthType | undefined {
  const m = models.find(
    (x) => x.model_name === model && x.provider.toLowerCase() === providerId.toLowerCase(),
  );
  return m?.auth_type ?? models.find((x) => x.model_name === model)?.auth_type;
}

function providerDisplayName(providerId: string, customProviders: CustomProviderData[]): string {
  if (providerId.startsWith('custom:')) {
    const id = providerId.slice('custom:'.length);
    return customProviders.find((c) => c.id === id)?.name ?? providerId;
  }
  return PROVIDERS.find((p) => p.id === providerId)?.name ?? providerId;
}

const ProviderGlyph: Component<{
  providerId: string;
  customProviders: () => CustomProviderData[];
}> = (props) => {
  if (props.providerId.startsWith('custom:')) {
    const id = props.providerId.slice('custom:'.length);
    const cp = () => props.customProviders().find((c) => c.id === id);
    return (
      <span class="key-order-card__glyph">
        <span
          class="key-order-card__letter"
          style={{ background: customProviderColor(cp()?.name ?? 'C') }}
        >
          {(cp()?.name ?? 'C').charAt(0).toUpperCase()}
        </span>
      </span>
    );
  }
  return <span class="key-order-card__glyph">{providerIcon(props.providerId, 20)}</span>;
};

/* ── Add-key control (shared by every key editor) ── */

interface KeyAddControlProps {
  /** Labels that can still be added (not already in the order). */
  labels: Accessor<string[]>;
  disabled: boolean;
  onAdd: (label: string) => void;
}

/**
 * The add-key control. A native <select> whose only enabled option is the
 * last remaining label is a dead control in browsers: its current value is
 * the disabled placeholder, so clicking can't drive a change and Enter just
 * commits the disabled option. Render a plain button for the single-remaining
 * case (click/Enter always fire); keep the select for the multi-label case
 * and the disabled "no more keys" state.
 *
 * Shared by both tiers' key editors — the create/edit modal serves provider
 * rules and model overrides alike, so both go through this one component.
 */
const KeyAddControl: Component<KeyAddControlProps> = (props) => {
  const [selection, setSelection] = createSignal('');

  const addLabel = (label: string) => {
    if (!label) return;
    props.onAdd(label);
    setSelection('');
  };

  return (
    <Show
      when={props.labels().length !== 1}
      fallback={
        <button
          type="button"
          class="btn btn--outline key-order-modal__add"
          disabled={props.disabled}
          onClick={() => addLabel(props.labels()[0]!)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addLabel(props.labels()[0]!);
            }
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" />
          </svg>
          Add {props.labels()[0]}
        </button>
      }
    >
      <select
        id="key-order-add-key"
        class="select key-order-modal__add"
        aria-label="Add a key"
        value={selection()}
        disabled={props.disabled || props.labels().length === 0}
        onChange={(e) => addLabel(e.currentTarget.value)}
      >
        <option value="" disabled>
          {props.labels().length === 0 ? 'No more keys to add' : 'Add a key…'}
        </option>
        <For each={props.labels()}>{(label) => <option value={label}>{label}</option>}</For>
      </select>
    </Show>
  );
};

/* ── Create / edit modal ─────────────────────────── */

interface KeyOrderRuleModalProps {
  editing: KeyRotationRule | null;
  /** Every rule currently saved (used for one-rule-per-scope validation). */
  rules: KeyRotationRule[];
  models: AvailableModel[];
  connectedProviders: RoutingProvider[];
  customProviders: CustomProviderData[];
  saving: boolean;
  onSave: (draft: {
    scope: KeyRotationRuleScope;
    model: string | null;
    provider: string;
    keyOrder: string[];
  }) => void;
  onClose: () => void;
}

const KeyOrderRuleModal: Component<KeyOrderRuleModalProps> = (props) => {
  const [scope, setScope] = createSignal<KeyRotationRuleScope>(props.editing?.scope ?? 'model');
  const [provider, setProvider] = createSignal(props.editing?.provider ?? '');
  const [model, setModel] = createSignal(props.editing?.model ?? '');
  const [keyOrder, setKeyOrder] = createSignal<string[]>(props.editing?.keyOrder ?? []);
  const [tried, setTried] = createSignal(false);

  /** Scope is fixed when editing: switching tiers would change the rule's identity. */
  const scopeLocked = () => props.editing !== null;

  const providerOptions = createMemo(() => {
    const map = new Map<string, number>();
    for (const p of props.connectedProviders) {
      if (p.is_active && p.has_api_key && p.auth_type !== 'local') {
        map.set(p.provider, (map.get(p.provider) ?? 0) + 1);
      }
    }
    if (props.editing?.provider && !map.has(props.editing.provider)) {
      map.set(props.editing.provider, 0);
    }
    return [...map.entries()].sort((a, b) =>
      providerDisplayName(a[0], props.customProviders).localeCompare(
        providerDisplayName(b[0], props.customProviders),
      ),
    );
  });

  const modelSuggestions = createMemo(() => {
    const providerId = provider();
    const all = props.models;
    if (!providerId) return all.map((m) => m.model_name);
    return all
      .filter((m) => m.provider.toLowerCase() === providerId.toLowerCase())
      .map((m) => m.model_name);
  });

  const modelAuth = () => modelAuthType(props.models, provider(), model().trim());

  /** Every label that can be added (not already in the order). */
  const availableLabels = createMemo(() => {
    const used = new Set(keyOrder().map((l) => l.toLowerCase()));
    return orderedKeyLabels(props.connectedProviders, provider(), modelAuth()).filter(
      (l) => !used.has(l.toLowerCase()),
    );
  });

  const isAvailableLabel = (label: string): boolean =>
    orderedKeyLabels(props.connectedProviders, provider(), modelAuth()).some(
      (l) => l.toLowerCase() === label.toLowerCase(),
    );

  const moveKey = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    const order = keyOrder();
    if (target < 0 || target >= order.length) return;
    const next = order.slice();
    const moved = next.splice(index, 1)[0];
    if (moved === undefined) return;
    next.splice(target, 0, moved);
    setKeyOrder(next);
  };

  const removeKey = (index: number) => {
    const next = keyOrder().slice();
    next.splice(index, 1);
    setKeyOrder(next);
  };

  const addKey = (label: string) => {
    const used = new Set(keyOrder().map((l) => l.toLowerCase()));
    if (used.has(label.toLowerCase())) return;
    setKeyOrder([...keyOrder(), label]);
  };

  const providerError = (): string | undefined => {
    if (!tried()) return undefined;
    if (!provider().trim()) return 'Choose a provider';
    return undefined;
  };

  const modelError = (): string | undefined => {
    if (!tried() || scope() !== 'model') return undefined;
    if (!model().trim()) return 'Enter a model name';
    return undefined;
  };

  /** One model rule per (agent, model): a duplicate for the same model is blocked. */
  const modelTakenError = (): string | undefined => {
    if (!tried() || scope() !== 'model') return undefined;
    const trimmed = model().trim().toLowerCase();
    if (!trimmed) return undefined;
    const taken = props.rules.some(
      (r) =>
        r.id !== props.editing?.id && r.scope !== 'provider' && r.model?.toLowerCase() === trimmed,
    );
    return taken ? 'A rule for this model already exists' : undefined;
  };

  /** One provider rule per (agent, provider): a duplicate for the same provider is blocked. */
  const providerTakenError = (): string | undefined => {
    if (!tried() || scope() !== 'provider') return undefined;
    const id = provider().trim().toLowerCase();
    if (!id) return undefined;
    const taken = props.rules.some(
      (r) =>
        r.id !== props.editing?.id && r.scope === 'provider' && r.provider.toLowerCase() === id,
    );
    return taken ? 'A provider rule for this provider already exists' : undefined;
  };

  const keysError = (): string | undefined => {
    if (!tried()) return undefined;
    if (keyOrder().length === 0) return 'Add at least one key';
    return undefined;
  };

  const submit = () => {
    setTried(true);
    if (
      providerError() !== undefined ||
      modelError() !== undefined ||
      modelTakenError() !== undefined ||
      providerTakenError() !== undefined ||
      keysError() !== undefined ||
      props.saving
    ) {
      return;
    }
    props.onSave({
      scope: scope(),
      model: scope() === 'provider' ? null : model().trim(),
      provider: provider().trim(),
      keyOrder: keyOrder(),
    });
  };

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        class="modal-card key-order-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="key-order-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' &&
            (e.target instanceof HTMLInputElement ||
              (e.target instanceof HTMLSelectElement && e.target.id !== 'key-order-add-key'))
          ) {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape' && !e.defaultPrevented) props.onClose();
        }}
      >
        <h2 class="modal-card__title" id="key-order-modal-title">
          {props.editing ? 'Edit key order rule' : 'Add key order rule'}
        </h2>
        <p class="modal-card__desc">
          Keys are tried in order and Manifest rotates to the next key when a call fails. A model
          override wins over the provider rule for that model; a provider rule applies to every
          model of the provider without an override.
        </p>

        <fieldset class="key-order-modal__scope">
          <legend class="modal-card__field-label">Rule scope</legend>
          <div class="key-order-modal__scope-options" role="radiogroup" aria-label="Rule scope">
            <label
              class="key-order-modal__scope-option"
              classList={{ 'is-selected': scope() === 'model' }}
            >
              <input
                type="radio"
                name="key-order-scope"
                value="model"
                checked={scope() === 'model'}
                disabled={props.saving || scopeLocked()}
                onChange={() => setScope('model')}
              />
              <span class="key-order-modal__scope-title">Model override</span>
              <span class="key-order-modal__scope-desc">
                One model — wins over its provider rule.
              </span>
            </label>
            <label
              class="key-order-modal__scope-option"
              classList={{ 'is-selected': scope() === 'provider' }}
            >
              <input
                type="radio"
                name="key-order-scope"
                value="provider"
                checked={scope() === 'provider'}
                disabled={props.saving || scopeLocked()}
                onChange={() => setScope('provider')}
              />
              <span class="key-order-modal__scope-title">Provider rule</span>
              <span class="key-order-modal__scope-desc">
                Every model of this provider without an override.
              </span>
            </label>
          </div>
        </fieldset>

        <label class="modal-card__field-label" for="key-order-provider">
          Provider
        </label>
        <select
          id="key-order-provider"
          class="select"
          value={provider()}
          disabled={props.saving}
          onChange={(e) => setProvider(e.currentTarget.value)}
        >
          <option value="" disabled>
            Choose a provider…
          </option>
          <For each={providerOptions()}>
            {([id, count]) => (
              <option value={id}>
                {providerDisplayName(id, props.customProviders)}
                {count > 0 ? ` (${count} key${count === 1 ? '' : 's'})` : ' (no active keys)'}
              </option>
            )}
          </For>
        </select>
        <Show when={provider() && availableLabels().length === 0 && keyOrder().length === 0}>
          <div class="key-order-modal__error">
            No active keys for this provider. Add a key on the Providers page first.
          </div>
        </Show>
        <Show when={providerError()}>
          <div class="key-order-modal__error">{providerError()}</div>
        </Show>
        <Show when={providerTakenError()}>
          <div class="key-order-modal__error">{providerTakenError()}</div>
        </Show>

        <Show when={scope() === 'model'}>
          <label class="modal-card__field-label" for="key-order-model">
            Model
          </label>
          <input
            id="key-order-model"
            class="modal-card__input"
            classList={{ 'modal-card__input--error': modelError() !== undefined }}
            type="text"
            list="key-rule-model-list"
            autocomplete="off"
            spellcheck={false}
            placeholder="e.g. claude-sonnet-5"
            value={model()}
            disabled={props.saving}
            onInput={(e) => setModel(e.currentTarget.value)}
          />
          <datalist id="key-rule-model-list">
            <For each={modelSuggestions()}>{(name) => <option value={name} />}</For>
          </datalist>
          <Show when={modelError()}>
            <div class="key-order-modal__error">{modelError()}</div>
          </Show>
          <Show when={modelTakenError()}>
            <div class="key-order-modal__error">{modelTakenError()}</div>
          </Show>
        </Show>

        <label class="modal-card__field-label">Key order</label>
        <p class="key-order-modal__helper" id="key-order-keys-hint">
          The first key is tried first. Use the arrows to reorder.
        </p>
        <div class="key-order-modal__keys" aria-describedby="key-order-keys-hint">
          <Show
            when={keyOrder().length > 0}
            fallback={
              <div class="key-order-modal__error" style="margin-top: 0;">
                No keys yet — add one below.
              </div>
            }
          >
            <ul class="key-order-list">
              <For each={keyOrder()}>
                {(label, i) => (
                  <li class="key-order-chip">
                    <span class="key-order-chip__ordinal">{i() + 1}</span>
                    <span class="key-order-chip__label" title={label}>
                      {label}
                    </span>
                    <Show when={!isAvailableLabel(label)}>
                      <span
                        class="key-order-chip__hint"
                        title="This key isn't active for the provider"
                      >
                        not available
                      </span>
                    </Show>
                    <button
                      type="button"
                      class="key-order-chip__btn"
                      aria-label={`Move ${label} up`}
                      title="Move up"
                      disabled={props.saving || i() === 0}
                      onClick={() => moveKey(i(), -1)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="m12 6.41 5.29 5.3a1 1 0 0 0 1.42-1.42l-6-6a1 1 0 0 0-1.42 0l-6 6a1 1 0 0 0 1.42 1.42z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="key-order-chip__btn"
                      aria-label={`Move ${label} down`}
                      title="Move down"
                      disabled={props.saving || i() >= keyOrder().length - 1}
                      onClick={() => moveKey(i(), 1)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="m12 17.59 5.29-5.3a1 1 0 0 1 1.42 1.42l-6 6a1 1 0 0 1-1.42 0l-6-6a1 1 0 0 1 1.42-1.42z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="key-order-chip__btn key-order-chip__btn--remove"
                      aria-label={`Remove ${label}`}
                      title="Remove"
                      disabled={props.saving || keyOrder().length <= 1}
                      onClick={() => removeKey(i())}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M18.3 5.7a1 1 0 0 0-1.42 0L12 10.6 7.12 5.7a1 1 0 1 0-1.42 1.42L10.6 12l-4.9 4.88a1 1 0 1 0 1.42 1.42L12 13.4l4.88 4.9a1 1 0 0 0 1.42-1.42L13.4 12l4.9-4.88a1 1 0 0 0 0-1.42Z" />
                      </svg>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
        <KeyAddControl labels={availableLabels} disabled={props.saving} onAdd={addKey} />
        <Show when={keysError()}>
          <div class="key-order-modal__error">{keysError()}</div>
        </Show>

        <div class="key-order-modal__footer">
          <button
            type="button"
            class="btn btn--ghost"
            disabled={props.saving}
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button type="button" class="btn btn--primary" disabled={props.saving} onClick={submit}>
            {props.saving ? <span class="spinner" /> : props.editing ? 'Save changes' : 'Add rule'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Section ─────────────────────────────────────── */

const RoutingKeyOrderSection: Component<RoutingKeyOrderSectionProps> = (props) => {
  const [loadFailed, setLoadFailed] = createSignal(false);
  const [rulesRes, { mutate }] = createResource(
    () => props.agentName(),
    async (name) => {
      setLoadFailed(false);
      try {
        const data = await listKeyRules(name);
        return data.rules ?? [];
      } catch {
        // Silent like the page's other loaders (listHeaderTiers etc.); the
        // section's empty state shows an inline note when the load failed.
        setLoadFailed(true);
        return [] as KeyRotationRule[];
      }
    },
  );

  const [modalState, setModalState] = createSignal<KeyRotationRule | 'new' | null>(null);
  /** Rule id being saved, or '__modal__' while the modal's save is in flight. */
  const [savingTarget, setSavingTarget] = createSignal<string | null>(null);
  const saving = createMemo(() => savingTarget() !== null);

  const rules = (): KeyRotationRule[] => rulesRes() ?? [];

  const providerRules = createMemo(() => rules().filter((r) => r.scope === 'provider'));
  const modelRules = createMemo(() => rules().filter((r) => r.scope !== 'provider'));

  const providerKeyCount = (providerId: string): number =>
    activeKeyRows(props.connectedProviders(), providerId).length;

  /** Full-list save. Assumes the caller already gated on `saving()`. */
  const persist = async (next: KeyRotationRuleInput[], target: string) => {
    setSavingTarget(target);
    try {
      const saved = await saveKeyRules(props.agentName(), next);
      mutate(saved.rules ?? []);
      return true;
    } catch {
      // saveKeyRules (via fetchMutate) already surfaced the backend error.
      return false;
    } finally {
      setSavingTarget(null);
    }
  };

  const reorderKey = async (rule: KeyRotationRule, index: number, dir: -1 | 1) => {
    if (saving()) return;
    const target = index + dir;
    if (target < 0 || target >= rule.keyOrder.length) return;
    const order = rule.keyOrder.slice();
    const moved = order.splice(index, 1)[0];
    if (moved === undefined) return;
    order.splice(target, 0, moved);
    const prev = rules();
    const next = rules().map((r) => (r.id === rule.id ? { ...r, keyOrder: order } : r));
    mutate(next); // optimistic — roll back below if the save fails
    const ok = await persist(next, rule.id);
    if (!ok) mutate(prev);
  };

  const removeKey = async (rule: KeyRotationRule, index: number) => {
    if (saving() || rule.keyOrder.length <= 1) return;
    const order = rule.keyOrder.slice();
    order.splice(index, 1);
    const prev = rules();
    const next = rules().map((r) => (r.id === rule.id ? { ...r, keyOrder: order } : r));
    mutate(next);
    const ok = await persist(next, rule.id);
    if (!ok) mutate(prev);
    else toast.success('Key removed from rule');
  };

  const handleDelete = async (rule: KeyRotationRule) => {
    if (saving()) return;
    const name =
      rule.scope === 'provider'
        ? providerDisplayName(rule.provider, props.customProviders())
        : (rule.model ?? rule.provider);
    const question =
      rule.scope === 'provider'
        ? `Remove the provider rule for "${name}"? It applies to every model of ${name} without an override.`
        : `Remove the key order rule for "${name}"?`;
    if (!confirm(question)) return;
    const prev = rules();
    const next = rules().filter((r) => r.id !== rule.id);
    const ok = await persist(next, rule.id);
    if (ok)
      toast.success(rule.scope === 'provider' ? 'Provider rule removed' : 'Key order rule removed');
    else mutate(prev);
  };

  const handleModalSave = (draft: {
    scope: KeyRotationRuleScope;
    model: string | null;
    provider: string;
    keyOrder: string[];
  }) => {
    if (saving()) return;
    const editing = modalState() !== 'new' ? (modalState() as KeyRotationRule | null) : null;
    const prev = rules();
    // agentId is never sent: the backend resolves the agent from the URL and
    // upserts by (agent_id, model) / (agent_id, provider), honoring our id
    // when present.
    const rule: KeyRotationRuleInput = {
      id: editing?.id ?? browserUuid(),
      model: draft.model,
      provider: draft.provider,
      scope: draft.scope,
      keyOrder: draft.keyOrder,
    };
    const next = editing
      ? rules().map((r) => (r.id === editing.id ? rule : r))
      : [...rules(), rule];
    void persist(next, '__modal__').then((ok) => {
      if (ok) {
        setModalState(null);
        const isProvider = draft.scope === 'provider';
        toast.success(
          editing
            ? isProvider
              ? 'Provider rule updated'
              : 'Model override updated'
            : isProvider
              ? 'Provider rule added'
              : 'Model override added',
        );
      } else {
        mutate(prev);
      }
    });
  };

  return (
    <div class="routing-section key-order-section">
      <div class="routing-section__header key-order-section__header" style="margin-bottom: 16px;">
        <div>
          <h2 class="routing-section__title">Key order rules</h2>
          <span class="routing-section__subtitle">
            Choose which API key is tried first — for a provider, or for one model. Keys are tried
            in order, and Manifest rotates to the next key when one fails. A model override wins
            over the provider rule for that model; the provider rule covers the models without one.
          </span>
        </div>
        <button
          type="button"
          class="btn btn--primary btn--sm routing-section__cta"
          disabled={saving() || rulesRes.loading}
          onClick={() => setModalState('new')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" />
          </svg>
          Add rule
        </button>
      </div>

      <Show
        when={!rulesRes.loading}
        fallback={
          <div class="key-order-skeleton">
            <div class="key-order-skeleton__bar" style="height: 116px;" />
            <div class="key-order-skeleton__bar" style="height: 116px;" />
          </div>
        }
      >
        <Show
          when={rules().length > 0}
          fallback={
            <div class="key-order-empty">
              <div class="key-order-empty__title">No key order rules yet</div>
              <div class="key-order-empty__desc">
                Add a provider rule or a model override to choose which API key is tried first.
                Manifest rotates to the next key when a call fails.
              </div>
              <Show when={loadFailed()}>
                <div class="key-order-empty__error">
                  Couldn't load key order rules. Saving a new rule retries the load.
                </div>
              </Show>
              <button
                type="button"
                class="btn btn--primary btn--sm"
                disabled={saving()}
                onClick={() => setModalState('new')}
              >
                Add rule
              </button>
            </div>
          }
        >
          <div class="key-order-tiers">
            {/* ── Provider rules tier ───────────────────────────── */}
            <div class="key-order-tier">
              <div class="key-order-tier__head">
                <h3 class="key-order-tier__title">Provider rules</h3>
                <span class="key-order-tier__count">{providerRules().length}</span>
                <span class="key-order-tier__hint">
                  Applies to every model of this provider without an override.
                </span>
              </div>
              <Show
                when={providerRules().length > 0}
                fallback={
                  <div class="key-order-tier__empty">
                    No provider rules yet — add one to order keys for every model of a provider.
                  </div>
                }
              >
                <div class="routing-cards">
                  <For each={providerRules()}>
                    {(rule) => {
                      const busy = () => savingTarget() === rule.id;
                      return (
                        <div class="routing-card key-order-card">
                          <div class="key-order-card__head">
                            <ProviderGlyph
                              providerId={rule.provider}
                              customProviders={props.customProviders}
                            />
                            <div class="key-order-card__titles">
                              <span
                                class="key-order-card__model"
                                title={providerDisplayName(rule.provider, props.customProviders())}
                              >
                                {providerDisplayName(rule.provider, props.customProviders())}
                              </span>
                              <span class="key-order-card__provider">
                                {providerKeyCount(rule.provider) > 0
                                  ? `All models · ${providerKeyCount(rule.provider)} key${
                                      providerKeyCount(rule.provider) === 1 ? '' : 's'
                                    }`
                                  : 'All models · no active keys'}
                              </span>
                            </div>
                            <div class="key-order-card__actions">
                              <Show
                                when={busy()}
                                fallback={
                                  <>
                                    <button
                                      type="button"
                                      class="key-order-card__action"
                                      disabled={saving()}
                                      onClick={() => setModalState(rule)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      class="key-order-card__action key-order-card__action--danger"
                                      disabled={saving()}
                                      onClick={() => void handleDelete(rule)}
                                    >
                                      Remove
                                    </button>
                                  </>
                                }
                              >
                                <span class="spinner" style="width: 14px; height: 14px;" />
                              </Show>
                            </div>
                          </div>
                          <ul class="key-order-list">
                            <For each={rule.keyOrder}>
                              {(label, i) => (
                                <li class="key-order-chip">
                                  <span class="key-order-chip__ordinal">{i() + 1}</span>
                                  <span class="key-order-chip__label" title={label}>
                                    {label}
                                  </span>
                                  <button
                                    type="button"
                                    class="key-order-chip__btn"
                                    aria-label={`Move ${label} up`}
                                    title="Move up"
                                    disabled={saving() || i() === 0}
                                    onClick={() => void reorderKey(rule, i(), -1)}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                    >
                                      <path d="m12 6.41 5.29 5.3a1 1 0 0 0 1.42-1.42l-6-6a1 1 0 0 0-1.42 0l-6 6a1 1 0 0 0 1.42 1.42z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    class="key-order-chip__btn"
                                    aria-label={`Move ${label} down`}
                                    title="Move down"
                                    disabled={saving() || i() >= rule.keyOrder.length - 1}
                                    onClick={() => void reorderKey(rule, i(), 1)}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                    >
                                      <path d="m12 17.59 5.29-5.3a1 1 0 0 1 1.42 1.42l-6 6a1 1 0 0 1-1.42 0l-6-6a1 1 0 0 1 1.42-1.42z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    class="key-order-chip__btn key-order-chip__btn--remove"
                                    aria-label={`Remove ${label}`}
                                    title="Remove"
                                    disabled={saving() || rule.keyOrder.length <= 1}
                                    onClick={() => void removeKey(rule, i())}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                    >
                                      <path d="M18.3 5.7a1 1 0 0 0-1.42 0L12 10.6 7.12 5.7a1 1 0 1 0-1.42 1.42L10.6 12l-4.9 4.88a1 1 0 1 0 1.42 1.42L12 13.4l4.88 4.9a1 1 0 0 0 1.42-1.42L13.4 12l4.9-4.88a1 1 0 0 0 0-1.42Z" />
                                    </svg>
                                  </button>
                                </li>
                              )}
                            </For>
                          </ul>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>

            {/* ── Model overrides tier ─────────────────────────── */}
            <div class="key-order-tier">
              <div class="key-order-tier__head">
                <h3 class="key-order-tier__title">Model overrides</h3>
                <span class="key-order-tier__count">{modelRules().length}</span>
                <span class="key-order-tier__hint">Wins over the provider rule for its model.</span>
              </div>
              <Show
                when={modelRules().length > 0}
                fallback={
                  <div class="key-order-tier__empty">
                    No model overrides yet — add one to pin keys for a single model.
                  </div>
                }
              >
                <div class="routing-cards">
                  <For each={modelRules()}>
                    {(rule) => {
                      const busy = () => savingTarget() === rule.id;
                      return (
                        <div class="routing-card key-order-card">
                          <div class="key-order-card__head">
                            <ProviderGlyph
                              providerId={rule.provider}
                              customProviders={props.customProviders}
                            />
                            <div class="key-order-card__titles">
                              <span
                                class="key-order-card__model"
                                title={rule.model ?? rule.provider}
                              >
                                {rule.model}
                              </span>
                              <span class="key-order-card__provider" title={rule.provider}>
                                {providerDisplayName(rule.provider, props.customProviders())}
                                {providerKeyCount(rule.provider) > 0
                                  ? ` · ${providerKeyCount(rule.provider)} key${
                                      providerKeyCount(rule.provider) === 1 ? '' : 's'
                                    }`
                                  : ' · no active keys'}
                              </span>
                            </div>
                            <div class="key-order-card__actions">
                              <Show
                                when={busy()}
                                fallback={
                                  <>
                                    <button
                                      type="button"
                                      class="key-order-card__action"
                                      disabled={saving()}
                                      onClick={() => setModalState(rule)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      class="key-order-card__action key-order-card__action--danger"
                                      disabled={saving()}
                                      onClick={() => void handleDelete(rule)}
                                    >
                                      Remove
                                    </button>
                                  </>
                                }
                              >
                                <span class="spinner" style="width: 14px; height: 14px;" />
                              </Show>
                            </div>
                          </div>
                          <ul class="key-order-list">
                            <For each={rule.keyOrder}>
                              {(label, i) => (
                                <li class="key-order-chip">
                                  <span class="key-order-chip__ordinal">{i() + 1}</span>
                                  <span class="key-order-chip__label" title={label}>
                                    {label}
                                  </span>
                                  <button
                                    type="button"
                                    class="key-order-chip__btn"
                                    aria-label={`Move ${label} up`}
                                    title="Move up"
                                    disabled={saving() || i() === 0}
                                    onClick={() => void reorderKey(rule, i(), -1)}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                    >
                                      <path d="m12 6.41 5.29 5.3a1 1 0 0 0 1.42-1.42l-6-6a1 1 0 0 0-1.42 0l-6 6a1 1 0 0 0 1.42 1.42z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    class="key-order-chip__btn"
                                    aria-label={`Move ${label} down`}
                                    title="Move down"
                                    disabled={saving() || i() >= rule.keyOrder.length - 1}
                                    onClick={() => void reorderKey(rule, i(), 1)}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                    >
                                      <path d="m12 17.59 5.29-5.3a1 1 0 0 1 1.42 1.42l-6 6a1 1 0 0 1-1.42 0l-6-6a1 1 0 0 1 1.42-1.42z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    class="key-order-chip__btn key-order-chip__btn--remove"
                                    aria-label={`Remove ${label}`}
                                    title="Remove"
                                    disabled={saving() || rule.keyOrder.length <= 1}
                                    onClick={() => void removeKey(rule, i())}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="12"
                                      height="12"
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                    >
                                      <path d="M18.3 5.7a1 1 0 0 0-1.42 0L12 10.6 7.12 5.7a1 1 0 1 0-1.42 1.42L10.6 12l-4.9 4.88a1 1 0 1 0 1.42 1.42L12 13.4l4.88 4.9a1 1 0 0 0 1.42-1.42L13.4 12l4.9-4.88a1 1 0 0 0 0-1.42Z" />
                                    </svg>
                                  </button>
                                </li>
                              )}
                            </For>
                          </ul>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </Show>

      <Show when={modalState()} keyed>
        {(state) => (
          <KeyOrderRuleModal
            editing={state === 'new' ? null : state}
            rules={rules()}
            models={props.models()}
            connectedProviders={props.connectedProviders()}
            customProviders={props.customProviders()}
            saving={saving()}
            onSave={handleModalSave}
            onClose={() => setModalState(null)}
          />
        )}
      </Show>
    </div>
  );
};

export default RoutingKeyOrderSection;

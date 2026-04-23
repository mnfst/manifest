import { createResource, createSignal, Index, For, Show, type Component } from 'solid-js';
import {
  createCustomProvider,
  deleteCustomProvider,
  probeCustomProvider,
  updateCustomProvider,
  type CustomProviderModel,
  type CustomProviderData,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import type { CustomProviderPrefill } from '../services/routing-params.js';

interface Preset {
  label: string;
  name: string;
  baseUrl: string;
}

const LOCAL_SERVER_PRESETS: Preset[] = [
  { label: 'Ollama', name: 'Ollama (host)', baseUrl: 'http://host.docker.internal:11434/v1' },
  { label: 'vLLM', name: 'vLLM', baseUrl: 'http://host.docker.internal:8000/v1' },
  { label: 'LM Studio', name: 'LM Studio', baseUrl: 'http://host.docker.internal:1234/v1' },
  { label: 'llama.cpp', name: 'llama.cpp', baseUrl: 'http://host.docker.internal:8080/v1' },
];

interface Props {
  agentName: string;
  onCreated: () => void;
  onBack: () => void;
  initialData?: CustomProviderData;
  prefill?: CustomProviderPrefill;
  onDeleted?: () => void;
}

interface ModelRow {
  model_name: string;
  input_price: string;
  output_price: string;
}

const emptyRow = (): ModelRow => ({ model_name: '', input_price: '', output_price: '' });

const toModelRows = (models: CustomProviderModel[]): ModelRow[] =>
  models.map((m) => ({
    model_name: m.model_name,
    input_price:
      m.input_price_per_million_tokens != null ? String(m.input_price_per_million_tokens) : '',
    output_price:
      m.output_price_per_million_tokens != null ? String(m.output_price_per_million_tokens) : '',
  }));

const CustomProviderForm: Component<Props> = (props) => {
  const isEdit = () => !!props.initialData;

  const prefillRows = (): ModelRow[] => {
    if (!props.prefill?.models?.length) return [emptyRow()];
    return props.prefill.models.map((m) => ({
      model_name: m.model_name,
      input_price: m.input_price ?? '',
      output_price: m.output_price ?? '',
    }));
  };

  const [name, setName] = createSignal(props.initialData?.name ?? props.prefill?.name ?? '');
  const [baseUrl, setBaseUrl] = createSignal(
    props.initialData?.base_url ?? props.prefill?.baseUrl ?? '',
  );
  const [apiKey, setApiKey] = createSignal(props.prefill?.apiKey ?? '');
  const [editingKey, setEditingKey] = createSignal(false);
  const [rows, setRows] = createSignal<ModelRow[]>(
    props.initialData ? toModelRows(props.initialData.models) : prefillRows(),
  );
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [probeBusy, setProbeBusy] = createSignal(false);
  const [probeError, setProbeError] = createSignal<string | null>(null);
  const [isSelfHosted] = createResource(() => checkIsSelfHosted());

  const applyPreset = (preset: Preset) => {
    setName(preset.name);
    setBaseUrl(preset.baseUrl);
    setApiKey('');
    setEditingKey(true);
    setError(null);
    setProbeError(null);
  };

  const handleProbe = async () => {
    const url = baseUrl().trim();
    if (!url) {
      setProbeError('Enter a base URL first');
      return;
    }
    setProbeBusy(true);
    setProbeError(null);
    try {
      const { models } = await probeCustomProvider(
        props.agentName,
        url,
        apiKey().trim() || undefined,
      );
      if (models.length === 0) {
        setProbeError('Server returned no models');
        return;
      }
      setRows(models.map((m) => ({ model_name: m.model_name, input_price: '', output_price: '' })));
    } catch (e) {
      setProbeError(e instanceof Error ? e.message : 'Probe failed');
    } finally {
      setProbeBusy(false);
    }
  };

  const updateRow = (index: number, field: keyof ModelRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const validModels = () => rows().filter((r) => r.model_name.trim());

  const canSubmit = () => name().trim() && baseUrl().trim() && validModels().length > 0 && !busy();

  const parsePrice = (v: string): number => Number(v.replace(',', '.'));

  const buildModels = (): CustomProviderModel[] =>
    validModels().map((r) => ({
      model_name: r.model_name.trim(),
      ...(r.input_price !== ''
        ? { input_price_per_million_tokens: parsePrice(r.input_price) }
        : {}),
      ...(r.output_price !== ''
        ? { output_price_per_million_tokens: parsePrice(r.output_price) }
        : {}),
    }));

  const handleCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      await createCustomProvider(props.agentName, {
        name: name().trim(),
        base_url: baseUrl().trim(),
        apiKey: apiKey().trim() || undefined,
        models: buildModels(),
      });
      toast.success(`${name().trim()} connected`);
      props.onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create provider');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    setError(null);
    const data: Record<string, unknown> = {
      name: name().trim(),
      base_url: baseUrl().trim(),
      models: buildModels(),
    };
    if (editingKey()) {
      data.apiKey = apiKey().trim() || undefined;
    }

    setBusy(true);
    try {
      await updateCustomProvider(props.agentName, props.initialData!.id, data as never);
      toast.success(`${name().trim()} updated`);
      props.onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update provider');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteCustomProvider(props.agentName, props.initialData!.id);
      toast.success(`${props.initialData!.name} removed`);
      props.onDeleted?.();
    } catch {
      // error toast from fetchMutate
    } finally {
      setBusy(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSubmit = () => {
    if (isEdit()) handleUpdate();
    else handleCreate();
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
        <div>
          <div class="routing-modal__title">
            {isEdit() ? 'Edit custom provider' : 'Add custom provider'}
          </div>
          <div class="routing-modal__subtitle">Connect any OpenAI-compatible endpoint</div>
        </div>
      </div>

      <Show when={!isEdit() && isSelfHosted()}>
        <div class="provider-detail__field">
          <div class="provider-detail__label">Local server presets</div>
          <div class="custom-provider-presets" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <For each={LOCAL_SERVER_PRESETS}>
              {(preset) => (
                <button
                  type="button"
                  class="btn btn--outline btn--sm"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit()) handleSubmit();
        }}
      >
        <div class="provider-detail__field">
          <label class="provider-detail__label" for="cp-name">
            Provider name
          </label>
          <input
            id="cp-name"
            class="provider-detail__input"
            type="text"
            placeholder="e.g. Groq, vLLM, Azure"
            value={name()}
            onInput={(e) => {
              setName(e.currentTarget.value);
              setError(null);
            }}
          />
        </div>

        <div class="provider-detail__field">
          <label class="provider-detail__label" for="cp-base-url">
            Base URL
          </label>
          <div class="provider-detail__key-row">
            <input
              id="cp-base-url"
              class="provider-detail__input"
              type="url"
              placeholder="https://api.example.com/v1"
              value={baseUrl()}
              onInput={(e) => {
                setBaseUrl(e.currentTarget.value);
                setError(null);
                setProbeError(null);
              }}
            />
            <button
              type="button"
              class="btn btn--outline btn--sm"
              onClick={handleProbe}
              disabled={probeBusy() || !baseUrl().trim()}
              aria-label="Fetch models from the server's /v1/models endpoint"
            >
              {probeBusy() ? <span class="spinner" /> : 'Fetch models'}
            </button>
          </div>
          <Show when={isSelfHosted()}>
            <div
              class="provider-detail__hint"
              style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin-top: 4px;"
            >
              For local servers use <code>http://host.docker.internal:&lt;port&gt;</code> (Docker)
              or <code>http://localhost:&lt;port&gt;</code> (native). HTTPS required for public
              URLs.
            </div>
          </Show>
          <Show when={probeError()}>
            <div class="provider-detail__error" role="alert" style="margin-top: 4px;">
              {probeError()}
            </div>
          </Show>
        </div>

        <div class="provider-detail__field">
          <label class="provider-detail__label" for="cp-api-key">
            API Key{' '}
            <span style="color: hsl(var(--muted-foreground)); font-weight: 400;">
              (optional for local providers)
            </span>
          </label>
          <Show when={isEdit() && !editingKey()}>
            <div class="provider-detail__key-row">
              <input
                id="cp-api-key"
                class="provider-detail__input provider-detail__input--disabled"
                type="text"
                value={props.initialData?.has_api_key ? '••••••••••••' : 'No key set'}
                disabled
                aria-label="Current API key (masked)"
              />
              <button
                type="button"
                class="btn btn--outline btn--sm"
                onClick={() => {
                  setEditingKey(true);
                  setApiKey('');
                }}
              >
                Change
              </button>
            </div>
          </Show>
          <Show when={!isEdit() || editingKey()}>
            <input
              id="cp-api-key"
              class="provider-detail__input provider-detail__input--masked"
              type="text"
              autocomplete="off"
              placeholder="sk-..."
              value={apiKey()}
              onInput={(e) => setApiKey(e.currentTarget.value)}
            />
          </Show>
        </div>

        <div class="provider-detail__field">
          <label class="provider-detail__label">Models</label>
          <div class="custom-provider-models">
            <Index each={rows()}>
              {(row, i) => (
                <div class="custom-provider-model-row">
                  <input
                    class="provider-detail__input custom-provider-model-row__name"
                    type="text"
                    placeholder="Model name"
                    aria-label={`Model ${i + 1} name`}
                    value={row().model_name}
                    onInput={(e) => updateRow(i, 'model_name', e.currentTarget.value)}
                  />
                  <input
                    class="provider-detail__input custom-provider-model-row__price"
                    type="text"
                    inputmode="decimal"
                    placeholder="$/M in"
                    aria-label={`Model ${i + 1} input price per million tokens`}
                    value={row().input_price}
                    onInput={(e) => updateRow(i, 'input_price', e.currentTarget.value)}
                  />
                  <input
                    class="provider-detail__input custom-provider-model-row__price"
                    type="text"
                    inputmode="decimal"
                    placeholder="$/M out"
                    aria-label={`Model ${i + 1} output price per million tokens`}
                    value={row().output_price}
                    onInput={(e) => updateRow(i, 'output_price', e.currentTarget.value)}
                  />
                  <button
                    type="button"
                    class="custom-provider-model-row__remove"
                    onClick={() => removeRow(i)}
                    disabled={rows().length <= 1}
                    aria-label={`Remove model ${i + 1}`}
                    title="Remove"
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
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </Index>
            <button
              type="button"
              class="btn btn--outline btn--sm"
              onClick={addRow}
              disabled={!rows().at(-1)?.model_name.trim()}
              style="margin-top: 4px; align-self: flex-start;"
            >
              + Add model
            </button>
          </div>
        </div>

        {error() && (
          <div class="provider-detail__error" role="alert">
            {error()}
          </div>
        )}

        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 16px;">
          <Show when={isEdit()} fallback={<div />}>
            <button
              type="button"
              class="btn btn--outline btn--sm provider-detail__disconnect"
              disabled={busy()}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete provider
            </button>
          </Show>
          <button
            type="submit"
            class="btn btn--primary btn--sm provider-detail__action"
            disabled={!canSubmit()}
          >
            {busy() ? <span class="spinner" /> : isEdit() ? 'Save changes' : 'Connect'}
          </button>
        </div>
      </form>

      {/* -- Delete Confirmation Modal -- */}
      <Show when={showDeleteConfirm()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteConfirm(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowDeleteConfirm(false);
          }}
        >
          <div
            class="modal-card"
            style="max-width: 400px;"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-provider-modal-title"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
              <h3
                id="delete-provider-modal-title"
                style="margin: 0; font-size: var(--font-size-lg);"
              >
                Delete provider
              </h3>
              <button
                style="background: none; border: none; cursor: pointer; color: hsl(var(--muted-foreground)); padding: 4px;"
                onClick={() => setShowDeleteConfirm(false)}
                aria-label="Close"
              >
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
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-lg);">
              Remove{' '}
              <strong style="color: hsl(var(--foreground));">{props.initialData?.name}</strong>?
              This will delete all its models and any routing assignments using them. This action
              cannot be undone.
            </p>
            <div style="display: flex; gap: var(--gap-sm); justify-content: flex-end;">
              <button
                class="btn btn--outline btn--sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={busy()}
              >
                Cancel
              </button>
              <button class="btn btn--danger btn--sm" onClick={handleDelete} disabled={busy()}>
                {busy() ? <span class="spinner" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default CustomProviderForm;

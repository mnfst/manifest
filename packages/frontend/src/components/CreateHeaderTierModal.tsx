import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { TIER_COLORS, type TierColor } from 'manifest-shared';
import HeaderComboBox, { type HeaderSuggestion } from './HeaderComboBox.js';
import {
  createHeaderTier,
  getSeenHeaders,
  type HeaderTier,
  type SeenHeader,
} from '../services/api/header-tiers.js';
import { toast } from '../services/toast-store.js';

const RESERVED_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
]);
const HEADER_KEY_RE = /^[a-z0-9-]+$/;

interface Props {
  agentName: string;
  existingTiers: HeaderTier[];
  onClose: () => void;
  onCreated: (tier: HeaderTier) => void;
}

const CreateHeaderTierModal: Component<Props> = (props) => {
  const [name, setName] = createSignal('');
  const [headerKey, setHeaderKey] = createSignal('');
  const [headerValue, setHeaderValue] = createSignal('');
  const [badgeColor, setBadgeColor] = createSignal<TierColor>('indigo');
  const [submitting, setSubmitting] = createSignal(false);
  const [triedSubmit, setTriedSubmit] = createSignal(false);

  const [seen] = createResource<SeenHeader[]>(() =>
    getSeenHeaders(props.agentName).catch(() => []),
  );

  const keySuggestions = (): HeaderSuggestion[] => {
    const rows = seen() ?? [];
    return rows
      .filter((r) => !RESERVED_KEYS.has(r.key))
      .map((r) => ({
        label: r.key,
        value: r.key,
        group: r.sdks[0],
        sublabel:
          r.top_values.length > 0
            ? `${r.count}× · ${r.top_values.slice(0, 3).join(' · ')}`
            : `${r.count}× seen`,
      }));
  };

  const valueSuggestions = (): HeaderSuggestion[] => {
    const key = headerKey().trim().toLowerCase();
    if (!key) return [];
    const row = (seen() ?? []).find((r) => r.key === key);
    return (row?.top_values ?? []).map((v) => ({ label: v, value: v }));
  };

  const nameError = (): string | undefined => {
    if (!triedSubmit()) return;
    const trimmed = name().trim();
    if (!trimmed) return 'Name is required';
    if (trimmed.length > 32) return 'Name must be 32 characters or fewer';
    const lower = trimmed.toLowerCase();
    if (props.existingTiers.some((t) => t.name.toLowerCase() === lower)) {
      return 'A tier with this name already exists';
    }
  };

  const keyError = (): string | undefined => {
    if (!triedSubmit()) return;
    const key = headerKey().trim().toLowerCase();
    if (!key) return 'Header key is required';
    if (!HEADER_KEY_RE.test(key)) {
      return 'Header keys can only contain lowercase letters, digits, and hyphens';
    }
    if (RESERVED_KEYS.has(key)) {
      return "This header is stripped for security and can't be used as a match rule";
    }
  };

  const valueError = (): string | undefined => {
    if (!triedSubmit()) return;
    const v = headerValue().trim();
    if (!v) return 'Header value is required';
    if (v.length > 128) return 'Header value must be 128 characters or fewer';
    const key = headerKey().trim().toLowerCase();
    if (props.existingTiers.some((t) => t.header_key === key && t.header_value === v)) {
      return 'Another tier already matches this header key and value';
    }
  };

  const isValid = (): boolean =>
    name().trim().length > 0 &&
    name().trim().length <= 32 &&
    !props.existingTiers.some((t) => t.name.toLowerCase() === name().trim().toLowerCase()) &&
    HEADER_KEY_RE.test(headerKey().trim().toLowerCase()) &&
    !RESERVED_KEYS.has(headerKey().trim().toLowerCase()) &&
    headerValue().trim().length > 0 &&
    headerValue().trim().length <= 128 &&
    !props.existingTiers.some(
      (t) =>
        t.header_key === headerKey().trim().toLowerCase() &&
        t.header_value === headerValue().trim(),
    );

  const submit = async (): Promise<void> => {
    setTriedSubmit(true);
    if (!isValid() || submitting()) return;
    setSubmitting(true);
    try {
      const created = await createHeaderTier(props.agentName, {
        name: name().trim(),
        header_key: headerKey().trim().toLowerCase(),
        header_value: headerValue().trim(),
        badge_color: badgeColor(),
      });
      props.onCreated(created);
      props.onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tier');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="header-tier-modal-backdrop" onClick={props.onClose}>
      <div class="header-tier-modal" onClick={(e) => e.stopPropagation()}>
        <header class="header-tier-modal__header">
          <h2>Create custom tier</h2>
          <button
            type="button"
            class="header-tier-modal__close"
            onClick={props.onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div class="header-tier-modal__body">
          <label class="header-tier-modal__field">
            <span class="header-tier-modal__label">Tier name</span>
            <input
              class="header-tier-modal__input"
              classList={{ 'header-tier-modal__input--invalid': nameError() !== undefined }}
              type="text"
              value={name()}
              placeholder="Premium Users"
              maxlength="32"
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <Show when={nameError()}>
              <div class="header-tier-modal__error">{nameError()}</div>
            </Show>
          </label>

          <label class="header-tier-modal__field">
            <span class="header-tier-modal__label">Header key</span>
            <HeaderComboBox
              value={headerKey()}
              onInput={setHeaderKey}
              suggestions={keySuggestions()}
              placeholder="x-manifest-tier"
              invalid={keyError() !== undefined}
              errorMessage={keyError()}
              freeFormHint={`Use "${headerKey().trim()}" as a custom header`}
            />
          </label>

          <label class="header-tier-modal__field">
            <span class="header-tier-modal__label">Header value</span>
            <HeaderComboBox
              value={headerValue()}
              onInput={setHeaderValue}
              suggestions={valueSuggestions()}
              placeholder="premium"
              invalid={valueError() !== undefined}
              errorMessage={valueError()}
              disabled={!headerKey().trim()}
              freeFormHint={`Use "${headerValue().trim()}" as a custom value`}
            />
          </label>

          <div class="header-tier-modal__field">
            <span class="header-tier-modal__label">Badge color</span>
            <div class="header-tier-modal__swatches" role="radiogroup" aria-label="Badge color">
              <For each={TIER_COLORS}>
                {(c) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={badgeColor() === c}
                    aria-label={c}
                    class="header-tier-modal__swatch"
                    classList={{
                      [`header-tier-modal__swatch--${c}`]: true,
                      'header-tier-modal__swatch--active': badgeColor() === c,
                    }}
                    onClick={() => setBadgeColor(c)}
                  />
                )}
              </For>
            </div>
          </div>
        </div>

        <footer class="header-tier-modal__footer">
          <button
            type="button"
            class="header-tier-modal__btn header-tier-modal__btn--ghost"
            onClick={props.onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            class="header-tier-modal__btn header-tier-modal__btn--primary"
            disabled={submitting()}
            onClick={submit}
          >
            {submitting() ? 'Creating…' : 'Create tier'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CreateHeaderTierModal;

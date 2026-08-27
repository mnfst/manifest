import { createEffect, createResource, createSignal, For, Show, type Component } from 'solid-js';
import {
  bulkCopySettings,
  countSelection,
  listAgents,
  type BulkResult,
  type BulkSelection,
  type CopySettingsOptions,
} from '../services/api/teams.js';
import { toast } from '../services/toast-store.js';
import Select from './Select.jsx';

interface CopySettingsModalProps {
  open: boolean;
  selection: BulkSelection;
  selectedCount: number;
  onClose: () => void;
  onApplied: (result: BulkResult) => void;
}

const COPY_CHOICES: Array<{ key: keyof CopySettingsOptions; label: string; desc: string }> = [
  {
    key: 'providers_and_models',
    label: 'Providers and models',
    desc: 'Provider connections and per-model access, key included',
  },
  { key: 'routing', label: 'Routing', desc: 'Default route and fallbacks, custom header tiers' },
  { key: 'limits', label: 'Limits', desc: 'Spend and token limits' },
];

const STEP_TITLES = ['Source', 'What to copy', 'Confirm'];

/**
 * Copy settings from an agent onto the selection, in three deliberate steps:
 * pick the source, choose what to copy, confirm the count. This action can
 * rewrite a thousand configurations at once, so the count is stated in the
 * button.
 */
const CopySettingsModal: Component<CopySettingsModalProps> = (props) => {
  const [step, setStep] = createSignal(1);
  const [source, setSource] = createSignal('');
  const [copy, setCopy] = createSignal<CopySettingsOptions>({
    providers_and_models: true,
    routing: false,
    limits: false,
  });
  const [applying, setApplying] = createSignal(false);

  createEffect(() => {
    if (props.open) {
      setStep(1);
      setSource('');
      setCopy({ providers_and_models: true, routing: false, limits: false });
    }
  });

  const [agents] = createResource(
    () => props.open,
    async (open) => {
      if (!open) return [];
      try {
        return (await listAgents({ page_size: 1000 })).agents;
      } catch {
        return [];
      }
    },
  );

  const [count] = createResource(
    () => (props.open && step() === 3 ? props.selection : null),
    async (selection) => {
      try {
        return await countSelection(selection);
      } catch {
        return props.selectedCount;
      }
    },
  );

  const anyCopy = () => COPY_CHOICES.some((c) => copy()[c.key]);
  const copied = () => COPY_CHOICES.filter((c) => copy()[c.key]);
  const untouched = () => COPY_CHOICES.filter((c) => !copy()[c.key]);
  const listNames = (items: typeof COPY_CHOICES) =>
    items.map((c) => c.label.toLowerCase()).join(', ');

  const apply = async () => {
    setApplying(true);
    try {
      const result = await bulkCopySettings(props.selection, source(), copy());
      props.onApplied(result);
    } catch {
      toast.error("Couldn't copy the settings onto the selected agents.");
    } finally {
      setApplying(false);
    }
  };

  const sourceLabel = () =>
    agents()?.find((a) => a.agent_name === source())?.display_name ?? source();

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.onClose();
        }}
      >
        <div
          class="modal-card"
          style="max-width: 520px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="copy-settings-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="copy-settings-title">
            {step() === 3 ? `Apply ${sourceLabel()}'s setup` : 'Copy settings from an agent'}
          </h2>
          <div class="step-indicator">
            Step {step()} of 3 · {STEP_TITLES[step() - 1]}
          </div>

          <Show when={step() === 1}>
            <div class="field">
              <label class="modal-card__field-label">Source agent</label>
              <Select
                value={source()}
                onChange={setSource}
                label="Source agent"
                placeholder="Pick an agent"
                options={(agents() ?? []).map((a) => ({
                  label: a.display_name,
                  value: a.agent_name,
                  description: a.owner ? a.owner.name : 'No owner',
                }))}
              />
              <span class="field__hint">
                Its configuration is copied onto the {props.selectedCount} selected agent
                {props.selectedCount === 1 ? '' : 's'}.
              </span>
            </div>
          </Show>

          <Show when={step() === 2}>
            <div class="choice-list">
              <For each={COPY_CHOICES}>
                {(choice) => (
                  <label
                    class="choice-list__item"
                    classList={{ 'choice-list__item--on': copy()[choice.key] }}
                  >
                    <input
                      type="checkbox"
                      checked={copy()[choice.key]}
                      onChange={(e) =>
                        setCopy({ ...copy(), [choice.key]: e.currentTarget.checked })
                      }
                    />
                    <span>
                      <div>{choice.label}</div>
                      <div class="choice-list__desc">{choice.desc}</div>
                    </span>
                  </label>
                )}
              </For>
            </div>
            <Show when={!anyCopy()}>
              <span class="field__error">Choose at least one thing to copy.</span>
            </Show>
          </Show>

          <Show when={step() === 3}>
            <div class="field">
              <span class="field__hint">What gets copied</span>
              <div class="entity-header__chips">
                <For each={COPY_CHOICES}>
                  {(choice) => (
                    <span class="chip" classList={{ 'filter-checkbox--on': copy()[choice.key] }}>
                      {choice.label}
                    </span>
                  )}
                </For>
              </div>
            </div>
            <div class="field">
              <span class="field__hint">Who receives it</span>
              <span class="chip filter-checkbox--on">
                {props.selectedCount} selected agent{props.selectedCount === 1 ? '' : 's'}
              </span>
            </div>
            <Show
              when={!count.loading}
              fallback={
                <div class="confirm-box">
                  <span class="spinner" /> Counting agents…
                </div>
              }
            >
              <div class="confirm-box">
                <b class="confirm-box__strong">
                  {count() ?? props.selectedCount} agent
                  {(count() ?? props.selectedCount) === 1 ? '' : 's'} will change.
                </b>{' '}
                Their current {listNames(copied())} settings will be replaced.
                <Show when={untouched().length > 0}>
                  {' '}
                  {untouched()
                    .map((c) => c.label)
                    .join(' and ')}{' '}
                  left untouched.
                </Show>
              </div>
            </Show>
          </Show>

          <div class="modal-card__footer">
            <Show
              when={step() > 1}
              fallback={
                <button type="button" class="btn btn--ghost btn--sm" onClick={props.onClose}>
                  Cancel
                </button>
              }
            >
              <button
                type="button"
                class="btn btn--ghost btn--sm"
                onClick={() => setStep(step() - 1)}
                disabled={applying()}
              >
                Back
              </button>
            </Show>
            <Show
              when={step() < 3}
              fallback={
                <button
                  type="button"
                  class="btn btn--primary btn--sm"
                  disabled={applying() || count.loading}
                  onClick={() => void apply()}
                >
                  {applying() ? (
                    <span class="spinner" />
                  ) : (
                    `Apply to ${count() ?? props.selectedCount} agent${(count() ?? props.selectedCount) === 1 ? '' : 's'}`
                  )}
                </button>
              }
            >
              <button
                type="button"
                class="btn btn--primary btn--sm"
                disabled={(step() === 1 && !source()) || (step() === 2 && !anyCopy())}
                onClick={() => setStep(step() + 1)}
              >
                Next
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default CopySettingsModal;

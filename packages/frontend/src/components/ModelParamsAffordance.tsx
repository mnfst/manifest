import { createSignal, Show, type Component } from 'solid-js';
import { providerThinkingDefault } from 'manifest-shared';
import type { AuthType, RequestParamDefaults } from '../services/api.js';
import ModelParamsDialog from './ModelParamsDialog.jsx';

interface Props {
  /** Provider id of the route this affordance controls (e.g. `deepseek`). */
  provider: string | undefined;
  /** Auth type of the route. */
  authType: AuthType | undefined;
  /** Model name of the route. */
  model: string;
  /** Display label for the dialog header (e.g. "deepseek-v4-flash"). */
  slotLabel: string;
  /**
   * Read the currently-saved params for this route from the parent's loaded
   * map. Called on every render so reactivity flows through the parent's
   * signal — saving in one slot updates the badge on every other slot that
   * resolves to the same `(provider, authType, model)` tuple.
   */
  getParams: (provider: string, authType: AuthType, model: string) => RequestParamDefaults | null;
  /**
   * Persist the new params for this route. The dialog passes `null` when the
   * chosen value matches the provider's natural default — the parent should
   * call DELETE on the API in that case to keep the table clean. The parent
   * is also responsible for updating its in-memory map so the next render
   * reflects the new value.
   */
  setParams: (
    provider: string,
    authType: AuthType,
    model: string,
    params: RequestParamDefaults | null,
  ) => Promise<unknown>;
  /**
   * Disable the button (e.g. while the slot is being mutated by an unrelated
   * action and we don't want to race the cache).
   */
  disabled?: boolean;
}

/**
 * Per-model "Parameters" affordance: a small gear/sliders button next to a
 * model row that opens the curated parameters dialog. Visibility is driven
 * by the route's provider — only providers Manifest knows how to talk about
 * (today: DeepSeek's `thinking`) render the button at all.
 *
 * The component is intentionally dumb about persistence: it does not own
 * fetch or cache state. The parent (`Routing.tsx`) fetches the agent's full
 * model-params map once on page boot and threads `getParams` / `setParams`
 * down, so every model row across every routing surface stays in sync from
 * a single source of truth.
 */
const ModelParamsAffordance: Component<Props> = (props) => {
  const [dialogOpen, setDialogOpen] = createSignal(false);

  const supports = () =>
    props.provider !== undefined && providerThinkingDefault(props.provider) !== undefined;

  const current = () => {
    if (!props.provider || !props.authType) return null;
    return props.getParams(props.provider, props.authType, props.model);
  };

  const configured = () => current() !== null;

  return (
    <Show when={supports() && props.authType}>
      <button
        type="button"
        class="routing-card__chip-action"
        classList={{ 'routing-card__chip-action--configured': configured() }}
        onClick={(e) => {
          e.stopPropagation();
          setDialogOpen(true);
        }}
        disabled={props.disabled}
        aria-label={`Configure model parameters for ${props.slotLabel}`}
        title="Model parameters"
      >
        <span class="routing-tooltip">Parameters</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      </button>
      <Show when={dialogOpen() && props.provider && props.authType}>
        <ModelParamsDialog
          open={dialogOpen()}
          slotLabel={props.slotLabel}
          current={current()}
          providerDefault={providerThinkingDefault(props.provider!) ?? 'enabled'}
          onSave={(next) => props.setParams(props.provider!, props.authType!, props.model, next)}
          onClose={() => setDialogOpen(false)}
        />
      </Show>
    </Show>
  );
};

export default ModelParamsAffordance;

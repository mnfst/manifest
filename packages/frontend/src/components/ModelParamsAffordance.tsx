import { createSignal, Show, type Component } from 'solid-js';
import { getProviderParamSpecs, type ProviderParamSpecRegistry } from 'manifest-shared';
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
  /** Route-scope key (tier/default, task-specific category, or header tier). */
  scope: string;
  /** Backend-loaded provider param registry. */
  specRegistry: ProviderParamSpecRegistry;
  /**
   * Read the currently-saved params for this route from the parent's loaded
   * map. Called on every render so reactivity flows through the parent's
   * signal — saving in one slot updates only rows with the same scoped
   * `(provider, authType, model)` tuple.
   */
  getParams: (
    scope: string,
    provider: string,
    authType: AuthType,
    model: string,
  ) => RequestParamDefaults | null;
  /**
   * Persist the new params for this route. The dialog passes `null` when the
   * chosen value matches the provider's natural default — the parent should
   * call DELETE on the API in that case to keep the table clean. The parent
   * is also responsible for updating its in-memory map so the next render
   * reflects the new value.
   */
  setParams: (
    scope: string,
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
 * by the route's provider/auth/model tuple — only routes with DB-backed
 * specs render the button at all.
 *
 * The component is intentionally dumb about persistence: it does not own
 * fetch or cache state. The parent (`Routing.tsx`) fetches the agent's full
 * model-params map once on page boot and threads `getParams` / `setParams`
 * down, so every scoped model row stays in sync from a single source of
 * truth without leaking values across tiers.
 */
const ModelParamsAffordance: Component<Props> = (props) => {
  const [dialogOpen, setDialogOpen] = createSignal(false);

  const specs = () =>
    getProviderParamSpecs(props.specRegistry, props.provider, props.authType, props.model);
  const supports = () => props.provider !== undefined && specs().length > 0;

  const current = () => {
    if (!props.provider || !props.authType) return null;
    return props.getParams(props.scope, props.provider, props.authType, props.model);
  };

  const configured = () => current() !== null;

  return (
    <Show when={supports() && props.authType}>
      <button
        type="button"
        class="routing-card__chip-action"
        classList={{
          'routing-card__chip-action--configured': configured(),
          'routing-card__chip-action--dialog-open': dialogOpen(),
        }}
        onClick={(e) => {
          e.stopPropagation();
          setDialogOpen(true);
        }}
        disabled={props.disabled}
        aria-label={`Configure model parameters for ${props.slotLabel}`}
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
          specs={specs()}
          onSave={(next) =>
            props.setParams(props.scope, props.provider!, props.authType!, props.model, next)
          }
          onClose={() => setDialogOpen(false)}
        />
      </Show>
    </Show>
  );
};

export default ModelParamsAffordance;

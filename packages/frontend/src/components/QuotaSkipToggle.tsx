import { Show, type Component } from 'solid-js';
import { supportsQuotaCheck } from 'manifest-shared';
import type { ModelRoute } from '../services/api.js';

interface QuotaSkipToggleProps {
  route: ModelRoute | null | undefined;
  /** Used in the aria-label, mirroring ModelParamsAffordance's slotLabel. */
  modelLabel: string;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
}

/**
 * Compact per-route "Skip on quota exhaustion" icon-button toggle, styled like
 * the params affordance (chip-action button + tooltip, success-colored when
 * active). Renders only for subscription routes whose provider exposes a
 * usage/quota endpoint — everywhere else the flag would be inert, so the
 * control stays hidden.
 */
const QuotaSkipToggle: Component<QuotaSkipToggleProps> = (props) => {
  const visible = () =>
    !!props.route &&
    props.route.authType === 'subscription' &&
    supportsQuotaCheck(props.route.provider);
  const enabled = () => props.route?.skipWhenQuotaExhausted === true;
  return (
    <Show when={visible()}>
      <button
        type="button"
        class="routing-card__chip-action"
        classList={{ 'routing-card__chip-action--configured': enabled() }}
        onClick={(e) => {
          // Rows/chips are clickable (model picker) or draggable — never let
          // the toggle's click bubble up to them.
          e.stopPropagation();
          props.onToggle(!enabled());
        }}
        disabled={props.disabled}
        aria-pressed={enabled()}
        aria-label={`Toggle skip-on-quota-exhaustion for ${props.modelLabel}`}
      >
        <span class="routing-tooltip">Skip on quota exhaustion</span>
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
          <path d="m12 14 4-4" />
          <path d="M3.34 19a10 10 0 1 1 17.32 0" />
        </svg>
      </button>
    </Show>
  );
};

export default QuotaSkipToggle;

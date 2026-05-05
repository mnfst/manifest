import {
  createResource,
  createSignal,
  createEffect,
  untrack,
  Show,
  onCleanup,
  type Component,
} from 'solid-js';
import { getSavings, getSavingsTimeseries } from '../services/api/analytics.js';
import type { SavingsTimeseriesRow } from '../services/api/analytics.js';

interface SavingsCardProps {
  agentName: string;
  range: string;
  ping: number;
  onOpenExplainer: () => void;
  onData: (saved: number | null, pct: number | null) => void;
  onTimeseriesData: (data: SavingsTimeseriesRow[]) => void;
}

const TOOLTIP_HIDE_DELAY = 250;

const SavingsCard: Component<SavingsCardProps> = (props) => {
  const [savings] = createResource(
    () => ({
      range: props.range,
      agent: props.agentName,
      _ping: props.ping,
    }),
    (p) => getSavings(p.range, p.agent).catch(() => null),
  );

  const [timeseries] = createResource(
    () => ({
      range: props.range,
      agent: props.agentName,
      _ping: props.ping,
    }),
    (p) => getSavingsTimeseries(p.range, p.agent).catch(() => []),
  );

  const hasSavingsData = () => {
    const d = savings();
    if (!d || savings.loading) return false;
    return d.is_auto || !!d.baseline_model;
  };

  createEffect(() => {
    const has = hasSavingsData();
    const d = savings();
    untrack(() => {
      if (!has || !d) {
        props.onData(null, null);
      } else {
        props.onData(d.total_saved, d.savings_pct);
      }
    });
  });

  createEffect(() => {
    const data = timeseries();
    if (data) {
      untrack(() => props.onTimeseriesData(data));
    }
  });

  /* ── Tooltip hover logic ── */
  const [tooltipVisible, setTooltipVisible] = createSignal(false);
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const showTooltip = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = undefined;
    }
    setTooltipVisible(true);
  };

  const scheduleHide = () => {
    hideTimer = setTimeout(() => setTooltipVisible(false), TOOLTIP_HIDE_DELAY);
  };

  const handleMoreDetails = (e: MouseEvent) => {
    e.preventDefault();
    setTooltipVisible(false);
    props.onOpenExplainer();
  };

  onCleanup(() => {
    if (hideTimer) clearTimeout(hideTimer);
  });

  return (
    <Show when={hasSavingsData()}>
      <span
        class="savings-controls__info-wrap"
        onMouseEnter={showTooltip}
        onMouseLeave={scheduleHide}
      >
        <svg
          class="info-tooltip__icon"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <Show when={tooltipVisible()}>
          <div class="savings-tooltip" onMouseEnter={showTooltip} onMouseLeave={scheduleHide}>
            <p class="savings-tooltip__text">
              We calculate savings by comparing your actual cost to what the request would have cost
              on the most expensive model in your routing setup.
            </p>
            <a href="#" class="savings-tooltip__link" onClick={handleMoreDetails}>
              More details
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M9.29 16.71c.2.2.45.29.71.29s.51-.1.71-.29l4-4a.996.996 0 0 0 0-1.41l-4-4A.996.996 0 1 0 9.3 8.71L12.59 12 9.3 15.29a.996.996 0 0 0 0 1.41Z" />
              </svg>
            </a>
          </div>
        </Show>
      </span>
    </Show>
  );
};

export default SavingsCard;

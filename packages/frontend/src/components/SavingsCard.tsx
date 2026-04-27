import {
  createResource,
  createSignal,
  createEffect,
  untrack,
  Show,
  onCleanup,
  type Component,
  type JSX,
} from 'solid-js';
import Select from './Select.jsx';
import { getSavings, getBaselineCandidates } from '../services/api/analytics.js';

interface SavingsCardProps {
  agentName: string;
  range: string;
  ping: number;
  onOpenExplainer: (baselineModelName: string | null) => void;
  onData: (saved: number | null, pct: number | null) => void;
  children?: JSX.Element;
}

const STORAGE_KEY_PREFIX = 'manifest_savings_baseline_';
const TOOLTIP_HIDE_DELAY = 250;

const SavingsCard: Component<SavingsCardProps> = (props) => {
  const storageKey = () => `${STORAGE_KEY_PREFIX}${props.agentName}`;

  const [baselineOverride, setBaselineOverride] = createSignal<string | null>(
    localStorage.getItem(storageKey()),
  );

  const [savings, { refetch }] = createResource(
    () => ({
      range: props.range,
      agent: props.agentName,
      _ping: props.ping,
      baseline: baselineOverride(),
    }),
    (p) => getSavings(p.range, p.agent, p.baseline ?? undefined).catch(() => null),
  );

  const [candidates] = createResource(
    () => props.agentName,
    (name) =>
      getBaselineCandidates(name).catch(
        () => [] as Awaited<ReturnType<typeof getBaselineCandidates>>,
      ),
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

  const baselineOptions = () => {
    const list: Array<{ label: string; value: string }> = [
      { label: 'Auto (per-request baseline)', value: '__auto__' },
    ];
    const items = candidates();
    if (items) {
      for (const c of items) {
        list.push({
          label: `${c.display_name} ($${c.price_per_million.toFixed(2)}/M)`,
          value: c.id,
        });
      }
    }
    return list;
  };

  const currentBaselineValue = () => {
    return baselineOverride() ?? '__auto__';
  };

  const displayValue = () => {
    const d = savings();
    if (d?.is_auto) return 'Auto';
    return d?.baseline_model?.display_name ?? undefined;
  };

  const handleBaselineChange = (value: string) => {
    if (value === '__auto__') {
      localStorage.removeItem(storageKey());
      setBaselineOverride(null);
    } else {
      localStorage.setItem(storageKey(), value);
      setBaselineOverride(value);
    }
  };

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
    props.onOpenExplainer(savings()?.baseline_model?.display_name ?? null);
  };

  onCleanup(() => {
    if (hideTimer) clearTimeout(hideTimer);
  });

  return (
    <Show when={hasSavingsData()}>
      <span class="savings-controls__vs">vs</span>
      <Select
        value={currentBaselineValue()}
        onChange={handleBaselineChange}
        options={baselineOptions()}
        label="Baseline model"
        displayValue={displayValue()}
      />
      <span
        class="savings-controls__info-wrap"
        onMouseEnter={showTooltip}
        onMouseLeave={scheduleHide}
      >
        <button
          class="savings-controls__info-btn"
          type="button"
          aria-label="How savings are calculated"
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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
        <Show when={tooltipVisible()}>
          <div class="savings-tooltip" onMouseEnter={showTooltip} onMouseLeave={scheduleHide}>
            <p class="savings-tooltip__text">
              Savings compare what you paid against what your most expensive model (at API key
              rates) would have cost for the same request.
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

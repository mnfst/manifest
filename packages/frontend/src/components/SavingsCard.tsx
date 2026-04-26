import {
  createResource,
  createSignal,
  createEffect,
  untrack,
  Show,
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
      <button
        class="savings-controls__info-btn"
        onClick={() => props.onOpenExplainer(savings()?.baseline_model?.display_name ?? null)}
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
    </Show>
  );
};

export default SavingsCard;

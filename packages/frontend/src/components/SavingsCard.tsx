import {
  createResource,
  createSignal,
  createEffect,
  Show,
  type Component,
  type JSX,
} from 'solid-js';
import Select from './Select.jsx';
import { getSavings, getBaselineCandidates, updateBaseline } from '../services/api/analytics.js';
import { toast } from '../services/toast-store.js';

interface SavingsCardProps {
  agentName: string;
  range: string;
  ping: number;
  onOpenExplainer: (baselineModelName: string | null) => void;
  onData: (saved: number | null, pct: number | null) => void;
  children?: JSX.Element;
}

const SavingsCard: Component<SavingsCardProps> = (props) => {
  const [savings, { refetch, mutate }] = createResource(
    () => ({ range: props.range, agent: props.agentName, _ping: props.ping }),
    (p) => getSavings(p.range, p.agent),
  );

  const [candidates] = createResource(
    () => props.agentName,
    (name) => getBaselineCandidates(name),
  );

  const [updating, setUpdating] = createSignal(false);

  createEffect(() => {
    const d = savings();
    if (!d?.baseline_model || savings.loading || updating()) {
      props.onData(null, null);
      return;
    }
    props.onData(d.total_saved, d.savings_pct);
  });

  const baselineOptions = () => {
    const list: Array<{ label: string; value: string }> = [
      { label: 'Auto (cheapest that covers all tiers)', value: '__auto__' },
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
    const d = savings();
    if (!d?.baseline_model) return '__auto__';
    const items = candidates();
    if (items?.some((c) => c.is_current && c.id !== d.baseline_model!.id)) {
      return '__auto__';
    }
    return d.baseline_model.id;
  };

  const handleBaselineChange = async (value: string) => {
    const modelId = value === '__auto__' ? null : value;
    setUpdating(true);
    try {
      const result = await updateBaseline(props.agentName, modelId);
      mutate(result);
    } catch {
      toast.error('Failed to update baseline model');
      refetch();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Show when={!savings.error && savings()?.baseline_model}>
      <span class="savings-controls__vs">vs</span>
      <Select
        value={currentBaselineValue()}
        onChange={handleBaselineChange}
        options={baselineOptions()}
        label="Baseline model"
        displayValue={savings()?.baseline_model?.display_name ?? undefined}
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

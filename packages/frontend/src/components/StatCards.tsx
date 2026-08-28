import { For, Show, type Component } from 'solid-js';
import '../styles/analytics-overview.css';

export interface StatCardItem {
  label: string;
  value: string;
  /** Percentage change versus the previous period; omitted when unknown. */
  trendPct?: number;
}

interface StatCardsProps {
  items: StatCardItem[];
}

const trendLabel = (pct: number) => {
  const clamped = Math.max(-999, Math.min(999, Math.round(pct)));
  return `${clamped > 0 ? '+' : ''}${clamped}%`;
};

/** KPI row built on the Overview's `.overview-stat-card`. */
const StatCards: Component<StatCardsProps> = (props) => (
  <div class="overview-stats">
    <For each={props.items}>
      {(item) => (
        <div class="overview-stat-card">
          <span class="overview-stat-card__label">{item.label}</span>
          <span class="overview-stat-card__value-row">
            <span class="overview-stat-card__value">{item.value}</span>
            <Show when={item.trendPct != null && Math.round(item.trendPct) !== 0}>
              <span class="trend trend--neutral">{trendLabel(item.trendPct!)}</span>
            </Show>
          </span>
        </div>
      )}
    </For>
  </div>
);

export default StatCards;

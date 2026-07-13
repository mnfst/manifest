import { Show, type Component } from 'solid-js';
import { formatNumber } from '../services/formatters.js';
import type { AutofixStats } from '../services/api/analytics.js';

function fmtPct(v: number): string {
  const pct = v * 100;
  return pct === 100 || pct === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
}

export interface AutofixKpiCardsProps {
  stats: AutofixStats | undefined;
}

const AutofixKpiCards: Component<AutofixKpiCardsProps> = (props) => {
  return (
    <Show when={props.stats}>
      {(s) => (
        <div class="afx-kpi-line">
          <span class="afx-kpi-line__primary">{fmtPct(s().success_rate.value)} success rate</span>
          <span class="afx-kpi-line__sep">&middot;</span>
          <span class="afx-kpi-line__stat">{formatNumber(s().errors_remaining.value)} failed</span>
          <span class="afx-kpi-line__sep">&middot;</span>
          <span class="afx-kpi-line__stat">{formatNumber(s().autofix_saves.value)} auto-fixed</span>
        </div>
      )}
    </Show>
  );
};

export default AutofixKpiCards;

import { For, Show, type Component } from 'solid-js';
import StatCards from '../components/StatCards.jsx';
import CostBarChart from '../components/CostBarChart.jsx';
import Avatar from '../components/Avatar.jsx';
import { formatNumber } from '../services/formatters.js';
import { currentMonthLabel, formatMoney } from '../services/teams-utils.js';
import { useProjectDetail } from './ProjectDetail.jsx';

/** "1 Aug" style label for an ISO date. */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}`;
}

/** First, middle and last day labels for a daily series. */
export function axisLabels(dates: string[]): string[] {
  if (dates.length === 0) return [];
  if (dates.length === 1) return [dayLabel(dates[0]!)];
  const mid = dates[Math.floor(dates.length / 2)]!;
  return [dayLabel(dates[0]!), dayLabel(mid), dayLabel(dates[dates.length - 1]!)];
}

/** Charts first, then the breakdown that sits behind an invoice line. */
const ProjectOverview: Component = () => {
  const { overview } = useProjectDetail();

  return (
    <Show
      when={overview()}
      fallback={
        <Show
          when={overview.loading}
          fallback={<p class="field__hint">Overview unavailable for this project.</p>}
        >
          <div class="skeleton skeleton--rect" style="width: 100%; height: 200px;" />
        </Show>
      }
    >
      <StatCards
        items={[
          {
            label: 'Cost this month',
            value: formatMoney(overview()!.cost_month_usd),
            trendPct: overview()!.cost_trend_pct,
          },
          { label: 'Last month', value: formatMoney(overview()!.cost_last_month_usd) },
          { label: 'Requests', value: formatNumber(overview()!.requests) },
          { label: 'Token usage', value: formatNumber(overview()!.tokens) },
        ]}
      />

      <div class="panel">
        <div class="panel__title">Cost</div>
        <span class="who__sub">{currentMonthLabel()}, all agents on this project</span>
        <Show when={overview()!.spend_shared}>
          <p class="field__hint" style="margin-top: var(--gap-xs);">
            Some agents here also carry other projects. Their cost is counted in each project. Don't
            invoice from this figure without checking.
          </p>
        </Show>
        <CostBarChart
          values={overview()!.cost_series.map((p) => p.cost_usd)}
          labels={axisLabels(overview()!.cost_series.map((p) => p.date))}
          format={formatMoney}
          ariaLabel="Daily cost this month"
        />
      </div>

      <div class="detail-grid">
        <div class="panel">
          <div class="panel__title">Cost by owner</div>
          <span class="who__sub">The breakdown behind an invoice line.</span>
          <Show
            when={overview()!.cost_by_owner.length > 0}
            fallback={
              <p class="field__hint" style="margin-top: var(--gap-sm);">
                No cost yet this month.
              </p>
            }
          >
            <table class="data-table" style="margin-top: var(--gap-sm);">
              <tbody>
                <For each={overview()!.cost_by_owner}>
                  {(row) => (
                    <tr>
                      <td>
                        <Show when={row.owner} fallback={<span class="pill-muted">No owner</span>}>
                          <span class="who">
                            <Avatar name={row.owner!.name} size="sm" />
                            <span>{row.owner!.name}</span>
                          </span>
                        </Show>
                      </td>
                      <td class="num" style="text-align: right;">
                        {formatMoney(row.cost_usd)}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
        </div>
        <div class="panel">
          <div class="panel__title">Token usage</div>
          <span class="who__sub">{currentMonthLabel()}</span>
          <CostBarChart
            values={overview()!.tokens_series.map((p) => p.tokens)}
            labels={axisLabels(overview()!.tokens_series.map((p) => p.date))}
            color="hsl(var(--chart-1))"
            format={formatNumber}
            ariaLabel="Daily token usage this month"
          />
        </div>
      </div>
    </Show>
  );
};

export default ProjectOverview;

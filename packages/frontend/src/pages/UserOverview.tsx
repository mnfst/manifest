import { A } from '@solidjs/router';
import { For, Show, type Component } from 'solid-js';
import { platformIcon } from 'manifest-shared';
import StatCards from '../components/StatCards.jsx';
import CostBarChart from '../components/CostBarChart.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { formatCost, formatNumber } from '../services/formatters.js';
import { budgetLabel, budgetState, formatMoney } from '../services/teams-utils.js';
import { agentPath, userPath } from '../services/routing.js';
import { useUserDetail } from './UserDetail.jsx';

/** "2026-08-01" → "1 Aug" */
export function shortDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}`;
}

export function axisLabels(dates: string[]): string[] {
  if (dates.length === 0) return [];
  if (dates.length < 3) return dates.map(shortDay);
  return [dates[0]!, dates[Math.floor(dates.length / 2)]!, dates[dates.length - 1]!].map(shortDay);
}

/**
 * A user's overview, built like an agent overview: cost this month, budget
 * left, requests and token usage, a cost chart against the budget, then their
 * agents.
 */
const UserOverview: Component = () => {
  const { user, overview, userId, refetchOverview } = useUserDetail();

  // Reading an errored resource throws; the error branch below never reads it.
  const loaded = () => (overview.error ? undefined : overview());
  const budget = () => loaded()?.budget_usd ?? null;
  const spend = () => loaded()?.cost_month_usd ?? 0;
  const state = () => budgetState(spend(), budget());
  const via = () => [
    { label: 'Users', href: '/users' },
    { label: user()?.name ?? '', href: userPath(userId()) },
  ];

  return (
    <Show
      when={!overview.error}
      fallback={
        <ErrorState
          error={overview.error}
          title="Couldn't load this overview"
          onRetry={refetchOverview}
        />
      }
    >
      <Show
        when={!overview.error && overview()}
        fallback={
          <div class="overview-stats">
            <For each={[1, 2, 3, 4]}>
              {() => (
                <div class="overview-stat-card">
                  <div class="skeleton skeleton--text" style="width: 60%; height: 12px;" />
                  <div class="skeleton skeleton--text" style="width: 40%; height: 28px;" />
                </div>
              )}
            </For>
          </div>
        }
      >
        <StatCards
          items={[
            {
              label: 'Cost this month',
              value: formatMoney(overview()!.cost_month_usd),
              trendPct: overview()!.cost_trend_pct,
            },
            {
              label: 'Budget left',
              value: budgetLabel(spend(), budget()) ?? 'No budget',
              tone: state().tone === 'over' ? 'over' : state().tone === 'warn' ? 'warn' : undefined,
            },
            { label: 'Requests', value: formatNumber(overview()!.requests) },
            { label: 'Token usage', value: formatNumber(overview()!.tokens) },
          ]}
        />

        <div class="panel">
          <div class="panel__title">Cost</div>
          <span class="who__sub">
            {budget() != null ? `Against a $${budget()} monthly budget` : 'This month'}
          </span>
          <CostBarChart
            values={overview()!.cost_series.map((p) => p.cost_usd)}
            labels={axisLabels(overview()!.cost_series.map((p) => p.date))}
            budget={budget()}
            format={formatMoney}
            ariaLabel="Daily cost this month"
          />
        </div>

        <div class="panel" style="padding: 0;">
          <div class="panel__title" style="padding: var(--gap-lg) var(--gap-lg) 0;">
            Their agents
          </div>
          <Show
            when={overview()!.agents.length > 0}
            fallback={
              <div class="empty-state">
                <div class="empty-state__title">No agents yet</div>
                <p>Create an agent from the Agents tab and it will show up here.</p>
              </div>
            }
          >
            <div class="data-table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Projects</th>
                    <th>Requests</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={overview()!.agents}>
                    {(agent) => (
                      <tr>
                        <td>
                          <A
                            href={agentPath(agent.agent_name, '')}
                            state={{ via: via() }}
                            class="who"
                            style="text-decoration: none;"
                          >
                            <Show when={platformIcon(agent.agent_platform, agent.agent_category)}>
                              <img
                                src={platformIcon(agent.agent_platform, agent.agent_category)}
                                alt=""
                                class="who__icon"
                              />
                            </Show>
                            <span class="who__name">{agent.display_name}</span>
                            <Show when={agent.archived_at}>
                              <span class="status-badge status-badge--neutral">Archived</span>
                            </Show>
                          </A>
                        </td>
                        <td>
                          <span class="tag-list">
                            <Show
                              when={agent.projects.length > 0}
                              fallback={<span class="project-tag project-tag--muted">None</span>}
                            >
                              <For each={agent.projects}>
                                {(project) => <span class="project-tag">{project.name}</span>}
                              </For>
                            </Show>
                          </span>
                        </td>
                        <td class="num">{formatNumber(agent.request_count)}</td>
                        <td class="num">{formatCost(agent.spend_30d_usd)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
      </Show>
    </Show>
  );
};

export default UserOverview;

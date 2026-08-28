import { A } from '@solidjs/router';
import { For, Show, type Component } from 'solid-js';
import Avatar from '../components/Avatar.jsx';
import BudgetMeter from '../components/BudgetMeter.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { formatCost } from '../services/formatters.js';
import { userPath } from '../services/routing.js';
import { useProjectDetail } from './ProjectDetail.jsx';

/** The users owning at least one agent on this project. */
const ProjectUsers: Component = () => {
  const { overview, refetchOverview } = useProjectDetail();

  // Reading an errored resource throws; the error branch below never reads it.
  const loaded = () => (overview.error ? undefined : overview());

  const agentsOwnedBy = (userId: string) =>
    (loaded()?.agents ?? []).filter((a) => a.owner?.id === userId).length;

  return (
    <Show
      when={!overview.error}
      fallback={
        <ErrorState
          error={overview.error}
          title="Couldn't load this project's users"
          onRetry={refetchOverview}
        />
      }
    >
      <Show
        when={loaded()}
        fallback={
          <Show
            when={overview.loading}
            fallback={
              <div class="empty-state">
                <div class="empty-state__title">Overview unavailable</div>
                <p>The project's users could not be loaded.</p>
                <button
                  type="button"
                  class="btn btn--outline btn--sm"
                  style="margin-top: var(--gap-md);"
                  onClick={refetchOverview}
                >
                  Try again
                </button>
              </div>
            }
          >
            <div class="skeleton skeleton--rect" style="width: 100%; height: 120px;" />
          </Show>
        }
      >
        <Show
          when={loaded()!.users.length > 0}
          fallback={
            <div class="empty-state">
              <div class="empty-state__title">No users on this project</div>
              <p>Its agents have no owner.</p>
            </div>
          }
        >
          <div class="panel" style="padding: 0;">
            <div class="data-table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Agents on this project</th>
                    <th>Spend this month</th>
                    <th>Budget left</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={loaded()!.users}>
                    {(user) => (
                      <tr>
                        <td>
                          <A href={userPath(user.id)} class="who" style="text-decoration: none;">
                            <Avatar name={user.name} />
                            <span class="who__text">
                              <span class="who__name">{user.name}</span>
                              <Show when={user.role}>
                                <span class="who__sub">{user.role}</span>
                              </Show>
                            </span>
                          </A>
                        </td>
                        <td class="num">{agentsOwnedBy(user.id)}</td>
                        <td class="num">{formatCost(user.spend_month_usd) ?? '-'}</td>
                        <td>
                          <BudgetMeter
                            spend={user.spend_month_usd}
                            budget={user.monthly_budget_usd}
                          />
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </Show>
      </Show>
    </Show>
  );
};

export default ProjectUsers;

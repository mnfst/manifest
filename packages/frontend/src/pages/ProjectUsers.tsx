import { A } from '@solidjs/router';
import { For, Show, type Component } from 'solid-js';
import Avatar from '../components/Avatar.jsx';
import BudgetMeter from '../components/BudgetMeter.jsx';
import { formatCost } from '../services/formatters.js';
import { userPath } from '../services/routing.js';
import { useProjectDetail } from './ProjectDetail.jsx';

/** The users owning at least one agent on this project. */
const ProjectUsers: Component = () => {
  const { overview } = useProjectDetail();

  const agentsOwnedBy = (userId: string) =>
    (overview()?.agents ?? []).filter((a) => a.owner?.id === userId).length;

  return (
    <Show
      when={overview()}
      fallback={<div class="skeleton skeleton--rect" style="width: 100%; height: 120px;" />}
    >
      <Show
        when={overview()!.users.length > 0}
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
                <For each={overview()!.users}>
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
  );
};

export default ProjectUsers;

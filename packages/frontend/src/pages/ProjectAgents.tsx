import { A } from '@solidjs/router';
import { createSignal, For, Show, type Component } from 'solid-js';
import { platformIcon } from 'manifest-shared';
import Avatar from '../components/Avatar.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { setAgentProjects, type AgentRow } from '../services/api/teams.js';
import { formatCost } from '../services/formatters.js';
import { agentPath, projectPath } from '../services/routing.js';
import { toast } from '../services/toast-store.js';
import { lastUsedLabel, useProjectDetail } from './ProjectDetail.jsx';

/** The agents carrying this project, each removable from it. */
const ProjectAgents: Component = () => {
  const { overview, project, projectId, refetchOverview } = useProjectDetail();
  const [busy, setBusy] = createSignal<string | null>(null);

  const via = () => [
    { label: 'Projects', href: '/projects' },
    { label: project()?.name ?? projectId(), href: projectPath(projectId()) },
  ];

  const remove = async (agent: AgentRow) => {
    setBusy(agent.agent_name);
    try {
      await setAgentProjects(
        agent.agent_name,
        agent.projects.filter((p) => p.id !== projectId()).map((p) => p.id),
      );
      toast.success(`Removed ${agent.display_name} from ${project()?.name ?? 'this project'}`);
      refetchOverview();
    } catch {
      toast.error("Couldn't remove this agent from the project.");
    } finally {
      setBusy(null);
    }
  };

  // Reading an errored resource throws; the error branch below never reads it.
  const loaded = () => (overview.error ? undefined : overview());

  return (
    <Show
      when={!overview.error}
      fallback={
        <ErrorState
          error={overview.error}
          title="Couldn't load this project's agents"
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
                <p>The project's agents could not be loaded.</p>
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
          when={loaded()!.agents.length > 0}
          fallback={
            <div class="empty-state">
              <div class="empty-state__title">No agents on this project yet</div>
              <p>Add the tag from an agent's page or from the Agents page bulk action.</p>
            </div>
          }
        >
          <div class="panel" style="padding: 0;">
            <div class="data-table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>User</th>
                    <th>Models</th>
                    <th>Spend (30d)</th>
                    <th>Spend (365d)</th>
                    <th>Last used</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <For each={loaded()!.agents}>
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
                          </A>
                        </td>
                        <td>
                          <Show
                            when={agent.owner}
                            fallback={<span class="pill-muted">No user</span>}
                          >
                            <span class="who">
                              <Avatar name={agent.owner!.name} size="sm" />
                              <span>{agent.owner!.name}</span>
                            </span>
                          </Show>
                        </td>
                        <td class="num">
                          {agent.models_enabled} of {agent.models_total}
                        </td>
                        <td class="num">{formatCost(agent.spend_30d_usd) ?? '-'}</td>
                        <td class="num">
                          {agent.spend_365d_usd == null
                            ? '—'
                            : (formatCost(agent.spend_365d_usd) ?? '-')}
                        </td>
                        <td class="num--muted">{lastUsedLabel(agent.last_used_at)}</td>
                        <td style="text-align: right;">
                          <button
                            type="button"
                            class="btn btn--ghost btn--sm"
                            disabled={busy() === agent.agent_name}
                            onClick={() => void remove(agent)}
                          >
                            Remove from project
                          </button>
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

export default ProjectAgents;

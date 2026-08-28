import { A } from '@solidjs/router';
import { createSignal, For, Show, type Component } from 'solid-js';
import { PLATFORM_LABELS, coerceAgentPlatform, platformIcon } from 'manifest-shared';
import AddAgentModal from '../components/AddAgentModal.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { removeAgentFromUser, type AgentRow } from '../services/api/teams.js';
import { formatCost, formatTimeAgo } from '../services/formatters.js';
import { agentPath, userPath } from '../services/routing.js';
import { toast } from '../services/toast-store.js';
import { useUserDetail } from './UserDetail.jsx';

/**
 * The agents a user owns. "New agent" creates one with the owner already
 * filled in; "Remove from this user" leaves the agent with no owner (its
 * history stays under this user).
 */
const UserAgents: Component = () => {
  const { user, overview, userId, refetchOverview } = useUserDetail();
  const [addOpen, setAddOpen] = createSignal(false);
  const [removing, setRemoving] = createSignal<AgentRow | null>(null);
  const [busy, setBusy] = createSignal(false);

  // Reading an errored resource throws; the error branch below never reads it.
  const loaded = () => (overview.error ? undefined : overview());

  const via = () => [
    { label: 'Users', href: '/users' },
    { label: user()?.name ?? '', href: userPath(userId()) },
  ];

  const confirmRemove = async () => {
    const target = removing();
    if (!target || busy()) return;
    setBusy(true);
    try {
      await removeAgentFromUser(userId(), target.agent_name);
      toast.success(`${target.display_name} no longer has a user`);
      setRemoving(null);
      refetchOverview();
    } catch {
      toast.error("Couldn't remove this agent from the user.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div class="list-toolbar">
        <span class="who__sub">
          <Show when={loaded()} fallback={overview.error ? '' : 'Loading agents…'}>
            {loaded()!.agents.length} agent{loaded()!.agents.length === 1 ? '' : 's'} owned by{' '}
            {user()?.name}
          </Show>
        </span>
        <span class="list-toolbar__spacer" />
        <button class="btn btn--primary btn--sm" onClick={() => setAddOpen(true)}>
          New agent
        </button>
      </div>

      <Show when={overview.error}>
        <ErrorState
          error={overview.error}
          title="Couldn't load their agents"
          onRetry={refetchOverview}
        />
      </Show>

      <Show when={loaded()}>
        <Show
          when={loaded()!.agents.length > 0}
          fallback={
            <div class="empty-state">
              <div class="empty-state__title">No agents yet</div>
              <p>Create an agent for {user()?.name}. The user is filled in for you.</p>
              <button
                class="btn btn--primary btn--sm"
                style="margin-top: var(--gap-md);"
                onClick={() => setAddOpen(true)}
              >
                New agent
              </button>
            </div>
          }
        >
          <div class="panel" style="padding: 0;">
            <div class="data-table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Type</th>
                    <th>Projects</th>
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
                            <Show when={agent.archived_at}>
                              <span class="status-badge status-badge--neutral">Archived</span>
                            </Show>
                          </A>
                        </td>
                        <td class="who__sub">
                          {PLATFORM_LABELS[coerceAgentPlatform(agent.agent_platform)]}
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
                        <td class="num">{formatCost(agent.spend_30d_usd)}</td>
                        <td class="num">
                          {agent.spend_365d_usd == null ? '—' : formatCost(agent.spend_365d_usd)}
                        </td>
                        <td class="who__sub">{formatTimeAgo(agent.last_used_at) ?? 'Never'}</td>
                        <td style="text-align: right;">
                          <button
                            type="button"
                            class="btn btn--ghost btn--sm"
                            onClick={() => setRemoving(agent)}
                          >
                            Remove from this user
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

      {/* Keyed on the user so the modal remounts (and its owner default
          resets) when the route switches straight to another user. */}
      <Show when={userId()} keyed>
        {(ownerId) => (
          <AddAgentModal
            open={addOpen()}
            onClose={() => {
              setAddOpen(false);
              refetchOverview();
            }}
            defaultOwnerId={ownerId}
          />
        )}
      </Show>

      <Show when={removing()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRemoving(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setRemoving(null);
          }}
        >
          <div
            class="modal-card"
            style="max-width: 440px;"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-agent-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="modal-card__title" id="remove-agent-title">
              Remove {removing()!.display_name} from {user()?.name}?
            </h2>
            <p class="modal-card__desc">
              {removing()!.display_name} will keep running with no user. Its history stays under{' '}
              {user()?.name}. No user budget applies to it from now on.
            </p>
            <div class="modal-card__footer">
              <button
                type="button"
                class="btn btn--ghost btn--sm"
                onClick={() => setRemoving(null)}
                disabled={busy()}
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn--danger btn--sm"
                onClick={() => void confirmRemove()}
                disabled={busy()}
              >
                {busy() ? <span class="spinner" /> : 'Remove from this user'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default UserAgents;

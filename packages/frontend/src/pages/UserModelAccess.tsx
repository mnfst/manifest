import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { platformIcon } from 'manifest-shared';
import ErrorState from '../components/ErrorState.jsx';
import ModelAccessModal from '../components/ModelAccessModal.jsx';
import { providerIcon } from '../components/ProviderIcon.jsx';
import {
  getAgentModelAccess,
  type AgentRow,
  type ProviderModelAccess,
} from '../services/api/teams.js';
import { PROVIDERS } from '../services/providers.js';
import { useUserDetail } from './UserDetail.jsx';

interface AccessRow {
  agent: AgentRow;
  access: ProviderModelAccess;
}

const AUTH_BADGES: Record<string, string> = {
  api_key: 'API key',
  subscription: 'Subscription',
  local: 'Local',
};

export const providerLabel = (id: string) => PROVIDERS.find((p) => p.id === id)?.name ?? id;

export const modelsLabel = (access: ProviderModelAccess): string =>
  access.all_models
    ? `All ${access.total_count}`
    : `${access.enabled_count} of ${access.total_count}`;

/**
 * Model access across a user's agents: one row per agent × provider
 * connection. The Models button opens the same per-model editor as an agent's
 * "Providers and models" tab, with "Apply to other agents" scoped to this
 * user's agents.
 */
const UserModelAccess: Component = () => {
  const { user, overview, refetchOverview } = useUserDetail();
  const [editing, setEditing] = createSignal<AccessRow | null>(null);
  // Set when a save or an apply went through while the modal was open, so
  // closing it refetches every row: an apply changes other agents too.
  const [dirty, setDirty] = createSignal(false);

  // Reading an errored resource throws; the error branch below never reads it.
  const loaded = () => (overview.error ? undefined : overview());
  const agents = () => loaded()?.agents ?? [];

  const [rows, { refetch, mutate }] = createResource(
    () => (loaded() ? agents().map((a) => a.agent_name) : null),
    async (): Promise<AccessRow[]> => {
      const lists = await Promise.all(
        agents().map((agent) => getAgentModelAccess(agent.agent_name)),
      );
      return agents().flatMap((agent, i) => lists[i]!.map((access) => ({ agent, access })));
    },
  );

  const handleSaved = (updated: ProviderModelAccess) => {
    const current = editing();
    if (!current) return;
    setDirty(true);
    mutate((list) =>
      (list ?? []).map((row) =>
        row.agent.agent_name === current.agent.agent_name &&
        row.access.user_provider_id === updated.user_provider_id
          ? { ...row, access: updated }
          : row,
      ),
    );
  };

  return (
    <div>
      <p class="who__sub" style="margin-bottom: var(--gap-md);">
        Which models each of {user()?.name}'s agents may call, provider by provider. A model used by
        routing cannot be turned off.
      </p>

      <Show when={overview.error}>
        <ErrorState
          error={overview.error}
          title="Couldn't load their agents"
          onRetry={refetchOverview}
        />
      </Show>

      <Show when={loaded()}>
        <Show
          when={agents().length > 0}
          fallback={
            <div class="empty-state">
              <div class="empty-state__title">{user()?.name} has no agents yet.</div>
              <p>Model access is set per agent. Create one from the Agents tab first.</p>
            </div>
          }
        >
          <Show
            when={rows.state !== 'pending' && rows.state !== 'unresolved'}
            fallback={
              <div class="panel">
                <For each={[1, 2]}>
                  {() => (
                    <div
                      class="skeleton skeleton--text"
                      style="width: 100%; height: 36px; margin-bottom: var(--gap-sm);"
                    />
                  )}
                </For>
              </div>
            }
          >
            <Show when={!rows.error} fallback={<ErrorState error={rows.error} onRetry={refetch} />}>
              <Show
                when={(rows() ?? []).length > 0}
                fallback={
                  <div class="empty-state">
                    <div class="empty-state__title">No provider connections yet</div>
                    <p>Connect a provider, then enable it for these agents.</p>
                  </div>
                }
              >
                <div class="panel" style="padding: 0;">
                  <div class="data-table-scroll">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Provider</th>
                          <th>Connection</th>
                          <th>Models</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        <For each={rows() ?? []}>
                          {(row) => (
                            <tr>
                              <td>
                                <span class="who">
                                  <Show
                                    when={platformIcon(
                                      row.agent.agent_platform,
                                      row.agent.agent_category,
                                    )}
                                  >
                                    <img
                                      src={platformIcon(
                                        row.agent.agent_platform,
                                        row.agent.agent_category,
                                      )}
                                      alt=""
                                      class="who__icon"
                                    />
                                  </Show>
                                  <span class="who__name">{row.agent.display_name}</span>
                                </span>
                              </td>
                              <td>
                                <span class="who">
                                  <Show when={providerIcon(row.access.provider, 16)}>
                                    <span style="display: inline-flex; width: 16px; height: 16px;">
                                      {providerIcon(row.access.provider, 16)}
                                    </span>
                                  </Show>
                                  {providerLabel(row.access.provider)}
                                </span>
                              </td>
                              <td class="who__sub">
                                {AUTH_BADGES[row.access.auth_type] ?? row.access.auth_type} ·{' '}
                                {row.access.label}
                              </td>
                              <td class="num">{modelsLabel(row.access)}</td>
                              <td style="text-align: right;">
                                <button
                                  type="button"
                                  class="btn btn--outline btn--sm"
                                  aria-label={`Models for ${row.agent.display_name} on ${providerLabel(row.access.provider)}`}
                                  onClick={() => setEditing(row)}
                                >
                                  Models
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
        </Show>
      </Show>

      <Show when={editing()}>
        <ModelAccessModal
          open={editing() !== null}
          agentName={editing()!.agent.agent_name}
          access={editing()!.access}
          onClose={() => {
            setEditing(null);
            if (dirty()) {
              setDirty(false);
              void refetch();
            }
          }}
          onSaved={handleSaved}
          applyTargets={agents()}
        />
      </Show>
    </div>
  );
};

export default UserModelAccess;

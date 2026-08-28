import { A, useLocation, useParams } from '@solidjs/router';
import { createResource, type ParentComponent, Show, For } from 'solid-js';
import { Title } from '@solidjs/meta';
import { agentPath, projectPath, userPath } from '../services/routing.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import { agentPlatformIcon } from '../services/agent-platform-store.js';
import { getAgentTeam, type AgentRow } from '../services/api/teams.js';
import { routingPing } from '../services/sse.js';
import EntityTabs from '../components/EntityTabs.jsx';
import AgentProjectsEditor from '../components/AgentProjectsEditor.jsx';

type AgentTeam = Pick<AgentRow, 'owner' | 'projects' | 'archived_at'>;

/**
 * AgentDetail — horizontal-tabbed shell for the agent detail view.
 *
 * Renders a header (platform icon + agent display name + owner chip + project
 * tags) and a horizontal tab bar (Overview / Routing / Providers and models /
 * Limits / Settings). Child routes render in the body via props.children.
 *
 * The owner chip is a link, not a picker: there is no owner reassignment.
 * Past activity stays attributed to whoever owned the agent when it ran; to
 * hand an agent over, archive it and create a fresh one for its new owner
 * with "Copy settings from an agent".
 */
const AgentDetail: ParentComponent = (props) => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation();

  const agentName = () => decodeURIComponent(params.agentName);
  const path = (sub: string) => agentPath(params.agentName, sub);

  const [team, { mutate: mutateTeam, refetch: refetchTeam }] = createResource(
    () => ({ name: agentName(), _r: routingPing() }),
    async ({ name }): Promise<AgentTeam | null> => {
      try {
        return await getAgentTeam(name);
      } catch {
        // Unknown, not empty: an empty team would let the projects editor
        // save a list that silently drops every real association.
        return null;
      }
    },
  );

  const isActive = (sub: string) => {
    const p = path(sub);
    if (sub === '' || sub === '/overview') {
      return location.pathname === path('') || location.pathname === path('/overview');
    }
    if (sub === '/routing') {
      return location.pathname === path('/routing');
    }
    return location.pathname.startsWith(p);
  };

  return (
    <div class="container--lg">
      <Title>{agentDisplayName() ?? agentName()} | Manifest</Title>

      <div class="entity-header">
        <Show when={agentPlatformIcon()}>
          <img src={agentPlatformIcon()!} alt="" width="28" height="28" style="flex-shrink: 0;" />
        </Show>
        <h1 class="page-header__title entity-header__title">{agentDisplayName() ?? agentName()}</h1>
        <div class="entity-header__chips">
          <Show when={team()?.archived_at}>
            <span class="status-badge status-badge--neutral">Archived</span>
          </Show>
          <Show
            when={team()?.owner}
            fallback={
              <Show
                when={team() != null}
                fallback={
                  <Show
                    when={team() === null}
                    fallback={
                      <span class="chip" aria-busy="true">
                        <span class="chip__muted">Owner:</span> …
                      </span>
                    }
                  >
                    <span class="chip" title="The owner and projects could not be loaded.">
                      <span class="chip__muted">Owner:</span> Unavailable
                      <button
                        type="button"
                        class="field__suggestion"
                        onClick={() => void refetchTeam()}
                      >
                        Retry
                      </button>
                    </span>
                  </Show>
                }
              >
                <span
                  class="chip"
                  title="This agent runs without an owner. No user budget applies to it."
                >
                  <span class="chip__muted">Owner:</span> No owner
                </span>
              </Show>
            }
          >
            <A
              href={userPath(team()!.owner!.id)}
              class="chip chip--button"
              style="text-decoration: none;"
            >
              <span class="chip__muted">Owner:</span> {team()!.owner!.name}
            </A>
          </Show>
          <For each={team()?.projects ?? []}>
            {(project) => (
              <A
                href={projectPath(project.id)}
                class="project-tag"
                classList={{ 'project-tag--archived': !!project.archived_at }}
                style="text-decoration: none;"
              >
                {project.name}
              </A>
            )}
          </For>
          <Show when={team()}>
            <AgentProjectsEditor
              agentName={agentName()}
              projects={team()!.projects}
              onChange={(projects, forAgent) => {
                // A save that resolves after the route moved to another agent
                // must not overwrite that agent's projects.
                if (forAgent !== agentName()) return;
                mutateTeam((current) => (current ? { ...current, projects } : current));
              }}
            />
          </Show>
        </div>
      </div>

      <EntityTabs
        tabs={[
          { label: 'Overview', href: path(''), active: isActive('/overview') },
          { label: 'Routing', href: path('/routing'), active: isActive('/routing') },
          {
            label: 'Providers and models',
            href: path('/providers'),
            active: isActive('/providers'),
          },
          { label: 'Limits', href: path('/guardrails'), active: isActive('/guardrails') },
          { label: 'Settings', href: path('/settings'), active: isActive('/settings') },
        ]}
      />

      {/* Tab content from child routes */}
      {props.children}
    </div>
  );
};

export default AgentDetail;

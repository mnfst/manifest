import { useParams } from '@solidjs/router';
import { createResource, createMemo, Show, onCleanup, type ParentComponent } from 'solid-js';
import ErrorState from './ErrorState.jsx';
import NotFound from '../pages/NotFound.jsx';
import { getAgents } from '../services/api.js';
import { setAgentDisplayName } from '../services/agent-display-name.js';
import { setAgentPlatform } from '../services/agent-platform-store.js';
import { isRecentlyCreated, clearRecentAgent } from '../services/recent-agents.js';

interface Agent {
  agent_name: string;
  display_name?: string;
  agent_category?: string | null;
  agent_platform?: string | null;
}

interface AgentsData {
  agents: Agent[];
}

const AgentGuard: ParentComponent = (props) => {
  const params = useParams<{ agentName: string }>();

  // Key the fetch on the agent param so the list is re-fetched whenever the
  // viewed agent changes. AgentGuard stays mounted across `/harnesses/:agentName`
  // navigations (only the param updates), so a source-less resource would keep
  // serving the list captured on first mount. That stale list omits an agent
  // created from the always-present sidebar while another agent is open, which
  // left `setAgentPlatform(null)` below — making the post-create setup modal
  // render its full harness picker instead of the harness the user just chose.
  const [data, { refetch }] = createResource(
    () => params.agentName,
    () => getAgents() as Promise<AgentsData>,
  );

  const agentExists = createMemo(() => {
    const decoded = decodeURIComponent(params.agentName);
    const recent = isRecentlyCreated(decoded);
    const list = data()?.agents;
    if (!list) return true; // still loading or no data yet — don't block
    const agent = list.find((a) => a.agent_name === decoded);
    if (agent) {
      clearRecentAgent(agent.agent_name);
      setAgentDisplayName(agent.display_name ?? agent.agent_name);
      setAgentPlatform(agent.agent_platform ?? null, agent.agent_category ?? null);
    } else {
      setAgentDisplayName(null);
      setAgentPlatform(null, null);
    }
    return recent || !!agent;
  });

  onCleanup(() => {
    setAgentDisplayName(null);
    setAgentPlatform(null, null);
  });

  return (
    // Only blank on the very first load. Once a list has resolved, keep the
    // children mounted while a param-change refetch is in flight so switching
    // agents (and the post-create redirect) doesn't flash an empty page.
    <Show when={!data.loading || data() !== undefined} fallback={null}>
      <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
        <Show when={data()?.agents}>
          <Show when={agentExists()} fallback={<NotFound />}>
            {props.children}
          </Show>
        </Show>
      </Show>
    </Show>
  );
};

export default AgentGuard;

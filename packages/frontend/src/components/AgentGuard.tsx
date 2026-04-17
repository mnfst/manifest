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

  const [data, { refetch }] = createResource(() => getAgents() as Promise<AgentsData>);

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
    <Show when={!data.loading} fallback={null}>
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

import { useParams } from '@solidjs/router';
import { createResource, createMemo, Show, onCleanup, type ParentComponent } from 'solid-js';
import ErrorState from './ErrorState.jsx';
import NotFound from '../pages/NotFound.jsx';
import { getAgents } from '../services/api.js';
import { isLocalMode, checkLocalMode } from '../services/local-mode.js';
import { setAgentDisplayName } from '../services/agent-display-name.js';
import { isRecentlyCreated, clearRecentAgent } from '../services/recent-agents.js';

interface Agent {
  agent_name: string;
  display_name?: string;
}

interface AgentsData {
  agents: Agent[];
}

const AgentGuard: ParentComponent = (props) => {
  const params = useParams<{ agentName: string }>();

  // Wait for the mode check to resolve before deciding what to do.
  // checkLocalMode() is already called by AuthGuard, so this just awaits
  // the existing promise (no extra network request).
  const [mode] = createResource(() => checkLocalMode());

  const [data, { refetch }] = createResource(
    // Only fetch agents in cloud mode (mode resolved and not local)
    () => (mode() === false ? true : false),
    () => getAgents() as Promise<AgentsData>,
  );

  const agentExists = createMemo(() => {
    // Local mode: agent is guaranteed to exist (bootstrapped by LocalBootstrapService)
    if (isLocalMode()) {
      setAgentDisplayName(null);
      return true;
    }
    const decoded = decodeURIComponent(params.agentName);
    const recent = isRecentlyCreated(decoded);
    const list = data()?.agents;
    if (!list) return true; // still loading or no data yet — don't block
    const agent = list.find((a) => a.agent_name === decoded);
    if (agent) {
      clearRecentAgent(agent.agent_name);
      setAgentDisplayName(agent.display_name ?? agent.agent_name);
    }
    return recent || !!agent;
  });

  onCleanup(() => setAgentDisplayName(null));

  return (
    <Show when={mode() !== undefined} fallback={null}>
      <Show
        when={isLocalMode()}
        fallback={
          <Show when={!data.loading} fallback={null}>
            <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
              <Show when={data()?.agents}>
                <Show when={agentExists()} fallback={<NotFound />}>
                  {props.children}
                </Show>
              </Show>
            </Show>
          </Show>
        }
      >
        {props.children}
      </Show>
    </Show>
  );
};

export default AgentGuard;

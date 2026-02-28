import { useParams, useLocation } from "@solidjs/router";
import { createResource, createMemo, Show, type ParentComponent } from "solid-js";
import ErrorState from "./ErrorState.jsx";
import NotFound from "../pages/NotFound.jsx";
import { getAgents } from "../services/api.js";
import { isLocalMode, checkLocalMode } from "../services/local-mode.js";

interface Agent {
  agent_name: string;
  display_name?: string;
}

interface AgentsData {
  agents: Agent[];
}

const AgentGuard: ParentComponent = (props) => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation<{ newAgent?: boolean }>();

  // Wait for the mode check to resolve before deciding what to do.
  // checkLocalMode() is already called by AuthGuard, so this just awaits
  // the existing promise (no extra network request).
  const [mode] = createResource(() => checkLocalMode());

  const [data, { refetch }] = createResource(
    // Only fetch agents in cloud mode (mode resolved and not local)
    () => mode() === false ? true : false,
    () => getAgents() as Promise<AgentsData>,
  );

  const agentExists = createMemo(() => {
    // Local mode: agent is guaranteed to exist (bootstrapped by LocalBootstrapService)
    if (isLocalMode()) return true;
    if (location.state?.newAgent) return true;
    const list = data()?.agents;
    if (!list) return true; // still loading or no data yet — don't block
    return list.some(
      (a) => a.agent_name === decodeURIComponent(params.agentName),
    );
  });

  return (
    <Show when={mode() !== undefined} fallback={null}>
      <Show when={isLocalMode()} fallback={
        <Show when={!data.loading} fallback={null}>
          <Show when={!data.error} fallback={
            <ErrorState error={data.error} onRetry={refetch} />
          }>
            <Show when={data()?.agents}>
              <Show when={agentExists()} fallback={<NotFound />}>
                {props.children}
              </Show>
            </Show>
          </Show>
        </Show>
      }>
        {props.children}
      </Show>
    </Show>
  );
};

export default AgentGuard;

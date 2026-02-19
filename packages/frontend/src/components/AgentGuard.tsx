import { useParams, useNavigate } from "@solidjs/router";
import { createResource, createEffect, Show, type ParentComponent } from "solid-js";
import ErrorState from "./ErrorState.jsx";
import { getAgents } from "../services/api.js";

interface Agent {
  agent_name: string;
}

interface AgentsData {
  agents: Agent[];
}

const AgentGuard: ParentComponent = (props) => {
  const params = useParams<{ agentName: string }>();
  const navigate = useNavigate();
  const [data, { refetch }] = createResource(() => getAgents() as Promise<AgentsData>);

  createEffect(() => {
    const list = data()?.agents;
    if (!list) return;
    const exists = list.some(
      (a) => a.agent_name === decodeURIComponent(params.agentName),
    );
    if (!exists) {
      navigate("/404", { replace: true });
    }
  });

  return (
    <Show when={!data.loading} fallback={null}>
      <Show when={!data.error} fallback={
        <ErrorState error={data.error} onRetry={refetch} />
      }>
        <Show when={data()?.agents}>
          {props.children}
        </Show>
      </Show>
    </Show>
  );
};

export default AgentGuard;

import { createResource, createSignal, Show, For, type Component } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { getAgents, createAgent } from '../services/api.js';
import { markAgentCreated } from '../services/recent-agents.js';

interface Agent {
  agent_name: string;
  display_name?: string;
}

interface AgentsData {
  agents: Agent[];
}

const ConnectProvider: Component = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [creating, setCreating] = createSignal(false);

  const str = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

  const buildTarget = (agentName: string) => {
    const qp = new URLSearchParams();
    const provider = str(searchParams.provider) || 'custom';
    qp.set('provider', provider);
    const name = str(searchParams.name);
    const baseUrl = str(searchParams.baseUrl);
    const apiKey = str(searchParams.apiKey);
    const models = str(searchParams.models);
    if (name) qp.set('name', name);
    if (baseUrl) qp.set('baseUrl', baseUrl);
    if (apiKey) qp.set('apiKey', apiKey);
    if (models) qp.set('models', models);
    return `/agents/${encodeURIComponent(agentName)}/routing?${qp.toString()}`;
  };

  const autoCreate = async () => {
    setCreating(true);
    try {
      const result = await createAgent('my-agent');
      const slug = result?.agent?.name ?? 'my-agent';
      markAgentCreated(slug);
      navigate(buildTarget(slug), { replace: true });
    } catch {
      setCreating(false);
    }
  };

  const [data] = createResource(async () => {
    const result = (await getAgents()) as AgentsData;
    const agents = result?.agents ?? [];

    if (agents.length === 1 && agents[0]) {
      navigate(buildTarget(agents[0].agent_name), { replace: true });
    } else if (agents.length === 0) {
      await autoCreate();
    }

    return agents;
  });

  const pickAgent = (agentName: string) => {
    navigate(buildTarget(agentName), { replace: true });
  };

  return (
    <div class="container--sm" style="padding-top: 80px;">
      <Show when={!data.loading && (data()?.length ?? 0) > 1}>
        <div class="panel" style="max-width: 440px; margin: 0 auto; padding: 32px;">
          <h2 style="margin: 0 0 8px;">Select an agent</h2>
          <p style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); margin: 0 0 24px;">
            Which agent should this provider be added to?
          </p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <For each={data()}>
              {(agent) => (
                <button
                  class="btn btn--outline"
                  style="justify-content: flex-start; text-align: left;"
                  onClick={() => pickAgent(agent.agent_name)}
                >
                  {agent.display_name ?? agent.agent_name}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={data.loading || creating() || (data()?.length ?? 0) <= 1}>
        <div style="display: flex; align-items: center; justify-content: center; min-height: 200px;">
          <span
            class="spinner"
            style="width: 24px; height: 24px;"
            role="status"
            aria-label="Loading"
          />
        </div>
      </Show>
    </div>
  );
};

export default ConnectProvider;

import {
  createResource,
  createSignal,
  onMount,
  Show,
  For,
  type Component,
} from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import ErrorState from "../components/ErrorState.jsx";
import { getAgents, createAgent } from "../services/api.js";
import { toast } from "../services/toast-store.js";
import { formatNumber, formatCost } from "../services/formatters.js";
import Sparkline from "../components/Sparkline.jsx";
import { checkLocalMode } from "../services/local-mode.js";
import { trackEvent } from "../services/analytics.js";

interface Agent {
  agent_name: string;
  message_count: number;
  last_active: string;
  total_cost: number;
  total_tokens: number;
  sparkline: number[];
}

interface AgentsData {
  agents: Agent[];
}

const AddAgentModal: Component<{ open: boolean; onClose: () => void }> = (
  props,
) => {
  const navigate = useNavigate();
  const [name, setName] = createSignal("");

  const handleCreate = async () => {
    const agentName = name().trim();
    if (!agentName) return;
    try {
      const result = await createAgent(agentName);
      trackEvent("agent_created", { agent_name: agentName });
      toast.success(`Agent "${agentName}" connected`);
      props.onClose();
      setName("");
      const url = `/agents/${encodeURIComponent(agentName)}`;
      navigate(url, { state: { newAgent: true, newApiKey: result?.apiKey } });
    } catch {
      // error toast already shown by fetchMutate
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") {
      props.onClose();
      setName("");
    }
  };

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay"
        onClick={() => {
          props.onClose();
          setName("");
        }}
      >
        <div
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-agent-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="add-agent-title">
            Connect Agent
          </h2>
          <p class="modal-card__desc">
            Give your agent a name to start monitoring its activity, costs, and messages.
          </p>

          <label class="modal-card__field-label">Agent name</label>
          <input
            ref={(el) => requestAnimationFrame(() => el.focus())}
            class="modal-card__input"
            type="text"
            placeholder="e.g. Clawdy"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />

          <div class="modal-card__footer">
            <button
              class="btn btn--primary"
              onClick={handleCreate}
              disabled={!name().trim()}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

const Workspace: Component = () => {
  const navigate = useNavigate();
  const [data, { refetch }] = createResource(() => getAgents() as Promise<AgentsData>);
  const [modalOpen, setModalOpen] = createSignal(false);

  onMount(async () => {
    const local = await checkLocalMode();
    if (local) {
      navigate("/agents/local-agent", { replace: true });
    }
  });

  return (
    <div class="container--md">
      <Title>My Agents | Manifest</Title>
      <Meta name="description" content="View and manage all your AI agents. Monitor usage, messages, and costs." />
      <div class="page-header">
        <div>
          <h1>My Agents</h1>
          <span class="breadcrumb">All agents</span>
        </div>
        <button class="btn btn--primary" onClick={() => setModalOpen(true)}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Connect Agent
        </button>
      </div>

      <Show
        when={!data.loading}
        fallback={
          <div class="agents-grid">
            <For each={[1, 2, 3, 4, 5, 6]}>
              {() => (
                <div class="agent-card agent-card--skeleton">
                  <div
                    class="skeleton skeleton--text"
                    style="width: 60%; height: 20px;"
                  />
                  <div style="display: flex; gap: 16px; margin-top: 12px;">
                    <div
                      class="skeleton skeleton--text"
                      style="width: 30%; height: 14px;"
                    />
                    <div
                      class="skeleton skeleton--text"
                      style="width: 30%; height: 14px;"
                    />
                  </div>
                  <div
                    class="skeleton skeleton--rect"
                    style="width: 100%; height: 50px; margin-top: 12px;"
                  />
                </div>
              )}
            </For>
          </div>
        }
      >
        <Show when={!data.error} fallback={
          <ErrorState error={data.error} onRetry={refetch} />
        }>
        <Show
          when={data()?.agents?.length}
          fallback={
            <div class="empty-state">
              <div class="empty-state__title">No agents yet</div>
              <p>Connect your first agent to start tracking its activity.</p>
              <button class="btn btn--primary" style="margin-top: var(--gap-md);" onClick={() => setModalOpen(true)}>
                Connect your first agent
              </button>
            </div>
          }
        >
          <div class="agents-grid">
            <For each={data()!.agents}>
              {(agent) => (
                <A
                  href={`/agents/${encodeURIComponent(agent.agent_name)}`}
                  class="agent-card"
                >
                  <div class="agent-card__top">
                    <span class="agent-card__name">{agent.agent_name}</span>
                  </div>
                  <div class="agent-card__stats">
                    <div class="agent-card__stat">
                      <span class="agent-card__stat-label">Tokens</span>
                      <span class="agent-card__stat-value">
                        {formatNumber(agent.total_tokens)}
                      </span>
                    </div>
                    <div class="agent-card__stat">
                      <span class="agent-card__stat-label">Messages</span>
                      <span class="agent-card__stat-value">
                        {agent.message_count}
                      </span>
                    </div>
                    <div class="agent-card__stat">
                      <span class="agent-card__stat-label">Cost</span>
                      <span class="agent-card__stat-value">
                        {formatCost(agent.total_cost)}
                      </span>
                    </div>
                  </div>
                  <div class="agent-card__chart">
                    <Sparkline data={agent.sparkline} width={280} height={50} />
                  </div>
                </A>
              )}
            </For>
          </div>
        </Show>
        </Show>
      </Show>

      <AddAgentModal open={modalOpen()} onClose={() => setModalOpen(false)} />
    </div>
  );
};

export default Workspace;

import {
  createEffect,
  createResource,
  createSignal,
  Show,
  For,
  onCleanup,
  type Component,
} from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import ErrorState from '../components/ErrorState.jsx';
import AgentTypeSelect from '../components/AgentTypeSelect.jsx';
import DuplicateAgentModal from '../components/DuplicateAgentModal.jsx';
import { getAgents, createAgent, deleteAgent } from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { markAgentCreated } from '../services/recent-agents.js';
import { formatNumber } from '../services/formatters.js';
import Sparkline from '../components/Sparkline.jsx';
import { pingCount } from '../services/sse.js';
import {
  type AgentCategory,
  type AgentPlatform,
  PLATFORMS_BY_CATEGORY,
  platformIcon,
} from 'manifest-shared';

interface Agent {
  agent_name: string;
  display_name?: string;
  agent_category?: string | null;
  agent_platform?: string | null;
  message_count: number;
  last_active: string;
  total_cost: number;
  total_tokens: number;
  sparkline: number[];
}

interface AgentsData {
  agents: Agent[];
}

const AddAgentModal: Component<{ open: boolean; onClose: () => void }> = (props) => {
  const navigate = useNavigate();
  const [name, setName] = createSignal('');
  const [category, setCategory] = createSignal<AgentCategory | null>('personal');
  const [platform, setPlatform] = createSignal<AgentPlatform | null>(
    PLATFORMS_BY_CATEGORY['personal'][0] ?? null,
  );
  const [creating, setCreating] = createSignal(false);

  const handleCategoryChange = (c: AgentCategory) => {
    setCategory(c);
    setPlatform(PLATFORMS_BY_CATEGORY[c][0] ?? null);
  };

  const handleCreate = async () => {
    const agentName = name().trim();
    if (!agentName) return;
    setCreating(true);
    try {
      const result = await createAgent({
        name: agentName,
        ...(category() ? { agent_category: category()! } : {}),
        ...(platform() ? { agent_platform: platform()! } : {}),
      });
      toast.success(`Agent "${agentName}" connected`);
      props.onClose();
      resetForm();
      const slug = result?.agent?.name ?? agentName;
      markAgentCreated(slug);
      navigate(`/agents/${encodeURIComponent(slug)}`, {
        state: { newApiKey: result?.apiKey },
      });
    } catch {
      // error toast already shown by fetchMutate
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCategory('personal');
    setPlatform(PLATFORMS_BY_CATEGORY['personal'][0] ?? null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      props.onClose();
      resetForm();
    }
  };

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay"
        onClick={() => {
          props.onClose();
          resetForm();
        }}
      >
        <div
          class="modal-card"
          style="max-width: 540px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-agent-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="add-agent-title">
            Connect Agent
          </h2>
          <p class="modal-card__desc">
            Name your agent to start tracking its LLM usage, costs, and messages in real time.
          </p>

          <div class="agent-type-select-row">
            <div>
              <label class="modal-card__field-label">Type</label>
              <AgentTypeSelect
                category={category()}
                platform={platform()}
                onCategoryChange={handleCategoryChange}
                onPlatformChange={setPlatform}
                disabled={creating()}
              />
            </div>
            <div style="flex: 1;">
              <label class="modal-card__field-label" for="agent-name-input">
                Agent name
              </label>
              <input
                ref={(el) => requestAnimationFrame(() => el.focus())}
                id="agent-name-input"
                class="modal-card__input modal-card__input--lg"
                type="text"
                placeholder="e.g. My Cool Agent"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                disabled={creating()}
              />
            </div>
          </div>

          <div class="modal-card__footer">
            <button
              class="btn btn--primary btn--sm"
              onClick={handleCreate}
              disabled={!name().trim() || creating()}
            >
              {creating() ? <span class="spinner" /> : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

const AgentCardMenu: Component<{
  agentName: string;
  onDuplicate: () => void;
  onDelete: () => void;
}> = (props) => {
  const [open, setOpen] = createSignal(false);
  let rootEl: HTMLDivElement | undefined;

  const handleDocumentClick = (e: MouseEvent) => {
    if (rootEl && !rootEl.contains(e.target as Node)) setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  };

  // Only register global listeners while the popover is open, so N cards
  // don't attach N permanent document listeners to the workspace grid.
  createEffect(() => {
    if (!open()) return;
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    });
  });

  return (
    <div ref={rootEl} class="agent-card__menu" classList={{ 'agent-card__menu--open': open() }}>
      <button
        type="button"
        class="agent-card__menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-label={`Actions for ${props.agentName}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
      </button>
      <Show when={open()}>
        <div class="agent-card__menu-popover" role="menu">
          <button
            type="button"
            class="agent-card__menu-item"
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              props.onDuplicate();
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Duplicate
          </button>
          <button
            type="button"
            class="agent-card__menu-item agent-card__menu-item--danger"
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              props.onDelete();
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Delete
          </button>
        </div>
      </Show>
    </div>
  );
};

const Workspace: Component = () => {
  const [data, { refetch }] = createResource(
    () => ({ _ping: pingCount() }),
    () => getAgents() as Promise<AgentsData>,
  );
  const [modalOpen, setModalOpen] = createSignal(false);
  const [duplicateSource, setDuplicateSource] = createSignal<string | null>(null);
  const [deleteTarget, setDeleteTarget] = createSignal<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = createSignal('');
  const [deleting, setDeleting] = createSignal(false);

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteConfirmName('');
  };

  const handleDelete = async () => {
    const target = deleteTarget();
    if (!target || deleteConfirmName() !== target) return;
    setDeleting(true);
    try {
      await deleteAgent(target);
      toast.success(`Agent "${target}" deleted`);
      closeDeleteModal();
      await refetch();
    } catch {
      // error toast handled by fetchMutate
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div class="container--md">
      <Title>My Agents - Manifest</Title>
      <Meta
        name="description"
        content="View and manage all your AI agents. Monitor usage, messages, and costs."
      />
      <div class="page-header">
        <div>
          <h1>My Agents</h1>
          <span class="breadcrumb">View and manage all your connected AI agents</span>
        </div>
        <button class="btn btn--primary btn--sm" onClick={() => setModalOpen(true)}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
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
                  <div class="skeleton skeleton--text" style="width: 60%; height: 20px;" />
                  <div style="display: flex; gap: 16px; margin-top: 12px;">
                    <div class="skeleton skeleton--text" style="width: 30%; height: 14px;" />
                    <div class="skeleton skeleton--text" style="width: 30%; height: 14px;" />
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
        <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
          <Show
            when={data()?.agents?.length}
            fallback={
              <div class="empty-state">
                <div class="empty-state__title">No agents yet</div>
                <p>Connect an agent or an AI app to take control of your routing and your costs.</p>
                <button
                  class="btn btn--primary btn--sm"
                  style="margin-top: var(--gap-md);"
                  onClick={() => setModalOpen(true)}
                >
                  Connect your first agent
                </button>
              </div>
            }
          >
            <div class="agents-grid">
              <For each={data()!.agents}>
                {(agent) => (
                  <div class="agent-card-wrap">
                    <A href={`/agents/${encodeURIComponent(agent.agent_name)}`} class="agent-card">
                      <div class="agent-card__top">
                        <Show when={platformIcon(agent.agent_platform, agent.agent_category)}>
                          <img
                            src={platformIcon(agent.agent_platform, agent.agent_category)}
                            alt=""
                            width="18"
                            height="18"
                            class="agent-card__platform-icon"
                          />
                        </Show>
                        <span class="agent-card__name">
                          {agent.display_name ?? agent.agent_name}
                        </span>
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
                          <span class="agent-card__stat-value">{agent.message_count}</span>
                        </div>
                      </div>
                      <div class="agent-card__chart">
                        <Sparkline data={agent.sparkline} width={280} height={50} />
                      </div>
                    </A>
                    <AgentCardMenu
                      agentName={agent.agent_name}
                      onDuplicate={() => setDuplicateSource(agent.agent_name)}
                      onDelete={() => {
                        setDeleteTarget(agent.agent_name);
                        setDeleteConfirmName('');
                      }}
                    />
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>

      <AddAgentModal open={modalOpen()} onClose={() => setModalOpen(false)} />
      <DuplicateAgentModal
        open={duplicateSource() !== null}
        sourceName={duplicateSource() ?? ''}
        onClose={() => setDuplicateSource(null)}
        onDuplicated={() => refetch()}
      />

      <Show when={deleteTarget()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeDeleteModal();
          }}
        >
          <div
            class="modal-card"
            style="max-width: 440px;"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="workspace-delete-title"
              style="margin: 0 0 var(--gap-md); font-size: var(--font-size-lg);"
            >
              Delete {deleteTarget()}
            </h3>
            <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-md);">
              This will permanently delete the{' '}
              <strong style="color: hsl(var(--foreground));">{deleteTarget()}</strong> agent and all
              its data. This action cannot be undone.
            </p>
            <label
              for="workspace-delete-confirm"
              style="display: block; font-size: var(--font-size-sm); color: hsl(var(--foreground)); margin-bottom: var(--gap-sm);"
            >
              To confirm, type <strong>"{deleteTarget()}"</strong> below
            </label>
            <input
              id="workspace-delete-confirm"
              class="modal-card__input modal-card__input--lg"
              type="text"
              value={deleteConfirmName()}
              onInput={(e) => setDeleteConfirmName(e.currentTarget.value)}
              placeholder={deleteTarget() ?? ''}
              style="margin-bottom: var(--gap-lg);"
            />
            <div class="modal-card__footer">
              <button
                type="button"
                class="btn btn--ghost btn--sm"
                onClick={closeDeleteModal}
                disabled={deleting()}
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn--danger btn--sm"
                onClick={handleDelete}
                disabled={deleteConfirmName() !== deleteTarget() || deleting()}
              >
                {deleting() ? <span class="spinner" /> : 'Delete agent'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Workspace;

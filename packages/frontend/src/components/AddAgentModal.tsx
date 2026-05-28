import { createSignal, Show, type Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import AgentTypeSelect from './AgentTypeSelect.jsx';
import { createAgent } from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { markAgentCreated } from '../services/recent-agents.js';
import { type AgentCategory, type AgentPlatform, PLATFORMS_BY_CATEGORY } from 'manifest-shared';

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
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) handleCreate();
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
          onKeyDown={handleKeyDown}
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

export default AddAgentModal;

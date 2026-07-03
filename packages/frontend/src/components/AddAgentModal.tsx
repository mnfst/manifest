import { createResource, createSignal, onCleanup, Show, type Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import AgentTypeSelect from './AgentTypeSelect.jsx';
import { createAgent, getGlobalProviders } from '../services/api.js';
import { getBillingStatus } from '../services/api/billing.js';
import { UpgradePanel } from './UpgradePanel.jsx';
import { toast } from '../services/toast-store.js';
import { markAgentCreated, markSetupPending } from '../services/recent-agents.js';
import { type AgentCategory, type AgentPlatform, PLATFORMS_BY_CATEGORY } from 'manifest-shared';

/**
 * "Connect Harness" modal extracted from Workspace so it can be reused by other
 * onboarding surfaces (e.g. an empty-state CTA or a deep-link).
 *
 * Onboarding navigation: a freshly created agent inherits access to every
 * connected provider, so Routing is the most useful first stop.
 * If the tenant has *no* providers yet, we additionally pass
 * `state.openProviders` so Routing opens the provider-connect flow immediately —
 * the new user's very next action is to connect their first provider.
 */
const AddAgentModal: Component<{ open: boolean; onClose: () => void }> = (props) => {
  const navigate = useNavigate();
  const [name, setName] = createSignal('');
  const [category, setCategory] = createSignal<AgentCategory | null>('personal');
  const [platform, setPlatform] = createSignal<AgentPlatform | null>(
    PLATFORMS_BY_CATEGORY['personal'][0] ?? null,
  );
  const [creating, setCreating] = createSignal(false);

  // Load billing status while the modal is open so we can paywall agent creation
  // once the tenant is at its plan's agent limit. Only fetched when open.
  const [billing] = createResource(
    () => props.open,
    (open) => (open ? getBillingStatus() : undefined),
  );
  const atAgentLimit = () => {
    const b = billing();
    return !!b?.enabled && b.agents.limit != null && b.agents.used >= b.agents.limit;
  };

  // Tracks whether the user dismissed the modal (overlay click / Escape) while a
  // create request was still in flight. A dismissed create must NOT run its
  // post-success side effects (toast, markAgentCreated) or navigate afterwards —
  // otherwise closing the modal mid-request still yanks the user to Routing once
  // the request resolves. Reset at the start of every create attempt.
  let cancelled = false;
  // If the component unmounts mid-request, treat it like a dismissal so we never
  // navigate from a disposed modal.
  onCleanup(() => {
    cancelled = true;
  });

  const dismiss = () => {
    cancelled = true;
    props.onClose();
    resetForm();
  };

  const handleCategoryChange = (c: AgentCategory) => {
    setCategory(c);
    setPlatform(PLATFORMS_BY_CATEGORY[c][0] ?? null);
  };

  const handleCreate = async () => {
    const agentName = name().trim();
    if (!agentName) return;
    cancelled = false;
    setCreating(true);
    try {
      const result = await createAgent({
        name: agentName,
        ...(category() ? { agent_category: category()! } : {}),
        ...(platform() ? { agent_platform: platform()! } : {}),
      });
      // The user dismissed the modal while the request was in flight — honour
      // that dismissal and skip every success side effect + the navigation.
      if (cancelled) return;
      toast.success(`Harness "${agentName}" connected`);
      props.onClose();
      resetForm();
      const slug = result?.agent?.name ?? agentName;
      markAgentCreated(slug);
      // Persistent flag so the setup modal reopens after a page refresh until
      // the user dismisses or completes it (the in-memory mark above is dropped
      // on reload / cleared by AgentGuard once the agent appears in the list).
      markSetupPending(slug);

      // Decide whether to nudge the user into connecting a provider. A brand-new
      // tenant has nothing routed yet, so we open the provider flow on landing.
      // A failed lookup must not block the redirect — fall back to "has none".
      let hasProviders = false;
      try {
        const res = await getGlobalProviders();
        hasProviders = (res?.providers?.length ?? 0) > 0;
      } catch {
        // Treat a failed providers lookup as "no providers" so onboarding still
        // surfaces the connect flow rather than silently skipping it.
      }

      // A dismissal during the providers lookup must also skip the redirect.
      if (cancelled) return;

      // Land on Routing either way; the new agent's API key is surfaced there.
      navigate(`/harnesses/${encodeURIComponent(slug)}/routing`, {
        state: {
          newApiKey: result?.apiKey,
          ...(hasProviders ? {} : { openProviders: true }),
        },
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
    if (e.key === 'Escape') dismiss();
  };

  return (
    <Show when={props.open}>
      <div class="modal-overlay" onClick={dismiss}>
        <div
          class="modal-card"
          style={atAgentLimit() ? 'max-width: 860px;' : 'max-width: 540px;'}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-agent-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <h2 class="modal-card__title" id="add-agent-title">
            Connect Harness
          </h2>
          <Show when={!atAgentLimit()} fallback={<UpgradePanel status={billing()!} />}>
            <p class="modal-card__desc">
              Name your harness to start tracking its LLM usage, costs, and messages in real time.
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
                  Harness name
                </label>
                <input
                  ref={(el) => requestAnimationFrame(() => el.focus())}
                  id="agent-name-input"
                  class="modal-card__input modal-card__input--lg"
                  type="text"
                  placeholder="e.g. My Cool Harness"
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
          </Show>
        </div>
      </div>
    </Show>
  );
};

export default AddAgentModal;

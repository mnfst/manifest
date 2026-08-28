import {
  createEffect,
  createResource,
  createSignal,
  onCleanup,
  Show,
  type Component,
} from 'solid-js';
import { useNavigate } from '@solidjs/router';
import AgentTypeSelect from './AgentTypeSelect.jsx';
import Select from './Select.jsx';
import MultiSelect from './MultiSelect.jsx';
import { createAgent, getGlobalProviders } from '../services/api.js';
import {
  assignNewAgent,
  checkAgentName,
  getProjects,
  getUsers,
  type AgentNameCheck,
} from '../services/api/teams.js';
import { toast } from '../services/toast-store.js';
import { markAgentCreated, markSetupPending } from '../services/recent-agents.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import { refreshAgents } from '../services/sse.js';
import { type AgentCategory, type AgentPlatform, PLATFORMS_BY_CATEGORY } from 'manifest-shared';

/**
 * "Connect Agent" modal extracted from Workspace so it can be reused by other
 * onboarding surfaces (e.g. an empty-state CTA or a deep-link).
 *
 * Onboarding navigation: a freshly created agent inherits access to every
 * connected provider, so Routing is the most useful first stop.
 * If the tenant has *no* providers yet, we additionally pass
 * `state.openProviders` so Routing opens the provider-connect flow immediately —
 * the new user's very next action is to connect their first provider.
 */
interface AddAgentModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fills the owner (a user page's "New agent" action). */
  defaultOwnerId?: string;
  /** Pre-fills the projects (a project page's "New agent" action). */
  defaultProjectIds?: string[];
}

const NAME_CHECK_DEBOUNCE_MS = 300;

const AddAgentModal: Component<AddAgentModalProps> = (props) => {
  const navigate = useNavigate();
  const [name, setName] = createSignal('');
  // Owner is chosen once, at creation. There is no reassignment afterwards:
  // past activity stays with whoever owned the agent when it ran, so handing
  // an agent over means archiving it and creating a fresh one.
  const [ownerId, setOwnerId] = createSignal(props.defaultOwnerId ?? '');
  const [projectIds, setProjectIds] = createSignal<string[]>(props.defaultProjectIds ?? []);
  const [users] = createResource(
    () => props.open,
    async (open) => {
      if (!open) return [];
      try {
        return (await getUsers()).users;
      } catch {
        return [];
      }
    },
  );
  const [projects] = createResource(
    () => props.open,
    async (open) => {
      if (!open) return [];
      try {
        return (await getProjects()).projects;
      } catch {
        return [];
      }
    },
  );
  // Names are unique per owner: two owners can each have a `claude-code`, one
  // owner cannot. A taken name is flagged here, with a free suggestion, and
  // an agent is never silently renamed after creation.
  const [nameCheck, setNameCheck] = createSignal<AgentNameCheck | null>(null);
  let checkTimer: ReturnType<typeof setTimeout> | undefined;
  let checkSeq = 0;
  createEffect(() => {
    const candidate = name().trim();
    const owner = ownerId() || null;
    if (checkTimer) clearTimeout(checkTimer);
    setNameCheck(null);
    if (!candidate) return;
    const seq = ++checkSeq;
    checkTimer = setTimeout(async () => {
      try {
        const result = await checkAgentName(candidate, owner);
        if (seq === checkSeq) setNameCheck(result ?? null);
      } catch {
        // A failed check must not block creation; the backend enforces uniqueness.
        if (seq === checkSeq) setNameCheck({ available: true, suggestion: null });
      }
    }, NAME_CHECK_DEBOUNCE_MS);
  });
  onCleanup(() => {
    if (checkTimer) clearTimeout(checkTimer);
  });
  const nameTaken = () => nameCheck()?.available === false;
  const [category, setCategory] = createSignal<AgentCategory | null>('personal');
  const [platform, setPlatform] = createSignal<AgentPlatform | null>(
    PLATFORMS_BY_CATEGORY['personal'][0] ?? null,
  );
  const [creating, setCreating] = createSignal(false);
  // Both default ON — explicit so create always sends a choice rather than
  // relying on the server-side inherit path (which is OFF for Autofix on
  // self-hosted).
  const [autofixEnabled, setAutofixEnabled] = createSignal(true);
  const [recordingEnabled, setRecordingEnabled] = createSignal(true);
  // Where the logs live depends on the deployment: self-hosted keeps them in
  // the operator's own database, cloud in the Manifest workspace.
  const [selfHosted] = createResource(checkIsSelfHosted);

  // Tracks whether the user dismissed the modal (overlay click / Escape) while a
  // create request was still in flight. A dismissed create must NOT run its
  // post-success side effects (toast, markAgentCreated) or navigate afterwards —
  // otherwise closing the modal mid-request still yanks the user to Routing once
  // the request resolves.
  let cancelled = false;
  // Monotonic id of the current create attempt. Each async hop re-checks the
  // token it started with, so a dismissed or superseded attempt drops its
  // result instead of acting on it.
  let attemptToken = 0;
  const beginAttempt = (): number => {
    cancelled = false;
    return ++attemptToken;
  };
  const isStale = (token: number): boolean => cancelled || token !== attemptToken;
  // Reopening invalidates whatever the previous session left in flight. The
  // success path closes the modal *before* awaiting the providers lookup, and
  // closing is not a dismissal — so a user who immediately reopens to add a
  // second agent would otherwise be yanked to the first one the moment that
  // lookup lands, mid-typing.
  createEffect(() => {
    if (props.open) {
      attemptToken++;
      // Follow the caller's defaults on every open: a user's Agents tab that
      // stays mounted while the route switches to another user must not keep
      // the previous owner.
      setOwnerId(props.defaultOwnerId ?? '');
      setProjectIds(props.defaultProjectIds ?? []);
    }
  });
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

  /**
   * @param token attempt id from {@link beginAttempt}, re-checked after every await.
   * @param autofixChoice the Autofix setting pinned when the submit started.
   */
  const createAgentNow = async (token: number, autofixChoice: boolean) => {
    const agentName = name().trim();
    if (!agentName) return;
    // Pinned now: the form resets as soon as the create succeeds.
    const owner = ownerId() || null;
    const chosenProjects = projectIds();
    setCreating(true);
    try {
      const result = await createAgent({
        name: agentName,
        ...(category() ? { agent_category: category()! } : {}),
        ...(platform() ? { agent_platform: platform()! } : {}),
        autofix_enabled: autofixChoice,
        record_messages: recordingEnabled(),
      });
      const slug = result?.agent?.name ?? agentName;
      // Attach owner and projects BEFORE anything refetches the agent lists, so
      // a user's Agents tab sees the new agent under its owner on the first
      // refresh. The agent already exists at this point, so a failure here is
      // a warning, not a failed create.
      try {
        await assignNewAgent(slug, owner, chosenProjects);
      } catch {
        toast.warning(`Agent "${slug}" was created but its owner and projects could not be saved.`);
      }
      // Local creates do not wait for the asynchronous server-sent event. This
      // immediately reruns every agent-list resource with fresh data.
      refreshAgents();
      // The user dismissed the modal while the request was in flight — honour
      // that dismissal and skip every success side effect + the navigation.
      if (isStale(token)) return;
      toast.success(`Agent "${agentName}" connected`);
      props.onClose();
      resetForm();
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
      if (isStale(token)) return;

      // Land on Routing either way; the new agent's API key is surfaced there.
      navigate(`/agents/${encodeURIComponent(slug)}/routing`, {
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

  const handleCreate = async () => {
    // A pending check does not block: the backend enforces uniqueness anyway.
    if (!name().trim() || nameTaken()) return;
    // A second submit while the create is already running would issue a
    // duplicate agent-creation request.
    if (creating()) return;
    // The legal line under the toggles is the consent act: the backend records
    // the install-level consent when the create carries autofix_enabled: true.
    await createAgentNow(beginAttempt(), autofixEnabled());
  };

  const resetForm = () => {
    setName('');
    setCategory('personal');
    setPlatform(PLATFORMS_BY_CATEGORY['personal'][0] ?? null);
    setAutofixEnabled(true);
    setRecordingEnabled(true);
    setOwnerId(props.defaultOwnerId ?? '');
    setProjectIds(props.defaultProjectIds ?? []);
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
          style="max-width: 540px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-agent-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <h2 class="modal-card__title" id="add-agent-title">
            New agent
          </h2>
          <p class="modal-card__desc">
            Name your agent to start tracking its LLM usage, costs and requests in real time.
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
                placeholder="e.g. claude-code"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                disabled={creating()}
                aria-invalid={nameTaken()}
              />
            </div>
          </div>
          {/* Below the Type + name row, so the hint never shifts the two columns. */}
          <div class="field" style="margin-top: var(--gap-xs);">
            <Show
              when={nameTaken()}
              fallback={
                <span class="field__hint">
                  Unique per owner. The owner's name never goes inside the agent name.
                </span>
              }
            >
              <span class="field__error" role="alert">
                {name().trim()} is already taken for this owner.{' '}
                <Show when={nameCheck()?.suggestion}>
                  <button
                    type="button"
                    class="field__suggestion"
                    onClick={() => setName(nameCheck()!.suggestion!)}
                  >
                    Use {nameCheck()!.suggestion}
                  </button>
                </Show>
              </span>
            </Show>
          </div>

          <div class="field">
            <label class="modal-card__field-label">Owner</label>
            <Select
              value={ownerId()}
              onChange={setOwnerId}
              label="Owner"
              disabled={creating()}
              options={[
                { label: 'No owner', value: '' },
                ...(users() ?? []).map((u) => ({ label: u.name, value: u.id })),
              ]}
            />
            <span class="field__hint">Optional. It can't be changed once set.</span>
          </div>
          <div class="field">
            <label class="modal-card__field-label">Projects</label>
            <MultiSelect
              values={projectIds()}
              onChange={setProjectIds}
              placeholder="No projects"
              label="Projects"
              options={(projects() ?? []).map((p) => ({ label: p.name, value: p.id }))}
            />
          </div>

          <div class="add-agent-toggles">
            <div class="model-params__group">
              {/* Same label treatment as the Type / Agent name field labels,
                  not the larger Model-params group header. */}
              <div class="modal-card__field-label add-agent-toggles__header">Settings</div>
              <div class="model-params__group-card">
                <div class="model-params__row">
                  <div class="model-params__row-text">
                    <div class="model-params__label-title">
                      <span>Autofix</span>
                    </div>
                    <div class="model-params__label-hint">
                      Repair eligible failing requests before falling back.
                    </div>
                  </div>
                  <div class="model-params__row-control">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autofixEnabled()}
                      aria-label="Autofix"
                      class="settings-switch"
                      classList={{ 'settings-switch--on': autofixEnabled() }}
                      disabled={creating()}
                      onClick={() => setAutofixEnabled(!autofixEnabled())}
                    >
                      <span class="settings-switch__track">
                        <span class="settings-switch__thumb" />
                      </span>
                    </button>
                  </div>
                </div>
                <div class="model-params__separator" />
                <div class="model-params__row">
                  <div class="model-params__row-text">
                    <div class="model-params__label-title">
                      <span>Enable logs</span>
                    </div>
                    <div class="model-params__label-hint">
                      See exactly what your agent sends on every attempt, and debug it faster.{' '}
                      {selfHosted.state === 'ready' &&
                        (selfHosted()
                          ? 'Logs stay in your own database.'
                          : 'Logs are stored in your Manifest workspace.')}
                    </div>
                  </div>
                  <div class="model-params__row-control">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={recordingEnabled()}
                      aria-label="Enable logs"
                      class="settings-switch"
                      classList={{ 'settings-switch--on': recordingEnabled() }}
                      disabled={creating()}
                      onClick={() => setRecordingEnabled(!recordingEnabled())}
                    >
                      <span class="settings-switch__track">
                        <span class="settings-switch__thumb" />
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Show when={autofixEnabled()}>
            <p class="autofix-consent__legal add-agent-legal">
              By enabling Autofix, you agree to Manifest&apos;s{' '}
              <a href="https://manifest.build/terms" target="_blank" rel="noopener noreferrer">
                Terms
              </a>{' '}
              and{' '}
              <a href="https://manifest.build/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              .
            </p>
          </Show>

          <div class="modal-card__footer">
            <button
              class="btn btn--primary btn--sm"
              onClick={handleCreate}
              disabled={!name().trim() || creating() || nameTaken()}
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

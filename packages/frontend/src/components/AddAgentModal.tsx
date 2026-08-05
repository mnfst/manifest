import { createSignal, onCleanup, Show, type Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Portal } from 'solid-js/web';
import AgentTypeSelect from './AgentTypeSelect.jsx';
import { createAgent, getGlobalProviders } from '../services/api.js';
import { getWorkspaceAutofixStatus } from '../services/api/analytics.js';
import { toast } from '../services/toast-store.js';
import { markAgentCreated, markSetupPending } from '../services/recent-agents.js';
import { refreshAgents } from '../services/sse.js';
import { useFocusTrap } from '../services/use-focus-trap.js';
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
  // Both default ON — explicit so create always sends a choice rather than
  // relying on the server-side inherit path (which is OFF for Auto-fix on
  // self-hosted).
  const [autofixEnabled, setAutofixEnabled] = createSignal(true);
  const [recordingEnabled, setRecordingEnabled] = createSignal(true);
  const [confirmingAutofix, setConfirmingAutofix] = createSignal(false);
  // The Auto-fix consent lookup is a second async hop, in front of the create.
  // Tracked separately from `creating()` so the form can be locked for its
  // duration without claiming a create is already under way.
  const [checkingConsent, setCheckingConsent] = createSignal(false);
  let autofixDialogRef: HTMLDivElement | undefined;
  useFocusTrap(confirmingAutofix, () => autofixDialogRef);

  // Tracks whether the user dismissed the modal (overlay click / Escape) while a
  // create request was still in flight. A dismissed create must NOT run its
  // post-success side effects (toast, markAgentCreated) or navigate afterwards —
  // otherwise closing the modal mid-request still yanks the user to Routing once
  // the request resolves.
  let cancelled = false;
  // Monotonic id of the current create attempt. `cancelled` alone cannot carry
  // this: the consent lookup awaits *before* createAgentNow(), so a dismissal
  // during the lookup was silently undone by the flag reset at the top of the
  // create and the harness was created and navigated to anyway. Each async hop
  // now re-checks the token it started with, so a dismissed or superseded
  // attempt drops its result instead of acting on it.
  let attemptToken = 0;
  const beginAttempt = (): number => {
    cancelled = false;
    return ++attemptToken;
  };
  const isStale = (token: number): boolean => cancelled || token !== attemptToken;
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
   * @param autofixChoice the Auto-fix setting the consent decision was made
   *   against — passed in rather than re-read, so the agent that gets created is
   *   the one the user was actually asked about.
   */
  const createAgentNow = async (token: number, autofixChoice: boolean) => {
    const agentName = name().trim();
    if (!agentName) return;
    setCreating(true);
    try {
      const result = await createAgent({
        name: agentName,
        ...(category() ? { agent_category: category()! } : {}),
        ...(platform() ? { agent_platform: platform()! } : {}),
        autofix_enabled: autofixChoice,
        record_messages: recordingEnabled(),
      });
      // Local creates do not wait for the asynchronous server-sent event. This
      // immediately reruns the sidebar's harness-list resource with fresh data.
      refreshAgents();
      // The user dismissed the modal while the request was in flight — honour
      // that dismissal and skip every success side effect + the navigation.
      if (isStale(token)) return;
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
      if (isStale(token)) return;

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

  const handleCreate = async () => {
    if (!name().trim()) return;
    // A second submit while the consent lookup or the create is already running
    // would issue a duplicate agent-creation request.
    if (creating() || checkingConsent()) return;
    const token = beginAttempt();
    // Freeze the choice the consent decision is made against. The toggles are
    // locked for the duration too, but pinning the value here is what
    // guarantees the dialog cannot promise to enable Auto-fix and then create a
    // harness with it off.
    const autofixChoice = autofixEnabled();
    if (autofixChoice) {
      let consented = false;
      setCheckingConsent(true);
      try {
        consented = (await getWorkspaceAutofixStatus()).consented;
      } catch {
        // Fail closed: if consent cannot be verified, ask before enabling.
      } finally {
        setCheckingConsent(false);
      }
      // Dismissed or superseded mid-lookup: drop the result rather than creating
      // a harness the user backed out of, or queueing the consent dialog to
      // appear the next time the modal opens.
      if (isStale(token)) return;
      if (!consented) {
        setConfirmingAutofix(true);
        return;
      }
    }
    await createAgentNow(token, autofixChoice);
  };

  const resetForm = () => {
    setName('');
    setCategory('personal');
    setPlatform(PLATFORMS_BY_CATEGORY['personal'][0] ?? null);
    setAutofixEnabled(true);
    setRecordingEnabled(true);
    setConfirmingAutofix(false);
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
          aria-hidden={confirmingAutofix() ? 'true' : undefined}
          aria-labelledby="add-agent-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <h2 class="modal-card__title" id="add-agent-title">
            Connect Harness
          </h2>
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
                disabled={creating() || checkingConsent()}
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
                disabled={creating() || checkingConsent()}
              />
            </div>
          </div>

          <div class="add-agent-toggles">
            <div class="settings-card__row">
              <div class="settings-card__label">
                <span class="settings-card__label-title">Auto-fix</span>
                <span class="settings-card__label-desc">
                  Repair eligible failing requests before falling back.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autofixEnabled()}
                aria-label="Auto-fix"
                class="settings-switch"
                classList={{ 'settings-switch--on': autofixEnabled() }}
                disabled={creating() || checkingConsent()}
                onClick={() => setAutofixEnabled(!autofixEnabled())}
              >
                <span class="settings-switch__track">
                  <span class="settings-switch__thumb" />
                </span>
              </button>
            </div>
            <div class="settings-card__row">
              <div class="settings-card__label">
                <span class="settings-card__label-title">Record messages</span>
                <span class="settings-card__label-desc">
                  Store request and response bodies for this harness.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={recordingEnabled()}
                aria-label="Record messages"
                class="settings-switch"
                classList={{ 'settings-switch--on': recordingEnabled() }}
                disabled={creating() || checkingConsent()}
                onClick={() => setRecordingEnabled(!recordingEnabled())}
              >
                <span class="settings-switch__track">
                  <span class="settings-switch__thumb" />
                </span>
              </button>
            </div>
          </div>

          <div class="modal-card__footer">
            <button
              class="btn btn--primary btn--sm"
              onClick={handleCreate}
              disabled={!name().trim() || creating() || checkingConsent()}
            >
              {creating() || checkingConsent() ? <span class="spinner" /> : 'Create'}
            </button>
          </div>
        </div>

        <Portal>
          <Show when={confirmingAutofix()}>
            <div
              class="modal-overlay"
              onClick={(event) => {
                if (event.target === event.currentTarget) setConfirmingAutofix(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setConfirmingAutofix(false);
              }}
            >
              <div
                ref={autofixDialogRef}
                class="modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-agent-autofix-consent-title"
                aria-describedby="create-agent-autofix-consent-description"
                style="max-width: 560px;"
              >
                <h2 class="modal-card__title" id="create-agent-autofix-consent-title">
                  Enable hosted Auto-fix?
                </h2>
                <p class="modal-card__desc" id="create-agent-autofix-consent-description">
                  Failed requests will be sent to Manifest Auto-fix for diagnosis and repair.
                  Provider authorization credentials are not sent. This enables Auto-fix for this
                  harness.{' '}
                  <a
                    href="https://manifest.build/docs/autofix/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    How Auto-fix works
                  </a>
                  .
                </p>
                <p class="autofix-consent__legal">
                  By enabling Auto-fix, you agree to Manifest&apos;s{' '}
                  <a href="https://manifest.build/terms" target="_blank" rel="noopener noreferrer">
                    Terms
                  </a>{' '}
                  and{' '}
                  <a
                    href="https://manifest.build/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
                <div class="modal-card__footer">
                  <button
                    type="button"
                    class="btn btn--outline btn--sm"
                    onClick={() => setConfirmingAutofix(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="btn btn--primary btn--sm"
                    disabled={creating() || checkingConsent()}
                    onClick={() => {
                      setConfirmingAutofix(false);
                      // Confirming consent starts a fresh attempt. Auto-fix is
                      // necessarily on — this dialog only appears for that case.
                      void createAgentNow(beginAttempt(), true);
                    }}
                  >
                    Agree &amp; create
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </Portal>
      </div>
    </Show>
  );
};

export default AddAgentModal;

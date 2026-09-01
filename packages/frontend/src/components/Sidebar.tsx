import { A, useLocation } from '@solidjs/router';
import { Show, For, createSignal, createResource, onCleanup, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getAgents } from '../services/api.js';
import { getBillingStatus } from '../services/api/billing.js';
import { getWorkspaceAutofixStatus, type AutofixStatus } from '../services/api/analytics.js';
import { updateAutofix } from '../services/api/routing.js';
import { FREE_REQUEST_LIMIT_LABEL } from '../services/billing-display.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import { agentPing, routingPing } from '../services/sse.js';
import { platformIcon } from 'manifest-shared';
import { useFocusTrap } from '../services/use-focus-trap.js';

interface SidebarProps {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

const AUTOFIX_CARD_DISMISSED_KEY = 'autofix-card-dismissed';

interface AgentItem {
  agent_name: string;
  display_name?: string;
  agent_platform?: string | null;
  agent_category?: string | null;
}

/**
 * Returns true when the given route matches the current location either
 * exactly or as a path prefix (so `/agents` stays active on `/agents/:name/*`).
 */
function makeIsGlobalActive(pathname: () => string) {
  return (route: string): boolean => {
    const p = pathname();
    return p === route || p.startsWith(route + '/');
  };
}

interface NavItem {
  label: string;
  href: string;
  /** Local providers only exist on self-hosted installs. */
  selfHostedOnly?: boolean;
}

/**
 * The nine fixed navigation entries. Navigation only: no agent list, no pinned
 * rows, no counts, so the sidebar is identical at five agents and at five
 * thousand. Depth lives in the header breadcrumb; search lives on each list
 * page.
 */
export const SIDEBAR_NAV: Array<{ section?: string; items: NavItem[] }> = [
  {
    items: [
      { label: 'Overview', href: '/overview' },
      { label: 'Requests', href: '/messages' },
    ],
  },
  {
    section: 'MANAGE',
    items: [
      { label: 'Users', href: '/users' },
      { label: 'Agents', href: '/agents' },
      { label: 'Projects', href: '/projects' },
    ],
  },
  {
    section: 'PROVIDERS',
    items: [
      { label: 'Usage-based', href: '/providers/usage-based' },
      { label: 'Subscriptions', href: '/providers/subscriptions' },
      { label: 'Local', href: '/providers/local', selfHostedOnly: true },
    ],
  },
  {
    section: 'TOOLS',
    items: [{ label: 'Playground', href: '/playground' }],
  },
];

const Sidebar: Component<SidebarProps> = (props) => {
  const location = useLocation();
  const isGlobalActive = makeIsGlobalActive(() => location.pathname);
  // Poll every 15s to catch autofix toggle changes (no SSE for this mutation).
  const [autofixTick, setAutofixTick] = createSignal(0);
  const autofixInterval = setInterval(() => setAutofixTick((n) => n + 1), 15_000);
  onCleanup(() => clearInterval(autofixInterval));
  // Fail soft: a status-fetch blip must not take down the whole authenticated
  // shell or surface the Autofix card without knowing which agents need it.
  // On a failed poll tick, keep the last known status instead of blanking it —
  // the empty fallback only applies to the very first load.
  const [autofixStatus, { mutate: mutateAutofixStatus }] = createResource(
    () => ({ _a: agentPing(), _r: routingPing(), _t: autofixTick() }),
    async (_src, { value }): Promise<AutofixStatus> => {
      try {
        return await getWorkspaceAutofixStatus();
      } catch {
        return (
          value ?? {
            any_enabled: false,
            enabled_agents: [],
            disabled_agents: [],
            needs_enable_all: false,
            consented: false,
          }
        );
      }
    },
  );
  const [confirmingAutofix, setConfirmingAutofix] = createSignal(false);
  // Dismissal only lasts the browser session: as long as some agents run
  // without Autofix the card comes back next session.
  const [autofixCardDismissed, setAutofixCardDismissed] = createSignal(
    sessionStorage.getItem(AUTOFIX_CARD_DISMISSED_KEY) === '1',
  );
  const dismissAutofixCard = () => {
    sessionStorage.setItem(AUTOFIX_CARD_DISMISSED_KEY, '1');
    setAutofixCardDismissed(true);
  };
  const showAutofixCard = () =>
    !autofixCardDismissed() && (autofixStatus()?.disabled_agents.length ?? 0) > 0;
  let autofixDialogRef: HTMLDivElement | undefined;
  useFocusTrap(confirmingAutofix, () => autofixDialogRef);

  // The modal lists the agents captured when it opens (a snapshot: rows never
  // jump away mid-interaction) with one independent toggle per agent. The
  // agent list is fetched on open only; the sidebar no longer keeps one.
  const [modalAgents, setModalAgents] = createSignal<
    { name: string; display: string; icon?: string }[]
  >([]);
  const [agentToggles, setAgentToggles] = createSignal<
    Record<string, { on: boolean; saving: boolean }>
  >({});
  const openAutofixModal = async () => {
    let list: AgentItem[] = [];
    try {
      const data = (await getAgents()) as { agents?: AgentItem[] } | AgentItem[] | null;
      list = Array.isArray(data) ? data : (data?.agents ?? []);
    } catch {
      list = [];
    }
    const known = new Map(list.map((agent) => [agent.agent_name, agent]));
    const snapshot = (autofixStatus()?.disabled_agents ?? []).map((name) => {
      const agent = known.get(name);
      return {
        name,
        display: agent?.display_name || name,
        icon: agent ? platformIcon(agent.agent_platform, agent.agent_category) : undefined,
      };
    });
    setModalAgents(snapshot);
    setAgentToggles(
      Object.fromEntries(snapshot.map((agent) => [agent.name, { on: false, saving: false }])),
    );
    setConfirmingAutofix(true);
  };

  // Keep the card's own condition in sync after each saved toggle so it
  // disappears the moment the last agent gets covered.
  const applyStatusChange = (name: string, enabled: boolean) => {
    const status = autofixStatus();
    if (!status) return;
    const enabledSet = new Set(status.enabled_agents);
    const disabledSet = new Set(status.disabled_agents);
    if (enabled) {
      enabledSet.add(name);
      disabledSet.delete(name);
    } else {
      enabledSet.delete(name);
      disabledSet.add(name);
    }
    mutateAutofixStatus({
      ...status,
      any_enabled: enabledSet.size > 0,
      enabled_agents: [...enabledSet],
      disabled_agents: [...disabledSet],
    });
  };

  // Optimistic per-agent save. Each row saves independently, so the user can
  // flip several toggles without waiting; a failed save reverts its own row
  // (fetchMutate already surfaced the error as a toast).
  const toggleModalAgent = async (name: string) => {
    const current = agentToggles()[name];
    if (!current || current.saving) return;
    const next = !current.on;
    setAgentToggles((all) => ({ ...all, [name]: { on: next, saving: true } }));
    try {
      await updateAutofix(name, { enabled: next });
      setAgentToggles((all) => ({ ...all, [name]: { on: next, saving: false } }));
      applyStatusChange(name, next);
    } catch {
      setAgentToggles((all) => ({ ...all, [name]: { on: !next, saving: false } }));
    }
  };
  const [selfHosted] = createResource(checkIsSelfHosted);
  const [billing] = createResource(async () => {
    try {
      return await getBillingStatus();
    } catch {
      return null;
    }
  });
  const showUpgrade = () => billing()?.enabled && billing()?.plan === 'free';
  const requestLimitLabel = () =>
    billing()?.requests.limit?.toLocaleString('en-US') ?? FREE_REQUEST_LIMIT_LABEL;

  const handleNav = () => {
    props.onNavigate?.();
    window.dispatchEvent(new CustomEvent('sidebar-navigate'));
  };

  return (
    <nav
      id="agent-navigation"
      class="sidebar"
      classList={{ 'sidebar--mobile-open': props.mobileOpen === true }}
      aria-label="Navigation"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a.sidebar__link')) {
          handleNav();
        }
      }}
    >
      <For each={SIDEBAR_NAV}>
        {(group) => (
          <>
            <Show when={group.section}>
              <div class="sidebar__section-label">{group.section}</div>
            </Show>
            <For each={group.items}>
              {(item) => (
                <Show when={!item.selfHostedOnly || selfHosted()}>
                  <A
                    href={item.href}
                    class="sidebar__link"
                    classList={{ active: isGlobalActive(item.href) }}
                    aria-current={isGlobalActive(item.href) ? 'page' : undefined}
                  >
                    {item.label}
                  </A>
                </Show>
              )}
            </For>
          </>
        )}
      </For>

      <div class="sidebar__spacer" />

      {/* The Autofix card shows in every deployment mode while at least one
          agent runs without Autofix, unless dismissed for this session. */}
      <Show when={showAutofixCard()}>
        <div class="sidebar-autofix">
          <div class="sidebar-autofix__header">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
              <path d="M12.28 8.82 12 9.1l-.28-.28c-1.09-1.1-2.81-1.1-3.91 0a2.794 2.794 0 0 0 0 3.95L11.99 17l4.18-4.23a2.794 2.794 0 0 0 0-3.95 2.73 2.73 0 0 0-3.91 0Z" />
            </svg>
            <span class="sidebar-autofix__title">Keep your agents reliable</span>
            <button
              type="button"
              class="sidebar-autofix__dismiss"
              title="Hide for this session"
              aria-label="Hide the Autofix card for this session"
              onClick={dismissAutofixCard}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m16.192 6.344-4.243 4.242-4.242-4.242-1.414 1.414L10.535 12l-4.242 4.242 1.414 1.414 4.242-4.242 4.243 4.242 1.414-1.414L13.364 12l4.242-4.242z" />
              </svg>
            </button>
          </div>
          <p class="sidebar-autofix__desc">
            At least one of your agents runs without Autofix. Enable it to repair eligible failing
            requests before they reach the model.
          </p>
          <button
            type="button"
            class="sidebar-autofix__btn"
            onClick={() => void openAutofixModal()}
          >
            Enable
          </button>
        </div>
      </Show>

      <Show when={!selfHosted() && showUpgrade()}>
        <div class="sidebar-usage">
          <span class="sidebar-usage__title">
            {new Date().toLocaleDateString('en-US', { month: 'long' })} usage
          </span>
          <span
            class="sidebar-usage__count"
            classList={{
              'sidebar-usage__count--danger':
                (billing()!.requests.used ?? 0) / (billing()!.requests.limit ?? 1) >= 0.8,
            }}
          >
            {billing()!.requests.used != null
              ? billing()!.requests.used!.toLocaleString('en-US')
              : '0'}
            {' / '}
            {billing()!.requests.limit != null
              ? billing()!.requests.limit!.toLocaleString('en-US')
              : '0'}
            {' requests'}
          </span>
          <div class="sidebar-usage__bar">
            <div
              class="sidebar-usage__fill"
              classList={{
                'sidebar-usage__fill--warning':
                  (billing()!.requests.used ?? 0) / (billing()!.requests.limit ?? 1) >= 0.5 &&
                  (billing()!.requests.used ?? 0) / (billing()!.requests.limit ?? 1) < 0.8,
                'sidebar-usage__fill--danger':
                  (billing()!.requests.used ?? 0) / (billing()!.requests.limit ?? 1) >= 0.8,
              }}
              style={{
                width: `${Math.min(100, ((billing()!.requests.used ?? 0) / (billing()!.requests.limit ?? 1)) * 100)}%`,
              }}
            />
          </div>
          <Show when={(billing()!.requests.used ?? 0) / (billing()!.requests.limit ?? 1) >= 0.8}>
            <p class="sidebar-usage__alert">
              {(billing()!.requests.used ?? 0) >= (billing()!.requests.limit ?? 1)
                ? "You've reached your monthly limit. Requests are being blocked."
                : `You're limited to ${requestLimitLabel()} requests this month. Upgrade for unlimited.`}
            </p>
          </Show>
        </div>
        <A href="/upgrade" class="sidebar-upgrade" onClick={handleNav}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2m0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8" />
            <path d="m8 12 1.41 1.41L11 11.83V17h2v-5.17l1.59 1.59L16 12l-4-4z" />
          </svg>
          Upgrade plan
        </A>
      </Show>

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
              aria-labelledby="sidebar-autofix-consent-title"
              aria-describedby="sidebar-autofix-consent-description"
              style="max-width: 560px;"
            >
              <h2 class="modal-card__title" id="sidebar-autofix-consent-title">
                Enable Autofix
              </h2>
              <p class="modal-card__desc" id="sidebar-autofix-consent-description">
                Failed requests will be sent to Manifest Autofix for diagnosis and repair. Provider
                authorization credentials are not sent. Autofix works per agent, so turn it on for
                each agent below.{' '}
                <a
                  href="https://manifest.build/docs/autofix/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  How Autofix works
                </a>
                .
              </p>
              <div class="autofix-consent__agents-label">Agents</div>
              <div class="autofix-consent__agents">
                <For each={modalAgents()}>
                  {(agent) => (
                    <div class="autofix-consent__agent-row">
                      <Show when={agent.icon}>
                        <img src={agent.icon} alt="" class="autofix-consent__agent-icon" />
                      </Show>
                      <span class="autofix-consent__agent-name">{agent.display}</span>
                      {/* aria-disabled, not disabled: disabling the focused
                          switch would drop focus to <body> and escape the
                          modal's focus trap; toggleModalAgent guards re-entry. */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={agentToggles()[agent.name]?.on === true}
                        aria-label={`Autofix for ${agent.display}`}
                        class="settings-switch"
                        classList={{
                          'settings-switch--on': agentToggles()[agent.name]?.on === true,
                        }}
                        aria-disabled={agentToggles()[agent.name]?.saving === true}
                        onClick={() => void toggleModalAgent(agent.name)}
                      >
                        <span class="settings-switch__track">
                          <span class="settings-switch__thumb" />
                        </span>
                      </button>
                    </div>
                  )}
                </For>
              </div>
              <p class="autofix-consent__legal">
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
              <div class="modal-card__footer">
                <button
                  type="button"
                  class="btn btn--primary btn--sm"
                  onClick={() => setConfirmingAutofix(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </Show>
      </Portal>
    </nav>
  );
};

export default Sidebar;

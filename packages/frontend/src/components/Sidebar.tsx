import { A, useLocation } from '@solidjs/router';
import { Show, For, createSignal, createResource, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useAgentName } from '../services/routing.js';
import { getAgents } from '../services/api.js';
import { getBillingStatus } from '../services/api/billing.js';
import {
  enableAutofixForAllAgents,
  getWorkspaceAutofixStatus,
} from '../services/api/analytics.js';
import { FREE_REQUEST_LIMIT_LABEL } from '../services/billing-display.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import { agentPing } from '../services/sse.js';
import { platformIcon } from 'manifest-shared';
import { useFocusTrap } from '../services/use-focus-trap.js';
import { toast } from '../services/toast-store.js';
import AddAgentModal from './AddAgentModal.jsx';

interface SidebarProps {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

interface HarnessItem {
  agent_name: string;
  display_name?: string;
  agent_platform?: string | null;
  agent_category?: string | null;
}

/**
 * Returns true when the given route matches the current location either
 * exactly or as a path prefix (so `/harnesses` stays active on `/harnesses/:name/*`).
 */
function makeIsGlobalActive(pathname: () => string) {
  return (route: string): boolean => {
    const p = pathname();
    return p === route || p.startsWith(route + '/');
  };
}

const Sidebar: Component<SidebarProps> = (props) => {
  const location = useLocation();
  const isGlobalActive = makeIsGlobalActive(() => location.pathname);
  const getAgentName = useAgentName();
  const [agentsCollapsed, setAgentsCollapsed] = createSignal(false);
  const [addModalOpen, setAddModalOpen] = createSignal(false);
  // Fail soft: a status-fetch blip must not take down the whole authenticated
  // shell. Treat errors as "nothing enabled, not consented" so the CTA still
  // renders and the user can recover by enabling.
  const [autofixStatus, { mutate: mutateAutofixStatus }] = createResource(
    async () => {
      try {
        return await getWorkspaceAutofixStatus();
      } catch {
        return { any_enabled: false, enabled_agents: [], consented: false };
      }
    },
  );
  const [confirmingAutofix, setConfirmingAutofix] = createSignal(false);
  const [enablingAutofix, setEnablingAutofix] = createSignal(false);
  let autofixDialogRef: HTMLDivElement | undefined;
  useFocusTrap(confirmingAutofix, () => autofixDialogRef);

  const runEnableAll = async () => {
    setEnablingAutofix(true);
    try {
      mutateAutofixStatus(await enableAutofixForAllAgents());
      toast.success('Auto-fix enabled for all agents');
    } catch {
      // fetchMutate already toasts
    } finally {
      setEnablingAutofix(false);
    }
  };
  // Local providers only exist on self-hosted installs — a cloud backend
  // can't reach the user's localhost, so the Local entry is hidden there.
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

  // Harness list for the in-nav switcher. Refetches whenever the agent SSE ping
  // fires (create/delete/rename). Uses the DEFAULT getAgents() — playground agents
  // (the reserved Playground) are excluded so they never leak into the switcher.
  const [agents] = createResource(
    () => agentPing(),
    async (): Promise<HarnessItem[]> => {
      try {
        const data = (await getAgents()) as { agents?: HarnessItem[] } | HarnessItem[] | null;
        if (Array.isArray(data)) return data;
        return data?.agents ?? [];
      } catch {
        return [];
      }
    },
  );

  const currentAgent = () => getAgentName();

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
      <A
        href="/overview"
        class="sidebar__link"
        classList={{ active: isGlobalActive('/overview') }}
        aria-current={isGlobalActive('/overview') ? 'page' : undefined}
      >
        Overview
      </A>
      <A
        href="/messages"
        class="sidebar__link"
        classList={{ active: isGlobalActive('/messages') }}
        aria-current={isGlobalActive('/messages') ? 'page' : undefined}
      >
        Requests
      </A>
      <div class="sidebar__section-label">PROVIDERS</div>
      <Show when={selfHosted()}>
        <A
          href="/providers/local"
          class="sidebar__link"
          classList={{ active: isGlobalActive('/providers/local') }}
          aria-current={isGlobalActive('/providers/local') ? 'page' : undefined}
        >
          Local
        </A>
      </Show>
      <A
        href="/providers/usage-based"
        class="sidebar__link"
        classList={{ active: isGlobalActive('/providers/usage-based') }}
        aria-current={isGlobalActive('/providers/usage-based') ? 'page' : undefined}
      >
        Usage-based
      </A>
      <A
        href="/providers/subscriptions"
        class="sidebar__link"
        classList={{ active: isGlobalActive('/providers/subscriptions') }}
        aria-current={isGlobalActive('/providers/subscriptions') ? 'page' : undefined}
      >
        Subscriptions
      </A>

      {/* Harnesses — collapsible section with a + create button.
          The collapse toggle and the create button are sibling buttons (never
          nested) so both are independently keyboard-operable. */}
      <div class="sidebar__section-header">
        <button
          type="button"
          class="sidebar__section-caret"
          onClick={() => setAgentsCollapsed(!agentsCollapsed())}
          aria-expanded={!agentsCollapsed()}
        >
          <span>HARNESSES</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={{
              transition: 'transform 150ms',
              transform: agentsCollapsed() ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
        <button
          type="button"
          class="sidebar__section-add"
          title="Create new harness"
          aria-label="Create new harness"
          onClick={() => setAddModalOpen(true)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M19 12.998h-6v6h-2v-6H5v-2h6v-6h2v6h6z" />
          </svg>
        </button>
      </div>

      <Show when={!agentsCollapsed()}>
        <div class="sidebar__agents-list">
          <For
            each={agents() ?? []}
            fallback={
              <Show when={!agents.loading}>
                <div class="sidebar__agents-empty">No harnesses yet</div>
              </Show>
            }
          >
            {(agent) => {
              const name = () => agent.agent_name;
              const display = () => agent.display_name || agent.agent_name;
              const icon = () => platformIcon(agent.agent_platform, agent.agent_category);
              const isSelected = () => currentAgent() === name();
              return (
                <A
                  href={`/harnesses/${encodeURIComponent(name())}`}
                  class="sidebar__agent-item"
                  classList={{ 'sidebar__agent-item--active': isSelected() }}
                  aria-current={isSelected() ? 'page' : undefined}
                  onClick={handleNav}
                >
                  <Show when={icon()}>
                    <img src={icon()} alt="" class="sidebar__agent-icon" />
                  </Show>
                  <span class="sidebar__agent-item-name">{display()}</span>
                </A>
              );
            }}
          </For>
        </div>
      </Show>

      <div class="sidebar__section-label">TOOLS</div>
      <A
        href="/playground"
        class="sidebar__link"
        classList={{ active: isGlobalActive('/playground') }}
        aria-current={isGlobalActive('/playground') ? 'page' : undefined}
      >
        Playground
      </A>

      <div class="sidebar__spacer" />

      {/* Self-hosted: Auto-fix CTA always owns the bottom-left slot.
          Cloud free plan: usage meter. Cloud paid: empty. */}
      <Show when={selfHosted()}>
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
            <span class="sidebar-autofix__title">
              {autofixStatus()?.any_enabled || autofixStatus()?.consented
                ? 'Auto-fix'
                : 'Discover Auto-fix'}
            </span>
          </div>
          <p class="sidebar-autofix__desc">
            {autofixStatus()?.any_enabled
              ? 'Auto-fix is repairing eligible failing requests before they reach the model.'
              : 'Auto-fix can repair eligible failing requests before they reach the model.'}
          </p>
          <Show
            when={!autofixStatus.loading && !autofixStatus()?.any_enabled}
            fallback={
              <a
                class="sidebar-autofix__btn"
                href="https://manifest.build/docs/autofix/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more
              </a>
            }
          >
            <button
              type="button"
              class="sidebar-autofix__btn"
              disabled={enablingAutofix()}
              onClick={() => {
                if (!autofixStatus()?.consented) {
                  setConfirmingAutofix(true);
                  return;
                }
                void runEnableAll();
              }}
            >
              {enablingAutofix() ? 'Enabling…' : 'Enable'}
            </button>
          </Show>
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

      {/* Create-harness modal, opened by the HARNESSES section + button */}
      <AddAgentModal open={addModalOpen()} onClose={() => setAddModalOpen(false)} />

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
                Enable hosted Auto-fix?
              </h2>
              <p class="modal-card__desc" id="sidebar-autofix-consent-description">
                Failed requests will be sent to Manifest Auto-fix for diagnosis and repair. Provider
                authorization credentials are not sent. This enables Auto-fix for every agent in your
                workspace.{' '}
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
                <a href="https://manifest.build/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
                .
              </p>
              <div class="modal-card__footer">
                <button
                  type="button"
                  class="btn btn--ghost btn--sm"
                  onClick={() => setConfirmingAutofix(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn--primary btn--sm"
                  disabled={enablingAutofix()}
                  onClick={() => {
                    setConfirmingAutofix(false);
                    void runEnableAll();
                  }}
                >
                  Agree &amp; enable Auto-fix
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

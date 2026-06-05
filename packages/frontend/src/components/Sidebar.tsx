import { A, useLocation } from '@solidjs/router';
import { Show, For, createSignal, createResource, type Component } from 'solid-js';
import { useAgentName } from '../services/routing.js';
import { getAgents } from '../services/api.js';
import { agentPing } from '../services/sse.js';
import { platformIcon } from 'manifest-shared';
import AddAgentModal from './AddAgentModal.jsx';

interface SidebarProps {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

const Sidebar: Component<SidebarProps> = (props) => {
  const location = useLocation();
  const getAgentName = useAgentName();
  const [agentsCollapsed, setAgentsCollapsed] = createSignal(false);
  const [addModalOpen, setAddModalOpen] = createSignal(false);

  const [agents] = createResource(
    () => agentPing(),
    async () => {
      try {
        const data = await getAgents();
        return (data as any)?.agents ?? data ?? [];
      } catch {
        return [];
      }
    },
  );

  const currentAgent = () => getAgentName();

  const isGlobalActive = (route: string) => {
    return location.pathname === route || location.pathname.startsWith(route + '/');
  };

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
        if ((event.target as HTMLElement).closest('a.sidebar__link')) handleNav();
      }}
    >
      {/* Dashboard */}
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
        Messages
      </A>

      {/* Providers */}
      <div class="sidebar__section-label">PROVIDERS</div>
      <A
        href="/providers/subscriptions"
        class="sidebar__link"
        classList={{ active: isGlobalActive('/providers/subscriptions') }}
        aria-current={isGlobalActive('/providers/subscriptions') ? 'page' : undefined}
      >
        Subscriptions
      </A>
      <A
        href="/providers/byok"
        class="sidebar__link"
        classList={{ active: isGlobalActive('/providers/byok') }}
        aria-current={isGlobalActive('/providers/byok') ? 'page' : undefined}
      >
        BYOK
      </A>
      <A
        href="/providers/local"
        class="sidebar__link"
        classList={{ active: isGlobalActive('/providers/local') }}
        aria-current={isGlobalActive('/providers/local') ? 'page' : undefined}
      >
        Local
      </A>

      {/* Agents — collapsible section with + button */}
      <div
        class="sidebar__section-label sidebar__section-label--interactive"
        style="cursor: pointer;"
        onClick={() => setAgentsCollapsed(!agentsCollapsed())}
      >
        <div class="sidebar__section-label-left">
          <span>HARNESSES</span>
          <button
            type="button"
            class="sidebar__section-add"
            title="Create new harness"
            onClick={(e) => {
              e.stopPropagation();
              setAddModalOpen(true);
            }}
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
        <button
          type="button"
          class="sidebar__section-caret"
          onClick={(e) => {
            e.stopPropagation();
            setAgentsCollapsed(!agentsCollapsed());
          }}
          aria-expanded={!agentsCollapsed()}
          aria-label={agentsCollapsed() ? 'Expand harnesses' : 'Collapse harnesses'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            fill="currentColor"
            viewBox="0 0 24 24"
            style={{
              transition: 'transform 150ms',
              transform: agentsCollapsed() ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
      </div>

      <Show when={!agentsCollapsed()}>
        <div class="sidebar__agents-list">
          <For each={agents() ?? []}>
            {(agent: any) => {
              const name = () => agent.agent_name;
              const display = () => agent.display_name || agent.agent_name;
              const icon = () => platformIcon(agent.agent_platform, agent.agent_category);
              const isSelected = () => currentAgent() === name();
              return (
                <A
                  href={`/agents/${name()}`}
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

      {/* Tools */}
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

      <a
        href="https://github.com/mnfst/manifest/discussions/new?category=feature-request"
        target="_blank"
        rel="noopener noreferrer"
        class="sidebar__feedback"
      >
        <span class="sidebar__feedback-title">
          <i class="bxd bx-message-bubble-detail" />
          Feedback
        </span>
      </a>

      {/* Add Agent Modal */}
      <AddAgentModal open={addModalOpen()} onClose={() => setAddModalOpen(false)} />
    </nav>
  );
};

export default Sidebar;

import { A, useLocation } from '@solidjs/router';
import { For, Show, type Component } from 'solid-js';
import {
  SIDEBAR_BLOCKS,
  SIDEBAR_BLOCK_IDS,
  SIDEBAR_ITEM_LABELS,
  SIDEBAR_ITEM_PATHS,
  type SidebarItemId,
} from '../services/sidebar-nav.js';
import { isSidebarBlockShown, isSidebarItemVisible } from '../services/sidebar-preferences.js';
import { agentPath, useAgentName } from '../services/routing.js';

interface SidebarProps {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

const Sidebar: Component<SidebarProps> = (props) => {
  const location = useLocation();
  const getAgentName = useAgentName();

  const path = (sub: string) => agentPath(getAgentName(), sub);

  const isActive = (sub: string) => {
    const p = path(sub);
    if (sub === '') return location.pathname === p;
    return location.pathname.startsWith(p);
  };

  return (
    <nav
      id="agent-navigation"
      class="sidebar"
      classList={{ 'sidebar--mobile-open': props.mobileOpen === true }}
      aria-label="Agent navigation"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a.sidebar__link')) {
          props.onNavigate?.();
          window.dispatchEvent(new CustomEvent('sidebar-navigate'));
        }
      }}
    >
      <Show when={!getAgentName()}>
        <A
          href="/"
          class="sidebar__link"
          classList={{ active: location.pathname === '/' }}
          aria-current={location.pathname === '/' ? 'page' : undefined}
        >
          Agents
        </A>
      </Show>

      <Show when={getAgentName()}>
        <For each={SIDEBAR_BLOCK_IDS.filter((id) => id !== 'feedback')}>
          {(blockId) => (
            <Show when={isSidebarBlockShown(blockId)}>
              <div class="sidebar__section-label">{SIDEBAR_BLOCKS[blockId].label}</div>
              <For each={[...SIDEBAR_BLOCKS[blockId].items]}>
                {(itemId) => (
                  <Show when={isSidebarItemVisible(itemId)}>
                    <A
                      href={path(SIDEBAR_ITEM_PATHS[itemId as Exclude<SidebarItemId, 'feedback'>])}
                      class="sidebar__link"
                      classList={{
                        active: isActive(
                          SIDEBAR_ITEM_PATHS[itemId as Exclude<SidebarItemId, 'feedback'>],
                        ),
                      }}
                      aria-current={
                        isActive(SIDEBAR_ITEM_PATHS[itemId as Exclude<SidebarItemId, 'feedback'>])
                          ? 'page'
                          : undefined
                      }
                    >
                      <Show when={itemId === 'free-models'} fallback={SIDEBAR_ITEM_LABELS[itemId]}>
                        <img
                          src="/icons/free.svg"
                          alt="Free Models"
                          style="height: 12px; vertical-align: middle;"
                        />{' '}
                        Models
                      </Show>
                    </A>
                  </Show>
                )}
              </For>
            </Show>
          )}
        </For>
      </Show>

      <div class="sidebar__spacer" />

      <Show when={getAgentName() && isSidebarItemVisible('feedback')}>
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
          <p class="sidebar__feedback-hint">Share ideas or report bugs.</p>
        </a>
      </Show>
    </nav>
  );
};

export default Sidebar;

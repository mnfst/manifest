import { A, useLocation } from '@solidjs/router';
import type { Component } from 'solid-js';

interface SidebarProps {
  mobileOpen?: boolean;
  onNavigate?: () => void;
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

const Sidebar: Component<SidebarProps> = (props) => {
  const location = useLocation();
  const isGlobalActive = makeIsGlobalActive(() => location.pathname);

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
      <div class="sidebar__section-label">AGENTS</div>
      <A
        href="/agents"
        class="sidebar__link"
        classList={{ active: isGlobalActive('/agents') }}
        aria-current={isGlobalActive('/agents') ? 'page' : undefined}
      >
        Agents
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
        <p class="sidebar__feedback-hint">Share ideas or report bugs.</p>
      </a>
    </nav>
  );
};

export default Sidebar;

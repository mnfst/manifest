import { A, useLocation } from '@solidjs/router';
import { type Component } from 'solid-js';

interface SidebarProps {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

const Sidebar: Component<SidebarProps> = (props) => {
  const location = useLocation();

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
      <A
        href="/agents"
        class="sidebar__link"
        classList={{
          active: location.pathname === '/agents' || location.pathname.startsWith('/agents/'),
        }}
        aria-current={
          location.pathname === '/agents' || location.pathname.startsWith('/agents/')
            ? 'page'
            : undefined
        }
      >
        Agents
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

      <div class="sidebar__divider" />
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
    </nav>
  );
};

export default Sidebar;

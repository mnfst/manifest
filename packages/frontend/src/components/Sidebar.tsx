import { A, useLocation } from '@solidjs/router';
import { Show, type Component } from 'solid-js';
import { useAgentName, agentPath } from '../services/routing.js';

const Sidebar: Component = () => {
  const location = useLocation();
  const getAgentName = useAgentName();

  const path = (sub: string) => agentPath(getAgentName(), sub);

  const isActive = (sub: string) => {
    const p = path(sub);
    if (sub === '') return location.pathname === p;
    return location.pathname.startsWith(p);
  };

  return (
    <nav class="sidebar" aria-label="Agent navigation">
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
        <div class="sidebar__section-label">MONITORING</div>
        <A
          href={path('')}
          class="sidebar__link"
          classList={{ active: isActive('') }}
          aria-current={isActive('') ? 'page' : undefined}
        >
          Overview
        </A>
        <A
          href={path('/messages')}
          class="sidebar__link"
          classList={{ active: isActive('/messages') }}
          aria-current={isActive('/messages') ? 'page' : undefined}
        >
          Messages
        </A>

        <div class="sidebar__section-label">MANAGE</div>
        <A
          href={path('/routing')}
          class="sidebar__link"
          classList={{ active: isActive('/routing') }}
          aria-current={isActive('/routing') ? 'page' : undefined}
        >
          Routing
        </A>
        <A
          href={path('/limits')}
          class="sidebar__link"
          classList={{ active: isActive('/limits') }}
          aria-current={isActive('/limits') ? 'page' : undefined}
        >
          Limits
        </A>
        <A
          href={path('/settings')}
          class="sidebar__link"
          classList={{ active: isActive('/settings') }}
          aria-current={isActive('/settings') ? 'page' : undefined}
        >
          Settings
        </A>
      </Show>

      <Show when={getAgentName()}>
        <div class="sidebar__section-label">RESOURCES</div>
        <A
          href={path('/model-prices')}
          class="sidebar__link"
          classList={{ active: isActive('/model-prices') }}
          aria-current={isActive('/model-prices') ? 'page' : undefined}
        >
          Model Prices
        </A>
        <A
          href={path('/free-models')}
          class="sidebar__link"
          classList={{ active: isActive('/free-models') }}
          aria-current={isActive('/free-models') ? 'page' : undefined}
        >
          <img
            src="/icons/free.svg"
            alt="Free Models"
            style="height: 12px; vertical-align: middle;"
          />{' '}
          Models
        </A>
        <A
          href={path('/help')}
          class="sidebar__link"
          classList={{ active: isActive('/help') }}
          aria-current={isActive('/help') ? 'page' : undefined}
        >
          Help
        </A>
      </Show>

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

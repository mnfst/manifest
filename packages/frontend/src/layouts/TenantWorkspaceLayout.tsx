import { A, useLocation } from '@solidjs/router';
import type { ParentComponent } from 'solid-js';

const TenantWorkspaceLayout: ParentComponent = (props) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const isProviderActive = (path: string) =>
    location.pathname === path ||
    (path === '/providers/subscriptions' && location.pathname === '/providers');

  return (
    <div class="tenant-workspace">
      <nav class="tenant-workspace__sidebar" aria-label="Workspace navigation">
        <A
          href="/"
          class="tenant-workspace__link"
          classList={{ active: isActive('/') }}
          aria-current={isActive('/') ? 'page' : undefined}
        >
          My Agents
        </A>
        <div class="tenant-workspace__section" aria-label="Providers">
          <div class="tenant-workspace__section-title">Providers</div>
          <A
            href="/providers/subscriptions"
            class="tenant-workspace__link tenant-workspace__link--nested"
            classList={{ active: isProviderActive('/providers/subscriptions') }}
            aria-current={isProviderActive('/providers/subscriptions') ? 'page' : undefined}
          >
            Subscriptions
          </A>
          <A
            href="/providers/byok"
            class="tenant-workspace__link tenant-workspace__link--nested"
            classList={{ active: isActive('/providers/byok') }}
            aria-current={isActive('/providers/byok') ? 'page' : undefined}
          >
            Bring Your Own Key
          </A>
          <A
            href="/providers/local"
            class="tenant-workspace__link tenant-workspace__link--nested"
            classList={{ active: isActive('/providers/local') }}
            aria-current={isActive('/providers/local') ? 'page' : undefined}
          >
            Local
          </A>
        </div>
      </nav>
      <div class="tenant-workspace__content">{props.children}</div>
    </div>
  );
};

export default TenantWorkspaceLayout;

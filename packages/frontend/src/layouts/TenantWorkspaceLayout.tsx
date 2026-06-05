import { A, useLocation } from '@solidjs/router';
import type { ParentComponent } from 'solid-js';

const TenantWorkspaceLayout: ParentComponent = (props) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

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
        <A
          href="/providers"
          class="tenant-workspace__link"
          classList={{ active: isActive('/providers') }}
          aria-current={isActive('/providers') ? 'page' : undefined}
        >
          Providers
        </A>
      </nav>
      <div class="tenant-workspace__content">{props.children}</div>
    </div>
  );
};

export default TenantWorkspaceLayout;

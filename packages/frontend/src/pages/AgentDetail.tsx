import { useParams, useLocation } from '@solidjs/router';
import { Show, type ParentComponent } from 'solid-js';
import { A } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import { agentPath } from '../services/routing.js';

/**
 * Agent detail layout with horizontal tabs: Routing, Settings, Providers.
 * Wraps child route content.
 */
const AgentDetail: ParentComponent = (props) => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation();

  const agentName = () => decodeURIComponent(params.agentName);
  const path = (sub: string) => agentPath(params.agentName, sub);

  const isActive = (sub: string) => {
    const p = path(sub);
    if (sub === '' || sub === '/routing') {
      return location.pathname === path('') || location.pathname === path('/routing');
    }
    return location.pathname.startsWith(p);
  };

  return (
    <div class="container--lg">
      <Title>{agentName()} | Manifest</Title>

      <div class="page-header" style="margin-bottom: 0;">
        <h1 class="page-header__title">{agentName()}</h1>
      </div>

      {/* Horizontal tabs */}
      <div class="panel__tabs" role="tablist" style="margin-bottom: 24px; margin-top: 16px;">
        <A
          href={path('/routing')}
          role="tab"
          aria-selected={isActive('/routing')}
          class="panel__tab"
          classList={{ 'panel__tab--active': isActive('/routing') }}
        >
          Routing
        </A>
        <A
          href={path('/providers')}
          role="tab"
          aria-selected={isActive('/providers')}
          class="panel__tab"
          classList={{ 'panel__tab--active': isActive('/providers') }}
        >
          Providers
        </A>
        <A
          href={path('/guardrails')}
          role="tab"
          aria-selected={isActive('/guardrails')}
          class="panel__tab"
          classList={{ 'panel__tab--active': isActive('/guardrails') }}
        >
          Guardrails
        </A>
        <A
          href={path('/settings')}
          role="tab"
          aria-selected={isActive('/settings')}
          class="panel__tab"
          classList={{ 'panel__tab--active': isActive('/settings') }}
        >
          Settings
        </A>
      </div>

      {/* Tab content from child routes */}
      {props.children}
    </div>
  );
};

export default AgentDetail;

import { A, useLocation, useParams } from '@solidjs/router';
import { Show, type ParentComponent } from 'solid-js';
import { Title } from '@solidjs/meta';
import { agentPath } from '../services/routing.js';
import { agentPlatformIcon } from '../services/agent-platform-store.js';

/**
 * AgentDetail — horizontal-tabbed shell for the agent detail view.
 *
 * Renders a header (back-link to /agents + agent display name) and a
 * horizontal tab bar (Overview / Routing / Guardrails / Settings). Child
 * routes render in the body via props.children (SolidJS nested <Route>).
 */
const AgentDetail: ParentComponent = (props) => {
  const params = useParams<{ agentName: string }>();
  const location = useLocation();

  const agentName = () => decodeURIComponent(params.agentName);
  const path = (sub: string) => agentPath(params.agentName, sub);

  const isActive = (sub: string) => {
    const p = path(sub);
    if (sub === '' || sub === '/overview') {
      return location.pathname === path('') || location.pathname === path('/overview');
    }
    if (sub === '/routing') {
      return location.pathname === path('/routing');
    }
    return location.pathname.startsWith(p);
  };

  return (
    <div class="container--lg">
      <Title>{agentName()} | Manifest</Title>

      <div style="margin-bottom: 8px;">
        <A
          href="/agents"
          style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); text-decoration: none;"
        >
          ← Agents
        </A>
      </div>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 0;">
        <Show when={agentPlatformIcon()}>
          <img src={agentPlatformIcon()!} alt="" width="28" height="28" style="flex-shrink: 0;" />
        </Show>
        <h1 class="page-header__title" style="margin: 0;">
          {agentName()}
        </h1>
      </div>

      {/* Horizontal tabs */}
      <div class="panel__tabs" role="tablist" style="margin-top: 12px; margin-bottom: 0;">
        <A
          href={path('')}
          role="tab"
          aria-selected={isActive('/overview')}
          class="panel__tab"
          classList={{ 'panel__tab--active': isActive('/overview') }}
        >
          Overview
        </A>
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
      <hr style="border: none; border-top: 1px solid hsl(var(--border)); margin: 8px 0 24px;" />

      {/* Tab content from child routes */}
      {props.children}
    </div>
  );
};

export default AgentDetail;

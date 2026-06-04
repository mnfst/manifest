import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

const routerState = vi.hoisted(() => ({
  pathname: '/agents/demo/providers',
}));

vi.mock('@solidjs/router', () => ({
  useParams: () => ({ agentName: 'demo' }),
  useLocation: () => routerState,
  A: (props: any) => {
    const activeClasses = props.classList
      ? Object.entries(props.classList)
          .filter(([, enabled]) => enabled)
          .map(([name]) => name)
          .join(' ')
      : '';
    return (
      <a
        href={props.href}
        role={props.role}
        aria-selected={props['aria-selected']}
        class={`${props.class ?? ''} ${activeClasses}`.trim()}
      >
        {props.children}
      </a>
    );
  },
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
}));

vi.mock('../../src/services/agent-platform-store.js', () => ({
  agentPlatformIcon: () => undefined,
}));

import AgentDetail from '../../src/pages/AgentDetail';

describe('AgentDetail', () => {
  beforeEach(() => {
    routerState.pathname = '/agents/demo/providers';
  });

  it('renders the restored Providers tab', () => {
    render(() => (
      <AgentDetail>
        <div>Child content</div>
      </AgentDetail>
    ));

    const tab = screen.getByRole('tab', { name: 'Providers' });
    expect(tab).toBeDefined();
    expect(tab.getAttribute('href')).toBe('/agents/demo/providers');
  });

  it('marks the Providers tab active on the providers route', () => {
    const { container } = render(() => (
      <AgentDetail>
        <div />
      </AgentDetail>
    ));

    const tab = screen.getByRole('tab', { name: 'Providers' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(tab.classList.contains('panel__tab--active')).toBe(true);
    expect(container.textContent).toContain('demo');
  });
});

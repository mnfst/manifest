import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';

vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; class?: string; children?: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children as never}
    </a>
  ),
}));

import BenchmarkEmptyState from '../../src/components/benchmark/BenchmarkEmptyState';

describe('BenchmarkEmptyState', () => {
  it('renders the empty-state copy and a Routing CTA scoped to the agent', () => {
    const { container } = render(() => <BenchmarkEmptyState agentName="demo agent" />);

    expect(container.textContent).toContain('Connect a provider to start benchmarking');
    const cta = container.querySelector('a.benchmark-empty__cta') as HTMLAnchorElement | null;
    expect(cta).not.toBeNull();
    expect(cta?.textContent?.trim()).toBe('Go to Routing');
    // agentPath() URL-encodes the agent name.
    expect(cta?.getAttribute('href')).toBe('/agents/demo%20agent/routing');
  });
});

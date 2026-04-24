import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';

vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; children: unknown; class?: string }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

import BenchmarkEmptyState from '../../src/components/benchmark/BenchmarkEmptyState';

describe('BenchmarkEmptyState', () => {
  it('renders the headline, body, and a CTA that points at the agent routing page', () => {
    const { container } = render(() => <BenchmarkEmptyState agentName="demo-agent" />);
    expect(container.textContent).toContain('Connect a provider');
    const cta = container.querySelector('a.benchmark-empty__cta');
    expect(cta?.getAttribute('href')).toBe('/agents/demo-agent/routing');
  });

  it('URL-encodes unusual agent names in the CTA link', () => {
    const { container } = render(() => <BenchmarkEmptyState agentName="my agent" />);
    expect(container.querySelector('a.benchmark-empty__cta')?.getAttribute('href')).toBe(
      '/agents/my%20agent/routing',
    );
  });
});

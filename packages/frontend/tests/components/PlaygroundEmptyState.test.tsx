import { describe, it, expect, vi } from 'vitest';
import { render } from '@solidjs/testing-library';

// The empty state now renders NoConnectionsPrompt, which links to the provider
// pages via <A> (so stub the router link) and probes self-hosted via a fetch
// (stubbed to keep the render deterministic and offline).
vi.mock('@solidjs/router', () => ({
  A: (props: { children?: unknown }) => props.children,
}));
vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: vi.fn().mockResolvedValue(false),
}));

import PlaygroundEmptyState from '../../src/components/playground/PlaygroundEmptyState';

describe('PlaygroundEmptyState', () => {
  it('renders the no-providers prompt with the provider connection cards', () => {
    // onConnect is still part of the contract but the prompt now routes via the
    // sidebar provider pages, so it is no longer invoked from here.
    const onConnect = vi.fn();
    const { container } = render(() => <PlaygroundEmptyState onConnect={onConnect} />);

    expect(container.textContent).toContain('No providers connected');
    expect(container.textContent).toContain('Connect a provider to start routing your requests.');
    expect(container.textContent).toContain('Subscriptions');
    expect(container.textContent).toContain('Usage-based');
    // Each connection card carries a (decorative) "Connect provider" button.
    const connectButtons = container.querySelectorAll('button.btn--primary');
    expect(connectButtons.length).toBeGreaterThanOrEqual(2);
  });
});

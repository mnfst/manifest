import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@solidjs/testing-library';

// `A` from the router is rendered as a plain anchor so hrefs are assertable.
vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; class?: string; children: unknown; style?: string }) => (
    <a href={props.href} class={props.class} style={props.style}>
      {props.children}
    </a>
  ),
}));

// `selfHosted` derives from the setup-status resource (checkIsSelfHosted).
const mockCheckIsSelfHosted = vi.fn();
vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: () => mockCheckIsSelfHosted(),
}));

import NoConnectionsPrompt from '../../src/components/NoConnectionsPrompt';

describe('NoConnectionsPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always renders the Subscriptions and Usage-based provider cards', async () => {
    mockCheckIsSelfHosted.mockResolvedValue(false);
    const { container } = render(() => <NoConnectionsPrompt />);
    await waitFor(() => {
      expect(container.querySelector('a[href="/providers/subscriptions"]')).not.toBeNull();
    });
    expect(container.querySelector('a[href="/providers/usage-based"]')).not.toBeNull();
    expect(container.textContent).toContain('Subscriptions');
    expect(container.textContent).toContain('Usage-based');
  });

  it('renders the Local provider card when self-hosted', async () => {
    mockCheckIsSelfHosted.mockResolvedValue(true);
    const { container } = render(() => <NoConnectionsPrompt />);
    // The Local card only appears once the self-hosted resource resolves true.
    const localCard = await waitFor(() => {
      const card = container.querySelector('a[href="/providers/local"]');
      if (!card) throw new Error('Local card not rendered yet');
      return card;
    });
    expect(localCard).not.toBeNull();
    expect(localCard.textContent).toContain('Local');
    expect(localCard.textContent).toContain('Connect to LLM servers running on your machine.');
  });

  it('does NOT render the Local provider card in cloud mode', async () => {
    mockCheckIsSelfHosted.mockResolvedValue(false);
    const { container } = render(() => <NoConnectionsPrompt />);
    // Wait for the always-present cards so the resource has had a chance to
    // resolve; the Local card must still be absent in cloud mode.
    await waitFor(() => {
      expect(container.querySelector('a[href="/providers/subscriptions"]')).not.toBeNull();
    });
    expect(container.querySelector('a[href="/providers/local"]')).toBeNull();
  });
});

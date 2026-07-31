import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import UserDiscoveryBanner, {
  USER_DISCOVERY_BANNER_DISMISSED_KEY,
  USER_DISCOVERY_BOOKING_URL,
} from '../../src/components/UserDiscoveryBanner';

describe('UserDiscoveryBanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders the discovery offer and links to the Calendly slot', () => {
    const { container } = render(() => <UserDiscoveryBanner />);

    expect(container.querySelector('.overview-discovery-banner')).not.toBeNull();
    expect(
      screen.getByText(/Talk to us and get \$25 of Gemini credit/),
    ).toBeDefined();

    const cta = screen.getByText('Book a slot →') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe(USER_DISCOVERY_BOOKING_URL);
    expect(cta.getAttribute('target')).toBe('_blank');
    expect(cta.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('stays hidden when the dismissal flag is already stored', () => {
    window.localStorage.setItem(USER_DISCOVERY_BANNER_DISMISSED_KEY, 'true');

    const { container } = render(() => <UserDiscoveryBanner />);

    expect(container.querySelector('.overview-discovery-banner')).toBeNull();
  });

  it('renders when localStorage reads throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { container } = render(() => <UserDiscoveryBanner />);

    expect(container.querySelector('.overview-discovery-banner')).not.toBeNull();
  });

  it('dismisses and persists the hidden state', async () => {
    const { container, unmount } = render(() => <UserDiscoveryBanner />);

    await fireEvent.click(screen.getByLabelText('Dismiss banner'));

    expect(container.querySelector('.overview-discovery-banner')).toBeNull();
    expect(window.localStorage.getItem(USER_DISCOVERY_BANNER_DISMISSED_KEY)).toBe(
      'true',
    );

    unmount();
    const next = render(() => <UserDiscoveryBanner />);
    expect(next.container.querySelector('.overview-discovery-banner')).toBeNull();
  });

  it('still dismisses when localStorage writes fail', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { container } = render(() => <UserDiscoveryBanner />);

    await fireEvent.click(screen.getByLabelText('Dismiss banner'));

    expect(container.querySelector('.overview-discovery-banner')).toBeNull();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import SocialFollowBanner, {
  SOCIAL_FOLLOW_DISMISSED_KEY,
} from '../../src/components/SocialFollowBanner';

describe('SocialFollowBanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders the paid plans announcement with a read-more link', () => {
    const { container } = render(() => <SocialFollowBanner />);

    expect(container.querySelector('.overview-social-banner')).not.toBeNull();
    expect(
      screen.getByText(/Introducing request recovery and paid plans for Manifest Cloud/),
    ).toBeDefined();

    const readMore = screen.getByText('Read more') as HTMLAnchorElement;
    expect(readMore.getAttribute('href')).toBe(
      'https://manifest.build/blog/introducing-paid-plans/',
    );
    expect(readMore.getAttribute('target')).toBe('_blank');
    expect(readMore.getAttribute('rel')).toBe('noopener noreferrer');

    expect(container.querySelector('.overview-social-banner__inner')?.lastElementChild).toBe(
      screen.getByLabelText('Dismiss banner'),
    );
  });

  it('dismisses and persists the hidden state', async () => {
    const { container, unmount } = render(() => <SocialFollowBanner />);

    await fireEvent.click(screen.getByLabelText('Dismiss banner'));

    expect(container.querySelector('.overview-social-banner')).toBeNull();
    expect(window.localStorage.getItem(SOCIAL_FOLLOW_DISMISSED_KEY)).toBe('true');

    unmount();
    const next = render(() => <SocialFollowBanner />);
    expect(next.container.querySelector('.overview-social-banner')).toBeNull();
  });

  it('still dismisses when localStorage writes fail', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { container } = render(() => <SocialFollowBanner />);

    await fireEvent.click(screen.getByLabelText('Dismiss banner'));

    expect(container.querySelector('.overview-social-banner')).toBeNull();
  });
});

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

  it('renders the compact follow message and community links', () => {
    const { container } = render(() => <SocialFollowBanner />);

    expect(container.querySelector('.overview-social-banner')).not.toBeNull();
    expect(
      screen.getByText(
        'Follow Manifest to stay informed about the latest models and available features',
      ),
    ).toBeDefined();

    const x = screen.getByLabelText('Manifest on X') as HTMLAnchorElement;
    const linkedIn = screen.getByLabelText('Manifest on LinkedIn') as HTMLAnchorElement;
    const youtube = screen.getByLabelText('Manifest on YouTube') as HTMLAnchorElement;

    expect(x.getAttribute('href')).toBe('https://x.com/Manifestforai');
    expect(linkedIn.getAttribute('href')).toBe(
      'https://www.linkedin.com/company/manifest-for-agents/',
    );
    expect(youtube.getAttribute('href')).toBe('https://www.youtube.com/@Manifest-for-AI');
    expect(x.getAttribute('target')).toBe('_blank');
    expect(linkedIn.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.querySelector('.overview-social-banner__inner')?.lastElementChild).toBe(
      screen.getByLabelText('Dismiss social follow banner'),
    );
  });

  it('dismisses and persists the hidden state', async () => {
    const { container, unmount } = render(() => <SocialFollowBanner />);

    await fireEvent.click(screen.getByLabelText('Dismiss social follow banner'));

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

    await fireEvent.click(screen.getByLabelText('Dismiss social follow banner'));

    expect(container.querySelector('.overview-social-banner')).toBeNull();
  });
});

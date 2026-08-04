import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import UserDiscoveryModal, {
  USER_DISCOVERY_MODAL_DISMISSED_KEY,
  readUserDiscoveryModalDismissed,
  writeUserDiscoveryModalDismissed,
} from '../../src/components/UserDiscoveryModal';
import { USER_DISCOVERY_BOOKING_URL } from '../../src/components/UserDiscoveryBanner';

describe('UserDiscoveryModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <UserDiscoveryModal open={false} onClose={vi.fn()} />
    ));

    expect(container.textContent).toBe('');
    expect(document.body.querySelector('.user-discovery-modal')).toBeNull();
  });

  it('renders the discovery pitch with all three benefits', () => {
    render(() => <UserDiscoveryModal open onClose={vi.fn()} />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent?.replace(/\s+/g, ' ').trim()).toContain(
      'Talk to us and get $25 credit for',
    );
    expect(screen.getByText('$25')).toBeDefined();
    expect(screen.getByAltText('Gemini')).toBeDefined();
    expect(screen.getByText(/around agent reliability/)).toBeDefined();
    expect(screen.getByText('15 minutes through a video call.')).toBeDefined();
    expect(
      screen.getByText('Quick access to $25 of Gemini tokens through Manifest.'),
    ).toBeDefined();
    expect(
      screen.getByText(
        'You talk and we listen. Just questions and nothing to sell.',
      ),
    ).toBeDefined();
  });

  it('closes via the X button, "Maybe later", the backdrop, and Escape — but not the dialog body', () => {
    const onClose = vi.fn();
    render(() => <UserDiscoveryModal open onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    const backdrop = document.body.querySelector('.modal-backdrop') as HTMLElement;

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Maybe later'));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(backdrop, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(backdrop, { key: 'Tab' });
    expect(onClose).toHaveBeenCalledTimes(3);

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it('opens Calendly in a new tab and closes when "Book my slot" is clicked', () => {
    const onClose = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(() => <UserDiscoveryModal open onClose={onClose} />);

    fireEvent.click(screen.getByText('Book my slot to get $25'));

    expect(openSpy).toHaveBeenCalledWith(
      USER_DISCOVERY_BOOKING_URL,
      '_blank',
      'noopener,noreferrer',
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('read/write helpers round-trip through localStorage', () => {
    expect(readUserDiscoveryModalDismissed()).toBe(false);
    writeUserDiscoveryModalDismissed();
    expect(window.localStorage.getItem(USER_DISCOVERY_MODAL_DISMISSED_KEY)).toBe(
      'true',
    );
    expect(readUserDiscoveryModalDismissed()).toBe(true);
  });

  it('read helper returns false when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(readUserDiscoveryModalDismissed()).toBe(false);
  });

  it('write helper swallows localStorage failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => writeUserDiscoveryModalDismissed()).not.toThrow();
  });
});

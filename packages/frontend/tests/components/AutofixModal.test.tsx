import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';

let mockWaitlistStatus = { joined: false, joinedAt: null as string | null };

const mockJoin = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  getAutofixWaitlistStatus: () => Promise.resolve(mockWaitlistStatus),
  joinAutofixWaitlist: (...args: unknown[]) => mockJoin(...args),
}));

import AutofixModal from '../../src/components/AutofixModal';

beforeEach(() => {
  vi.clearAllMocks();
  mockWaitlistStatus = { joined: false, joinedAt: null };
  mockJoin.mockResolvedValue({ joined: true, joinedAt: '2026-06-25T10:00:00.000Z' });
});

describe('AutofixModal', () => {
  it('does not render when open is false', () => {
    const { container } = render(() => <AutofixModal open={false} onClose={vi.fn()} />);
    expect(container.querySelector('.autofix-modal')).toBeNull();
  });

  it('renders the modal content when open is true', async () => {
    const { container } = render(() => <AutofixModal open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal')).not.toBeNull();
    });
    expect(container.querySelector('.autofix-modal__brand')).not.toBeNull();
    expect(container.querySelector('.autofix-modal__brand-name')?.textContent).toBe('Auto-fix');
    expect(container.querySelector('.autofix-modal__logo--light')).not.toBeNull();
    expect(container.querySelector('.autofix-modal__logo--dark')).not.toBeNull();
    expect(container.querySelector('.autofix-modal__badge')?.textContent).toBe('Early Access');
    expect(container.querySelector('.autofix-modal__title')?.textContent).toBe(
      'Auto-fix repairs failing requests before they reach the model',
    );
    expect(container.textContent).toContain('rolling out Auto-fix to a select few teams');
  });

  it('renders the Book a demo link pointing to Calendly', async () => {
    const { container } = render(() => <AutofixModal open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal__cta-book')).not.toBeNull();
    });
    const link = container.querySelector('.autofix-modal__cta-book') as HTMLAnchorElement;
    expect(link.href).toContain('calendly.com/sebastien-manifest/30min');
    expect(link.target).toBe('_blank');
  });

  it('renders the Join the waitlist button', async () => {
    const { container } = render(() => <AutofixModal open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal__cta-waitlist')).not.toBeNull();
    });
    expect(container.querySelector('.autofix-modal__cta-waitlist')?.textContent).toBe(
      'Claim my spot',
    );
  });

  it('shows "You\'re on the list" when user has already joined', async () => {
    mockWaitlistStatus = { joined: true, joinedAt: '2026-06-25T10:00:00.000Z' };
    const { container } = render(() => <AutofixModal open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal__joined')).not.toBeNull();
    });
    expect(container.querySelector('.autofix-modal__joined')?.textContent).toContain(
      "You're on the list",
    );
  });

  it('renders the four feature items in the right column', async () => {
    const { container } = render(() => <AutofixModal open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal__features')).not.toBeNull();
    });
    const features = container.querySelectorAll('.autofix-modal__feature-label');
    expect(features.length).toBe(4);
    expect(features[0].textContent).toBe('Real-time fix');
    expect(features[1].textContent).toBe('Zero downtime');
    expect(features[2].textContent).toBe('Observability');
    expect(features[3].textContent).toBe('Notifications');
  });

  it('renders the Learn more about Auto-fix link', async () => {
    const { container } = render(() => <AutofixModal open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal__learn-more')).not.toBeNull();
    });
    const link = container.querySelector('.autofix-modal__learn-more') as HTMLAnchorElement;
    expect(link.textContent).toContain('Learn more about Auto-fix');
    expect(link.href).toContain('manifest.build/autofix/');
    expect(link.target).toBe('_blank');
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const { container } = render(() => <AutofixModal open={true} onClose={onClose} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal__close')).not.toBeNull();
    });
    await fireEvent.click(container.querySelector('.autofix-modal__close') as HTMLButtonElement);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking the overlay', async () => {
    const onClose = vi.fn();
    const { container } = render(() => <AutofixModal open={true} onClose={onClose} />);
    await waitFor(() => {
      expect(container.querySelector('.modal-overlay')).not.toBeNull();
    });
    await fireEvent.click(container.querySelector('.modal-overlay') as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking inside the modal', async () => {
    const onClose = vi.fn();
    const { container } = render(() => <AutofixModal open={true} onClose={onClose} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal')).not.toBeNull();
    });
    await fireEvent.click(container.querySelector('.autofix-modal') as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    const { container } = render(() => <AutofixModal open={true} onClose={onClose} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal')).not.toBeNull();
    });
    await fireEvent.keyDown(container.querySelector('.autofix-modal') as HTMLElement, {
      key: 'Escape',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls joinAutofixWaitlist when the waitlist button is clicked', async () => {
    const { container } = render(() => <AutofixModal open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal__cta-waitlist')).not.toBeNull();
    });
    await fireEvent.click(
      container.querySelector('.autofix-modal__cta-waitlist') as HTMLButtonElement,
    );
    expect(mockJoin).toHaveBeenCalled();
  });

  it('has proper dialog accessibility attributes', async () => {
    const { container } = render(() => <AutofixModal open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.querySelector('.autofix-modal')).not.toBeNull();
    });
    const dialog = container.querySelector('.autofix-modal') as HTMLElement;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('autofix-modal-title');
  });
});

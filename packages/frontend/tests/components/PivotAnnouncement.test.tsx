import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

const mockCheckIsSelfHosted = vi.fn();
const mockSubmitPivotClaim = vi.fn();
let mockSessionEmail = 'test@test.com';

vi.mock('../../src/services/auth-client.js', () => ({
  authClient: {
    useSession: () => () => ({
      data: { user: { id: 'u1', name: 'Test', email: mockSessionEmail } },
      isPending: false,
    }),
  },
}));

vi.mock('../../src/services/setup-status.js', () => ({
  checkIsSelfHosted: (...args: unknown[]) => mockCheckIsSelfHosted(...args),
}));

vi.mock('../../src/services/waitlist.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/waitlist.js')>();
  return {
    ...actual,
    submitPivotClaim: (...args: unknown[]) => mockSubmitPivotClaim(...args),
  };
});

import PivotAnnouncement, { PIVOT_ARTICLE_URL } from '../../src/components/PivotAnnouncement';

const CARD_TITLE = 'Manifest is becoming the self-healing layer for APIs';

describe('PivotAnnouncement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockSessionEmail = 'test@test.com';
    mockCheckIsSelfHosted.mockResolvedValue(true);
    mockSubmitPivotClaim.mockResolvedValue(true);
  });

  async function openModal() {
    const result = render(() => <PivotAnnouncement />);
    fireEvent.click(screen.getByText('Learn more'));
    await screen.findByText('Join the waiting list');
    return result;
  }

  it('renders the card unconditionally with a Learn more button', () => {
    const { container } = render(() => <PivotAnnouncement />);
    expect(screen.getAllByText(CARD_TITLE).length).toBeGreaterThan(0);
    expect(container.querySelector('.sidebar-pivot')).not.toBeNull();
    expect(screen.getByText('Learn more')).toBeDefined();
  });

  it('dismisses for the session and comes back in a fresh session', () => {
    const { container, unmount } = render(() => <PivotAnnouncement />);
    fireEvent.click(container.querySelector('.sidebar-pivot__dismiss')!);
    expect(container.querySelector('.sidebar-pivot')).toBeNull();
    expect(sessionStorage.getItem('pivot-card-dismissed')).toBe('1');
    unmount();

    const second = render(() => <PivotAnnouncement />);
    expect(second.container.querySelector('.sidebar-pivot')).toBeNull();
    second.unmount();

    sessionStorage.clear();
    const third = render(() => <PivotAnnouncement />);
    expect(third.container.querySelector('.sidebar-pivot')).not.toBeNull();
  });

  it('opens the modal with the session email prefilled and the article link', async () => {
    await openModal();
    const input = document.querySelector('.modal-card__input') as HTMLInputElement;
    expect(input.value).toBe('test@test.com');
    const link = document.querySelector(`a[href="${PIVOT_ARTICLE_URL}"]`);
    expect(link).not.toBeNull();
  });

  it('submits a corrected email, not the prefilled one', async () => {
    await openModal();
    const input = document.querySelector('.modal-card__input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '  good@company.com ' } });
    fireEvent.submit(document.querySelector('.modal-card form')!);

    await waitFor(() => {
      expect(mockSubmitPivotClaim).toHaveBeenCalledWith('good@company.com', true);
    });
    await screen.findByText("You're on the list. We'll reach out at launch.");
  });

  it('passes the cloud flag through on cloud deployments', async () => {
    mockCheckIsSelfHosted.mockResolvedValue(false);
    await openModal();
    await waitFor(() => {
      expect(mockCheckIsSelfHosted).toHaveBeenCalled();
    });
    fireEvent.submit(document.querySelector('.modal-card form')!);
    await waitFor(() => {
      expect(mockSubmitPivotClaim).toHaveBeenCalledWith('test@test.com', false);
    });
  });

  it('shows a real error instead of a fake success when the claim fails', async () => {
    mockSubmitPivotClaim.mockResolvedValue(false);
    await openModal();
    fireEvent.submit(document.querySelector('.modal-card form')!);

    await screen.findByText('Could not reach the waiting list. Please try again.');
    expect(screen.queryByText("You're on the list. We'll reach out at launch.")).toBeNull();
    expect(localStorage.getItem('manifest_pivot_waitlist_joined_u1')).toBeNull();
  });

  it('remembers the joined state for the user on reopen', async () => {
    await openModal();
    fireEvent.submit(document.querySelector('.modal-card form')!);
    await screen.findByText("You're on the list. We'll reach out at launch.");
    expect(localStorage.getItem('manifest_pivot_waitlist_joined_u1')).toBe('1');

    fireEvent.click(screen.getByText('Close'));
    expect(document.querySelector('.modal-card')).toBeNull();

    fireEvent.click(screen.getByText('Learn more'));
    await screen.findByText("You're on the list. We'll reach out at launch.");
    expect(document.querySelector('.modal-card form')).toBeNull();
  });

  it('closes on overlay click and Escape without submitting', async () => {
    await openModal();
    fireEvent.click(document.querySelector('.modal-overlay')!);
    expect(document.querySelector('.modal-card')).toBeNull();

    fireEvent.click(screen.getByText('Learn more'));
    await screen.findByText('Join the waiting list');
    fireEvent.keyDown(document.querySelector('.modal-overlay')!, { key: 'Escape' });
    expect(document.querySelector('.modal-card')).toBeNull();
    expect(mockSubmitPivotClaim).not.toHaveBeenCalled();
  });

  it('ignores a re-submit while a claim is in flight', async () => {
    let resolveClaim: (ok: boolean) => void = () => {};
    mockSubmitPivotClaim.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveClaim = resolve;
        }),
    );
    await openModal();
    const form = document.querySelector('.modal-card form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    resolveClaim(true);

    await screen.findByText("You're on the list. We'll reach out at launch.");
    expect(mockSubmitPivotClaim).toHaveBeenCalledTimes(1);
  });
});

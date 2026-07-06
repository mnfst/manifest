import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

const mockNavigate = vi.fn();
let mockSearchParams: Record<string, string> = {};

vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: () => null,
}));

const mockUpgrade = vi.fn();
vi.mock('../../src/services/auth-client.js', () => ({
  authClient: {
    subscription: {
      upgrade: (...args: unknown[]) => mockUpgrade(...args),
    },
  },
}));

const mockGetBillingStatus = vi.fn();
vi.mock('../../src/services/api/billing.js', () => ({
  getBillingStatus: (...args: unknown[]) => mockGetBillingStatus(...args),
}));

const mockToastError = vi.fn();
vi.mock('../../src/services/toast-store.js', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import Upgrade from '../../src/pages/Upgrade';

const disabledStatus = {
  enabled: false,
  plan: 'free' as const,
  priceMonthlyUsd: null,
  requests: { used: null, limit: 10_000, periodEnd: null },
};

const freeStatus = {
  enabled: true,
  plan: 'free' as const,
  priceMonthlyUsd: 20,
  requests: { used: 1250, limit: 10_000, periodEnd: '2026-08-01T00:00:00.000Z' },
};

const proStatus = {
  enabled: true,
  plan: 'pro' as const,
  priceMonthlyUsd: 20,
  requests: { used: null, limit: null, periodEnd: null },
};

describe('Upgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {};
    mockGetBillingStatus.mockResolvedValue(freeStatus);
    mockUpgrade.mockResolvedValue(undefined);
    window.history.pushState({}, '', '/upgrade');
  });

  it('fetches billing status without cache and renders plan choices', async () => {
    render(() => <Upgrade />);

    await screen.findByText('Free');

    expect(mockGetBillingStatus).toHaveBeenCalledWith({ cache: false });
    expect(screen.getByText('Choose your Manifest plan')).toBeDefined();
    expect(screen.getByText('$0')).toBeDefined();
    expect(screen.getByText('$20')).toBeDefined();
    expect(screen.getAllByText('Unlimited agents').length).toBe(2);
    expect(screen.getByText('10,000 routed requests / month')).toBeDefined();
    expect(screen.getByText('1,250 used this month')).toBeDefined();
    expect(screen.getByText('All providers, no restrictions')).toBeDefined();
    expect(screen.getByText('Subscription providers')).toBeDefined();
    expect(screen.getByText('Unlimited routed requests')).toBeDefined();
    expect(screen.getByText('30-day dashboard retention')).toBeDefined();
    expect(screen.getByText('Budget alerts and notifications')).toBeDefined();
    expect(screen.getByText('Enterprise')).toBeDefined();
    expect(screen.getByText("Let's Talk")).toBeDefined();
    expect(screen.getByText('Talk to sales')).toBeDefined();
    expect(screen.getByText('Upgrade to Pro')).toBeDefined();
  });

  it('shows the request-limit entry message', async () => {
    mockSearchParams = { reason: 'requests' };
    render(() => <Upgrade />);

    await screen.findByText(/You've used all 10,000 requests this month/);
  });

  it('continues on Free by navigating to the dashboard', async () => {
    render(() => <Upgrade />);

    const button = await screen.findByText('Continue on Free');
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('starts checkout with the current upgrade URL as cancel URL', async () => {
    mockSearchParams = { reason: 'requests' };
    window.history.pushState({}, '', '/upgrade?reason=requests');
    render(() => <Upgrade />);

    const button = await screen.findByText('Upgrade to Pro');
    fireEvent.click(button);

    expect(mockUpgrade).toHaveBeenCalledWith({
      plan: 'pro',
      successUrl: `${window.location.origin}/account?upgraded=1`,
      cancelUrl: `${window.location.origin}/upgrade?reason=requests`,
    });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  });

  it('shows an error toast when checkout fails', async () => {
    mockUpgrade.mockRejectedValue(new Error('stripe down'));
    render(() => <Upgrade />);

    fireEvent.click(await screen.findByText('Upgrade to Pro'));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith('Could not start the upgrade. Please try again.'),
    );
  });

  it('redirects away when billing is disabled', async () => {
    mockGetBillingStatus.mockResolvedValue(disabledStatus);
    render(() => <Upgrade />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(screen.queryByText('$20')).toBeNull();
  });

  it('shows an already-upgraded state for Pro users', async () => {
    mockGetBillingStatus.mockResolvedValue(proStatus);
    render(() => <Upgrade />);

    await screen.findByText("You're already on Pro");
    expect(screen.getByText('Account')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.queryByText('$20')).toBeNull();
  });

  it('shows a loading state while billing status is pending', () => {
    mockGetBillingStatus.mockReturnValue(new Promise(() => undefined));
    render(() => <Upgrade />);

    expect(screen.getByText('Loading billing status...')).toBeDefined();
  });

  it('shows a recoverable state when billing status fails', async () => {
    mockGetBillingStatus.mockRejectedValue(new Error('network'));
    render(() => <Upgrade />);

    await screen.findByText('Could not load billing status. Please try again.');
    fireEvent.click(screen.getByText('Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});

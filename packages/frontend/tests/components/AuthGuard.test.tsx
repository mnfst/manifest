import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

const mockNavigate = vi.fn();
const mockGetBillingStatus = vi.fn().mockResolvedValue({ enabled: false, plan: 'free' });
let mockLocation = { pathname: '/', search: '' };
let mockSessionData: any = {
  data: { user: { id: 'u1', name: 'Test' } },
  isPending: false,
};

vi.mock('@solidjs/router', () => ({
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
}));

vi.mock('../../src/services/auth-client.js', () => ({
  authClient: {
    useSession: () => () => mockSessionData,
  },
}));

vi.mock('../../src/services/api/billing.js', () => ({
  getBillingStatus: (...args: unknown[]) => mockGetBillingStatus(...args),
}));

import AuthGuard from '../../src/components/AuthGuard';

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetBillingStatus.mockResolvedValue({ enabled: false, plan: 'free' });
    mockSessionData = {
      data: { user: { id: 'u1', name: 'Test' } },
      isPending: false,
    };
    mockLocation = { pathname: '/', search: '' };
  });

  it('renders children when session exists', async () => {
    render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    expect(await screen.findByText('Protected content')).toBeDefined();
  });

  it('renders children without a billing call when the user already chose a plan', async () => {
    localStorage.setItem('manifest_plan_chosen_u1', '1');
    render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));

    expect(await screen.findByText('Protected content')).toBeDefined();
    expect(mockGetBillingStatus).not.toHaveBeenCalled();
  });

  it('redirects authenticated free users to the plan step', async () => {
    mockGetBillingStatus.mockResolvedValue({ enabled: true, plan: 'free' });
    render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/register?step=plan', { replace: true });
    });
  });

  it('fails open when billing status cannot be loaded', async () => {
    mockGetBillingStatus.mockRejectedValue(new Error('network'));
    render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));

    expect(await screen.findByText('Protected content')).toBeDefined();
  });

  it('shows loading state when session is pending', () => {
    mockSessionData = { data: null, isPending: true };
    const { container } = render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    expect(container.textContent).toContain('Loading...');
  });

  it('shows loading state when no session data', () => {
    mockSessionData = { data: null, isPending: false };
    const { container } = render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    expect(container.textContent).toContain('Loading...');
  });

  it('navigates to login when no session', async () => {
    mockSessionData = { data: null, isPending: false };
    render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login?redirect=%2F', { replace: true });
    });
  });

  it('preserves the protected path and query when redirecting to login', async () => {
    mockSessionData = { data: null, isPending: false };
    mockLocation = { pathname: '/upgrade', search: '?reason=requests' };
    render(() => (
      <AuthGuard>
        <span>Protected content</span>
      </AuthGuard>
    ));
    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login?redirect=%2Fupgrade%3Freason%3Drequests', {
        replace: true,
      });
    });
  });
});

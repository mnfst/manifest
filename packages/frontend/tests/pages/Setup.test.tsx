import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

const mockNavigate = vi.fn();
const mockSignInEmail = vi.fn().mockResolvedValue({});
const mockCheckNeedsSetup = vi.fn();
const mockCreateFirstAdmin = vi.fn();

vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: { children: unknown }) => <title>{props.children as string}</title>,
  Meta: () => null,
}));

vi.mock('../../src/services/auth-client.js', () => ({
  authClient: {
    signIn: {
      email: (...args: unknown[]) => mockSignInEmail(...args),
    },
  },
}));

vi.mock('../../src/services/setup-status.js', () => ({
  checkNeedsSetup: (...args: unknown[]) => mockCheckNeedsSetup(...args),
  createFirstAdmin: (...args: unknown[]) => mockCreateFirstAdmin(...args),
}));

import Setup from '../../src/pages/Setup';

describe('Setup page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckNeedsSetup.mockResolvedValue(true);
    mockCreateFirstAdmin.mockResolvedValue(undefined);
    mockSignInEmail.mockResolvedValue({});

    // Stub window.location.href for the final navigation
    Object.defineProperty(window, 'location', {
      value: { href: '', replace: vi.fn() },
      writable: true,
    });
  });

  async function renderSetup() {
    const result = render(() => <Setup />);
    await waitFor(() => {
      expect(screen.queryByText('Welcome to Manifest')).toBeDefined();
    });
    return result;
  }

  it('redirects to /login when setup is already complete', async () => {
    mockCheckNeedsSetup.mockResolvedValue(false);
    render(() => <Setup />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('renders the welcome headline and form after status check', async () => {
    await renderSetup();
    expect(screen.getByText('Welcome to Manifest')).toBeDefined();
    expect(screen.getByPlaceholderText('Your name')).toBeDefined();
    expect(screen.getByPlaceholderText('you@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('At least 8 characters')).toBeDefined();
    expect(screen.getByPlaceholderText('Re-enter password')).toBeDefined();
  });

  it('shows an error when passwords do not match', async () => {
    const { container } = await renderSetup();
    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'Founder' } });
    fireEvent.input(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'founder@example.com' },
    });
    fireEvent.input(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'secretpassword' },
    });
    fireEvent.input(screen.getByPlaceholderText('Re-enter password'), {
      target: { value: 'different' },
    });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.queryByText('Passwords do not match')).toBeDefined();
    });
    expect(mockCreateFirstAdmin).not.toHaveBeenCalled();
  });

  it('calls createFirstAdmin with form values on valid submit', async () => {
    const { container } = await renderSetup();
    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'Founder' } });
    fireEvent.input(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'founder@example.com' },
    });
    fireEvent.input(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'secretpassword' },
    });
    fireEvent.input(screen.getByPlaceholderText('Re-enter password'), {
      target: { value: 'secretpassword' },
    });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(mockCreateFirstAdmin).toHaveBeenCalledWith({
        email: 'founder@example.com',
        name: 'Founder',
        password: 'secretpassword',
      });
    });
  });

  it('auto-signs-in after successful setup', async () => {
    const { container } = await renderSetup();
    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'Founder' } });
    fireEvent.input(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'founder@example.com' },
    });
    fireEvent.input(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'secretpassword' },
    });
    fireEvent.input(screen.getByPlaceholderText('Re-enter password'), {
      target: { value: 'secretpassword' },
    });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: 'founder@example.com',
        password: 'secretpassword',
      });
    });
  });

  it('surfaces server errors from createFirstAdmin', async () => {
    mockCreateFirstAdmin.mockRejectedValue(new Error('already exists'));
    const { container } = await renderSetup();
    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'Founder' } });
    fireEvent.input(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'founder@example.com' },
    });
    fireEvent.input(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'secretpassword' },
    });
    fireEvent.input(screen.getByPlaceholderText('Re-enter password'), {
      target: { value: 'secretpassword' },
    });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.queryByText('already exists')).toBeDefined();
    });
  });

  it('falls back to /login if auto-sign-in fails after setup', async () => {
    mockSignInEmail.mockResolvedValue({ error: { message: 'session failed' } });
    const { container } = await renderSetup();
    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'Founder' } });
    fireEvent.input(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'founder@example.com' },
    });
    fireEvent.input(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'secretpassword' },
    });
    fireEvent.input(screen.getByPlaceholderText('Re-enter password'), {
      target: { value: 'secretpassword' },
    });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('rejects short passwords (< 8 chars)', async () => {
    const { container } = await renderSetup();
    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'Founder' } });
    fireEvent.input(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'founder@example.com' },
    });
    // Use a 7-char password — must bypass native minLength validation
    const passwordInput = screen.getByPlaceholderText('At least 8 characters') as HTMLInputElement;
    const confirmInput = screen.getByPlaceholderText('Re-enter password') as HTMLInputElement;
    passwordInput.removeAttribute('minLength');
    confirmInput.removeAttribute('minLength');
    fireEvent.input(passwordInput, { target: { value: 'short77' } });
    fireEvent.input(confirmInput, { target: { value: 'short77' } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.queryByText('Password must be at least 8 characters')).toBeDefined();
    });
    expect(mockCreateFirstAdmin).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

vi.mock('@solidjs/router', () => ({
  useParams: () => ({ agentName: 'test-agent' }),
}));

vi.mock('@solidjs/meta', () => ({
  Title: (props: any) => <title>{props.children}</title>,
  Meta: (props: any) => <meta name={props.name ?? ''} content={props.content ?? ''} />,
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/services/agent-display-name.js', () => ({
  agentDisplayName: () => 'test-agent',
}));

import FreeModels from '../../src/pages/FreeModels';
import { toast } from '../../src/services/toast-store.js';

describe('FreeModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title and header', () => {
    render(() => <FreeModels />);
    expect(screen.getByText('Free Models')).toBeDefined();
  });

  it('renders step instructions', () => {
    render(() => <FreeModels />);
    expect(screen.getByText('Get your free API key from the provider website')).toBeDefined();
    expect(screen.getByText('Hit the provider Connect button, paste your key, and validate the connection')).toBeDefined();
  });

  it('renders Cohere provider card with name and logo', () => {
    const { container } = render(() => <FreeModels />);
    expect(screen.getByText('Cohere')).toBeDefined();
    const img = container.querySelector('img[src="/icons/cohere.svg"]');
    expect(img).not.toBeNull();
  });

  it('renders provider tags', () => {
    render(() => <FreeModels />);
    expect(screen.getByText('Up to 1,000 calls/month')).toBeDefined();
    expect(screen.getByText('No credit card required')).toBeDefined();
  });

  it('renders Get API key link', () => {
    const { container } = render(() => <FreeModels />);
    const link = container.querySelector('a[href="https://dashboard.cohere.com/api-keys"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('target')).toBe('_blank');
    expect(link!.textContent).toContain('Get API key');
  });

  it('renders Connect button with link to routing page', () => {
    render(() => <FreeModels />);
    const connectBtn = screen.getByText('Connect Cohere');
    expect(connectBtn.tagName).toBe('A');
    const href = connectBtn.getAttribute('href')!;
    expect(href).toContain('/agents/test-agent/routing?');
    expect(href).toContain('provider=custom');
    expect(href).toContain('name=Cohere');
  });

  it('renders base URL with copy button', () => {
    render(() => <FreeModels />);
    expect(screen.getByText('Base URL:')).toBeDefined();
    expect(screen.getByText('https://api.cohere.ai/compatibility/v1')).toBeDefined();
  });

  it('renders model table with model details', () => {
    render(() => <FreeModels />);
    expect(screen.getByText('command-a-03-2025')).toBeDefined();
    expect(screen.getByText('command-a-reasoning-08-2025')).toBeDefined();
    expect(screen.getAllByText('256K').length).toBe(2);
    expect(screen.getAllByText('20 req / min').length).toBe(2);
  });

  it('renders warning message', () => {
    render(() => <FreeModels />);
    expect(screen.getByText(/Trial keys cannot be used/)).toBeDefined();
  });

  it('toggles model visibility when clicking toggle button', () => {
    const { container } = render(() => <FreeModels />);
    const toggleBtn = screen.getByText('Hide models');
    fireEvent.click(toggleBtn);
    expect(screen.getByText('Show models (2)')).toBeDefined();
    fireEvent.click(screen.getByText('Show models (2)'));
    expect(screen.getByText('Hide models')).toBeDefined();
  });

  it('copies base URL to clipboard on Copy click', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    render(() => <FreeModels />);
    fireEvent.click(screen.getByText('Copy'));

    await vi.waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('https://api.cohere.ai/compatibility/v1');
      expect(toast.success).toHaveBeenCalledWith('Copied to clipboard');
    });
  });

  it('shows error toast when clipboard fails', async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new Error('fail'));
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    render(() => <FreeModels />);
    fireEvent.click(screen.getByText('Copy'));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to copy');
    });
  });
});

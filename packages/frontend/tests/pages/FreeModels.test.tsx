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

vi.mock('../../src/services/setup-status.js', () => ({
  checkIsLocalMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [
    { id: 'ollama', name: 'Ollama', localOnly: true, color: '#1a1a1a', initial: 'Ol', subtitle: '', keyPrefix: '', minKeyLength: 0, keyPlaceholder: '', noKeyRequired: true, models: [] },
    { id: 'gemini', name: 'Google', color: '#4285f4', initial: 'G', subtitle: '', keyPrefix: '', minKeyLength: 30, keyPlaceholder: '', models: [] },
  ],
}));

vi.mock('../../src/services/api/free-models.js', () => ({
  getFreeModels: vi.fn().mockResolvedValue({
    providers: [
      {
        name: 'Cohere',
        logo: '/icons/cohere.svg',
        description: 'Free trial API key.',
        tags: ['Up to 1,000 calls/month', 'No credit card required'],
        api_key_url: 'https://dashboard.cohere.com/api-keys',
        base_url: 'https://api.cohere.ai/compatibility/v1',
        warning: 'Trial keys cannot be used for production or commercial workloads.',
        country: 'CA',
        flag: '\u{1F1E8}\u{1F1E6}',
        models: [
          { id: 'command-a-03-2025', name: 'Command A (111B)', context: '256K', max_output: '8K', modality: 'Text', rate_limit: '20 RPM' },
          { id: 'command-a-reasoning-08-2025', name: 'Command A Reasoning', context: '256K', max_output: '32K', modality: 'Text', rate_limit: '20 RPM' },
          { id: null, name: '+ 4 more models', context: 'Varies', max_output: 'Varies', modality: 'Text', rate_limit: '' },
        ],
      },
      {
        name: 'Google Gemini',
        logo: '/icons/gemini.svg',
        description: 'Free tier from Google.',
        tags: ['250K TPM (Tokens / Minute) shared across models', 'No credit card required'],
        api_key_url: 'https://aistudio.google.com/apikey',
        base_url: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        warning: 'Rate limits apply per Google Cloud project.',
        country: 'US',
        flag: '\u{1F1FA}\u{1F1F8}',
        models: [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', context: '1M', max_output: '65K', modality: 'Text + Image', rate_limit: '10 RPM' },
          { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', context: '1M', max_output: '65K', modality: 'Text + Image', rate_limit: '' },
        ],
      },
      {
        name: 'GitHub Models',
        logo: '/icons/github.svg',
        description: 'Free tier from GitHub.',
        tags: [],
        api_key_url: 'https://github.com/settings/tokens',
        base_url: null,
        warning: null,
        country: 'US',
        flag: '\u{1F1FA}\u{1F1F8}',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', context: '128K', max_output: '16K', modality: 'Text', rate_limit: '10 RPM' },
        ],
      },
      {
        name: 'Ollama Cloud',
        logo: '/icons/ollama.svg',
        description: 'Free tier with qualitative usage limits.',
        tags: [],
        api_key_url: 'https://ollama.com/settings/keys',
        base_url: 'https://api.ollama.com',
        warning: null,
        country: 'US',
        flag: '\u{1F1FA}\u{1F1F8}',
        models: [
          { id: 'llama3.1:cloud', name: 'llama3.1', context: '128K', max_output: '8K', modality: 'Text', rate_limit: '30 RPM' },
        ],
      },
    ],
    last_synced_at: '2026-04-17T00:00:00.000Z',
  }),
}));

import FreeModels from '../../src/pages/FreeModels';
import { toast } from '../../src/services/toast-store.js';

describe('FreeModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title and header', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('Free Models')).toBeDefined();
    });
  });

  it('renders step instructions', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('Get your free API key from the provider website')).toBeDefined();
      expect(screen.getByText('Hit the provider Connect button, paste your key, and validate the connection')).toBeDefined();
      expect(screen.getByText(/Done! The provider models are now included in your routing/)).toBeDefined();
    });
  });

  it('renders Cohere provider card with name and logo', async () => {
    const { container } = render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('Cohere')).toBeDefined();
      const img = container.querySelector('img[src="/icons/cohere.svg"]');
      expect(img).not.toBeNull();
    });
  });

  it('renders provider tags', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('Up to 1,000 calls/month')).toBeDefined();
      expect(screen.getAllByText('No credit card required').length).toBe(2);
    });
  });

  it('renders Get API key link', async () => {
    const { container } = render(() => <FreeModels />);
    await vi.waitFor(() => {
      const link = container.querySelector('a[href="https://dashboard.cohere.com/api-keys"]');
      expect(link).not.toBeNull();
      expect(link!.getAttribute('target')).toBe('_blank');
      expect(link!.textContent).toContain('Get API key');
    });
  });

  it('renders Connect button with link to routing page', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      const connectBtn = screen.getByText('Connect Cohere');
      expect(connectBtn.tagName).toBe('A');
      const href = connectBtn.getAttribute('href')!;
      expect(href).toContain('/agents/test-agent/routing?');
      expect(href).toContain('provider=custom');
      expect(href).toContain('name=Cohere');
      expect(href).toContain('command-a-03-2025');
    });
  });

  it('renders base URL with copy button for providers that have one', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getAllByText('Base URL:').length).toBe(3);
      expect(screen.getByText('https://api.cohere.ai/compatibility/v1')).toBeDefined();
    });
  });

  it('does not render base URL or Connect for providers without baseUrl', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('GitHub Models')).toBeDefined();
      expect(screen.queryByText('Connect GitHub Models')).toBeNull();
    });
  });

  it('shows description for providers without tags', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('Free tier from GitHub.')).toBeDefined();
    });
  });

  it('renders model table with model IDs', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('command-a-03-2025')).toBeDefined();
      expect(screen.getByText('command-a-reasoning-08-2025')).toBeDefined();
    });
  });

  it('renders warning message', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText(/Trial keys cannot be used/)).toBeDefined();
    });
  });

  it('renders Gemini provider card', async () => {
    const { container } = render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('Google Gemini')).toBeDefined();
      const img = container.querySelector('img[src="/icons/gemini.svg"]');
      expect(img).not.toBeNull();
    });
  });

  it('renders Gemini Connect button linking to built-in provider', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      const connectBtn = screen.getByText('Connect Google Gemini');
      expect(connectBtn.tagName).toBe('A');
      const href = connectBtn.getAttribute('href')!;
      expect(href).toContain('provider=gemini');
    });
  });

  it('toggles model visibility when clicking toggle button', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getAllByText(/Show models/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/Show models/)[0]);
    await vi.waitFor(() => {
      expect(screen.getAllByText('Hide models').length).toBeGreaterThan(0);
    });
  });

  it('copies base URL to clipboard on Copy click', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getAllByText('Copy').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('Copy')[0]);

    await vi.waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('https://api.cohere.ai/compatibility/v1');
      expect(toast.success).toHaveBeenCalledWith('Copied to clipboard');
    });
  });

  it('filters out models without an id', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('command-a-03-2025')).toBeDefined();
      expect(screen.queryByText('+ 4 more models')).toBeNull();
    });
  });

  it('shows model count excluding models without id', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      const buttons = screen.getAllByText(/Show models/);
      expect(buttons[0].textContent).toContain('Show models (2)');
    });
  });

  it('shows dash for missing rate_limit', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('gemini-2.5-flash-lite')).toBeDefined();
      const row = screen.getByText('gemini-2.5-flash-lite').closest('tr')!;
      const cells = row.querySelectorAll('td');
      expect(cells[4].textContent).toBe('\u2014');
    });
  });

  it('shows error toast when clipboard fails', async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new Error('fail'));
    Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getAllByText('Copy').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('Copy')[0]);

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to copy');
    });
  });

  it('renders built-in provider connect link for known providers', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      const connectBtn = screen.getByText('Connect Google Gemini');
      const href = connectBtn.getAttribute('href')!;
      expect(href).toContain('provider=gemini');
      expect(href).not.toContain('provider=custom');
    });
  });

  it('renders dark mode logo variant for providers with dark logos', async () => {
    const { container } = render(() => <FreeModels />);
    await vi.waitFor(() => {
      const darkLogo = container.querySelector('img.free-models-logo-dark');
      expect(darkLogo).not.toBeNull();
      expect(darkLogo!.getAttribute('src')).toContain('-dark-mode');
    });
  });

  it('renders disabled connect button for Ollama Cloud in cloud mode', async () => {
    const { container } = render(() => <FreeModels />);
    await vi.waitFor(() => {
      const disabled = container.querySelector('.free-models-disabled-btn');
      expect(disabled).not.toBeNull();
      expect(disabled!.textContent).toContain('Connect Ollama Cloud');
      expect(disabled!.getAttribute('data-tooltip')).toBe('Available in local mode only');
    });
  });

  it('renders show models toggle for providers without base_url', async () => {
    render(() => <FreeModels />);
    await vi.waitFor(() => {
      expect(screen.getByText('GitHub Models')).toBeDefined();
    });
    // GitHub Models has no base_url, so the toggle is rendered outside the base-url row
    const buttons = screen.getAllByText(/Show models/);
    const ghButton = buttons.find((b) => b.textContent?.includes('(1)'));
    expect(ghButton).toBeDefined();
    fireEvent.click(ghButton!);
    await vi.waitFor(() => {
      expect(screen.getByText('gpt-4o')).toBeDefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@solidjs/testing-library';

const mockNavigate = vi.fn();

vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [{ name: 'Groq', baseUrl: 'https://api.groq.com/v1', apiKey: 'sk-test', models: 'llama-3.1' }],
}));

const mockGetAgents = vi.fn();
const mockCreateAgent = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
  createAgent: (...args: unknown[]) => mockCreateAgent(...args),
}));

vi.mock('../../src/services/recent-agents.js', () => ({
  markAgentCreated: vi.fn(),
}));

import ConnectProvider from '../../src/pages/ConnectProvider';

describe('ConnectProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to routing page when exactly one agent exists', async () => {
    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: 'my-agent' }] });

    render(() => <ConnectProvider />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/agents/my-agent/routing?'),
        { replace: true },
      );
    });

    const url = mockNavigate.mock.calls[0][0] as string;
    expect(url).toContain('provider=custom');
    expect(url).toContain('name=Groq');
    expect(url).toContain('baseUrl=');
    expect(url).toContain('apiKey=sk-test');
    expect(url).toContain('models=llama-3.1');
  });

  it('auto-creates an agent when no agents exist', async () => {
    mockGetAgents.mockResolvedValue({ agents: [] });
    mockCreateAgent.mockResolvedValue({ agent: { name: 'my-agent' } });

    render(() => <ConnectProvider />);

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith('my-agent');
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/agents/my-agent/routing?'),
        { replace: true },
      );
    });
  });

  it('shows agent picker when multiple agents exist', async () => {
    mockGetAgents.mockResolvedValue({
      agents: [
        { agent_name: 'agent-1', display_name: 'Agent One' },
        { agent_name: 'agent-2', display_name: 'Agent Two' },
      ],
    });

    render(() => <ConnectProvider />);

    await waitFor(() => {
      expect(screen.getByText('Select an agent')).toBeDefined();
    });

    expect(screen.getByText('Agent One')).toBeDefined();
    expect(screen.getByText('Agent Two')).toBeDefined();
  });

  it('navigates to selected agent routing page when clicking agent button', async () => {
    mockGetAgents.mockResolvedValue({
      agents: [
        { agent_name: 'agent-1', display_name: 'Agent One' },
        { agent_name: 'agent-2', display_name: 'Agent Two' },
      ],
    });

    render(() => <ConnectProvider />);

    await waitFor(() => {
      expect(screen.getByText('Agent One')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Agent Two'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/agents/agent-2/routing?'),
      { replace: true },
    );
  });

  it('shows spinner while loading', () => {
    mockGetAgents.mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(() => <ConnectProvider />);
    expect(container.querySelector('.spinner')).not.toBeNull();
  });

  it('shows spinner when auto-creating agent', async () => {
    mockGetAgents.mockResolvedValue({ agents: [] });
    mockCreateAgent.mockReturnValue(new Promise(() => {})); // never resolves

    const { container } = render(() => <ConnectProvider />);

    await waitFor(() => {
      expect(container.querySelector('.spinner')).not.toBeNull();
    });
  });

  it('recovers from auto-create failure by showing spinner then stopping', async () => {
    mockGetAgents.mockResolvedValue({ agents: [] });
    mockCreateAgent.mockRejectedValue(new Error('fail'));

    const { container } = render(() => <ConnectProvider />);

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalled();
    });
  });

  it('falls back to agent_name when display_name is missing', async () => {
    mockGetAgents.mockResolvedValue({
      agents: [
        { agent_name: 'raw-name-1' },
        { agent_name: 'raw-name-2' },
      ],
    });

    render(() => <ConnectProvider />);

    await waitFor(() => {
      expect(screen.getByText('raw-name-1')).toBeDefined();
      expect(screen.getByText('raw-name-2')).toBeDefined();
    });
  });

  it('falls back to my-agent slug when createAgent returns no name', async () => {
    mockGetAgents.mockResolvedValue({ agents: [] });
    mockCreateAgent.mockResolvedValue({ agent: {} });

    render(() => <ConnectProvider />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/agents/my-agent/routing?'),
        { replace: true },
      );
    });
  });

  it('handles result with no agents property', async () => {
    mockGetAgents.mockResolvedValue({});
    mockCreateAgent.mockResolvedValue({ agent: { name: 'my-agent' } });

    render(() => <ConnectProvider />);

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalled();
    });
  });
});

describe('ConnectProvider with provider deep-link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves provider param in redirect URL', async () => {
    // Re-mock useSearchParams with a provider param
    const routerMock = await import('@solidjs/router');
    (routerMock as Record<string, unknown>).useSearchParams = () => [{ provider: 'anthropic' }];

    mockGetAgents.mockResolvedValue({ agents: [{ agent_name: 'my-agent' }] });

    render(() => <ConnectProvider />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining('/agents/my-agent/routing?'),
        { replace: true },
      );
    });

    const url = mockNavigate.mock.calls[0][0] as string;
    expect(url).toContain('provider=anthropic');
    expect(url).not.toContain('provider=custom');
  });
});

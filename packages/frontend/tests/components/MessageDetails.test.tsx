import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

const mockGetMessageDetails = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  getMessageDetails: (...args: unknown[]) => mockGetMessageDetails(...args),
}));

vi.mock('../../src/services/formatters.js', () => ({
  formatDuration: (ms: number) => `${ms}ms`,
  formatTime: (t: string) => t,
  formatNumber: (v: number) => String(v),
}));

vi.mock('../../src/services/routing-utils.js', () => ({
  inferProviderName: (m: string) => {
    if (m.startsWith('gpt')) return 'OpenAI';
    if (m.startsWith('claude')) return 'Anthropic';
    if (m.startsWith('gemini')) return 'Google';
    return m;
  },
}));

vi.mock('../../src/services/model-display.js', () => ({
  getModelDisplayName: (slug: string) => {
    if (slug === 'gpt-4o') return 'GPT-4o';
    return slug;
  },
}));

import MessageDetails from '../../src/components/MessageDetails';

const detailsResponse = {
  message: {
    id: 'msg-1',
    timestamp: '2026-02-16 10:00:00',
    agent_name: 'test-agent',
    model: 'gpt-4o',
    status: 'ok',
    error_message: null,
    description: 'Test description',
    service_type: 'agent',
    input_tokens: 100,
    output_tokens: 50,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    cost_usd: 0.05,
    duration_ms: 1200,
    trace_id: 'trace-abc123',
    routing_tier: 'standard',
    routing_reason: null,
    auth_type: 'api_key',
    skill_name: null,
    fallback_from_model: null,
    fallback_index: null,
    session_key: 'sess-001',
  },
  llm_calls: [
    {
      id: 'lc-1',
      call_index: 0,
      request_model: 'gpt-4o',
      response_model: 'gpt-4o',
      gen_ai_system: 'openai',
      input_tokens: 100,
      output_tokens: 50,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      duration_ms: 800,
      ttft_ms: 120,
      temperature: 0.7,
      max_output_tokens: 4096,
      timestamp: '2026-02-16 10:00:01',
    },
  ],
  tool_executions: [
    {
      id: 'te-1',
      llm_call_id: 'lc-1',
      tool_name: 'Read',
      duration_ms: 50,
      status: 'ok',
      error_message: null,
    },
  ],
  agent_logs: [
    {
      id: 'al-1',
      severity: 'info',
      body: 'Agent started processing',
      timestamp: '2026-02-16 10:00:00',
      span_id: 'span-1',
    },
  ],
};

describe('MessageDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGetMessageDetails.mockReturnValue(new Promise(() => {}));
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    expect(container.querySelector('.msg-detail__spinner')).not.toBeNull();
    expect(container.textContent).toContain('Loading details');
  });

  it('displays LLM calls section', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('LLM Calls');
      expect(container.textContent).toContain('gpt-4o');
      expect(container.textContent).toContain('800ms');
      expect(container.textContent).toContain('120ms');
    });
  });

  it('displays tool executions section', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Tool Executions');
      expect(container.textContent).toContain('Read');
      expect(container.textContent).toContain('50ms');
    });
  });

  it('displays agent logs section', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Agent Logs');
      expect(container.textContent).toContain('Agent started processing');
      expect(container.textContent).toContain('info');
    });
  });

  it('displays trace ID in metadata', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Trace');
      expect(container.textContent).toContain('trace-abc123');
    });
  });

  it('displays description in metadata', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Description');
      expect(container.textContent).toContain('Test description');
    });
  });

  it('shows error message box when present', async () => {
    const errorResponse = {
      ...detailsResponse,
      message: {
        ...detailsResponse.message,
        status: 'error',
        error_message: '401 Unauthorized: invalid API key',
      },
    };
    mockGetMessageDetails.mockResolvedValue(errorResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      const errorBox = container.querySelector('.msg-detail__error-box');
      expect(errorBox).not.toBeNull();
      expect(errorBox!.textContent).toBe('401 Unauthorized: invalid API key');
    });
  });

  it('shows message summary even without related data', async () => {
    const emptyResponse = {
      message: { ...detailsResponse.message, error_message: null },
      llm_calls: [],
      tool_executions: [],
      agent_logs: [],
    };
    mockGetMessageDetails.mockResolvedValue(emptyResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Message');
      expect(container.textContent).toContain('Provider');
      expect(container.textContent).toContain('OpenAI');
      expect(container.textContent).not.toContain('LLM Calls');
    });
  });

  it('shows error state on API failure', async () => {
    mockGetMessageDetails.mockImplementation(() => Promise.reject(new Error('Network error')));
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      const errorEl = container.querySelector('.msg-detail__error');
      expect(errorEl).not.toBeNull();
    });
  });

  it('displays section counts', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      const counts = container.querySelectorAll('.msg-detail__count');
      expect(counts.length).toBe(3);
      expect(counts[0]!.textContent).toBe('1');
      expect(counts[1]!.textContent).toBe('1');
      expect(counts[2]!.textContent).toBe('1');
    });
  });

  it('displays tool execution status badge', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      const badge = container.querySelector('.status-badge--ok');
      expect(badge).not.toBeNull();
    });
  });

  it('displays tool execution error status', async () => {
    const errorToolResponse = {
      ...detailsResponse,
      tool_executions: [
        {
          id: 'te-err',
          llm_call_id: 'lc-1',
          tool_name: 'Write',
          duration_ms: 100,
          status: 'error',
          error_message: 'Permission denied',
        },
      ],
    };
    mockGetMessageDetails.mockResolvedValue(errorToolResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Permission denied');
      const badge = container.querySelector('.status-badge--error');
      expect(badge).not.toBeNull();
    });
  });

  it('displays severity dot with correct color for error logs', async () => {
    const errorLogResponse = {
      ...detailsResponse,
      agent_logs: [
        {
          id: 'al-err',
          severity: 'error',
          body: 'Critical failure',
          timestamp: '2026-02-16 10:00:00',
          span_id: null,
        },
      ],
    };
    mockGetMessageDetails.mockResolvedValue(errorLogResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      const dot = container.querySelector('.msg-detail__severity-dot');
      expect(dot).not.toBeNull();
      expect(dot!.getAttribute('title')).toBe('error');
    });
  });

  it('hides sections with no data', async () => {
    const partialResponse = {
      ...detailsResponse,
      tool_executions: [],
      agent_logs: [],
    };
    mockGetMessageDetails.mockResolvedValue(partialResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('LLM Calls');
      expect(container.textContent).not.toContain('Tool Executions');
      expect(container.textContent).not.toContain('Agent Logs');
    });
  });

  it('shows service type in metadata', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Service');
      expect(container.textContent).toContain('agent');
    });
  });

  it('calls API with correct message ID', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    render(() => <MessageDetails messageId="custom-id-xyz" />);
    await vi.waitFor(() => {
      expect(mockGetMessageDetails).toHaveBeenCalledWith('custom-id-xyz', expect.anything());
    });
  });

  it('displays message ID, model, and provider in metadata', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('ID');
      expect(container.textContent).toContain('msg-1');
      expect(container.textContent).toContain('Model');
      expect(container.textContent).toContain('GPT-4o');
      expect(container.textContent).toContain('Model ID');
      expect(container.textContent).toContain('gpt-4o');
      expect(container.textContent).toContain('Provider');
      expect(container.textContent).toContain('OpenAI');
    });
  });

  it('shows fallback banner when fallback_from_model is set', async () => {
    const fallbackResponse = {
      ...detailsResponse,
      message: {
        ...detailsResponse.message,
        fallback_from_model: 'gemini-2.5-flash-lite',
        fallback_index: 0,
      },
    };
    mockGetMessageDetails.mockResolvedValue(fallbackResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      const banner = container.querySelector('.msg-detail__fallback-banner');
      expect(banner).not.toBeNull();
      expect(banner!.textContent).toContain('gemini-2.5-flash-lite');
      expect(banner!.textContent).toContain('#1');
    });
  });

  it('hides fallback banner when no fallback', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.querySelector('.msg-detail__fallback-banner')).toBeNull();
    });
  });

  it('shows provider name derived from model', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Provider');
      expect(container.textContent).toContain('OpenAI');
    });
  });

  it('shows session key in metadata', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Session');
      expect(container.textContent).toContain('sess-001');
    });
  });

  it('displays routing and auth metadata', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Routing');
      expect(container.textContent).toContain('standard');
      expect(container.textContent).toContain('Auth');
      expect(container.textContent).toContain('api_key');
    });
  });

  it('shows em dash for null duration in LLM call', async () => {
    const nullDurationResponse = {
      ...detailsResponse,
      llm_calls: [{ ...detailsResponse.llm_calls[0], duration_ms: null, ttft_ms: null }],
    };
    mockGetMessageDetails.mockResolvedValue(nullDurationResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('LLM Calls');
      const cells = container.querySelectorAll('.msg-detail__table td');
      const durationValues = Array.from(cells).filter((c) => c.textContent === '\u2014');
      expect(durationValues.length).toBeGreaterThanOrEqual(2);
    });
  });
});

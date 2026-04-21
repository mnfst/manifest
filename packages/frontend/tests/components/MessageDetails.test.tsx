import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

const mockGetMessageDetails = vi.fn();
const mockFlagMiscategorized = vi.fn();
const mockClearMiscategorized = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  getMessageDetails: (...args: unknown[]) => mockGetMessageDetails(...args),
  flagMessageMiscategorized: (...args: unknown[]) => mockFlagMiscategorized(...args),
  clearMessageMiscategorized: (...args: unknown[]) => mockClearMiscategorized(...args),
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

  it('displays severity dot with warn color for warn logs', async () => {
    const warnLogResponse = {
      ...detailsResponse,
      agent_logs: [
        {
          id: 'al-warn',
          severity: 'warn',
          body: 'Deprecation notice',
          timestamp: '2026-02-16 10:00:00',
          span_id: null,
        },
      ],
    };
    mockGetMessageDetails.mockResolvedValue(warnLogResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      const dot = container.querySelector('.msg-detail__severity-dot') as HTMLElement;
      expect(dot).not.toBeNull();
      expect(dot.getAttribute('title')).toBe('warn');
      // The warn branch returns hsl(var(--chart-5)). The style attribute is a string.
      expect(dot.getAttribute('style') ?? '').toContain('--chart-5');
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

  it('renders em dashes for null call_index, request_model, and response_model in an LLM call', async () => {
    const nullFieldsResponse = {
      ...detailsResponse,
      llm_calls: [
        {
          ...detailsResponse.llm_calls[0],
          call_index: null,
          request_model: null,
          response_model: null,
        },
      ],
    };
    mockGetMessageDetails.mockResolvedValue(nullFieldsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('LLM Calls');
      const cells = container.querySelectorAll('.msg-detail__table td');
      const emDashes = Array.from(cells).filter((c) => c.textContent === '\u2014');
      // Three null fields → at least three em-dashes in the LLM-call row.
      expect(emDashes.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('renders em dash for null tool duration', async () => {
    const nullToolDurationResponse = {
      ...detailsResponse,
      tool_executions: [
        {
          id: 'te-null',
          llm_call_id: 'lc-1',
          tool_name: 'Bash',
          duration_ms: null,
          status: 'ok',
          error_message: null,
        },
      ],
    };
    mockGetMessageDetails.mockResolvedValue(nullToolDurationResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Bash');
      const cells = container.querySelectorAll('.msg-detail__table td');
      const emDashCells = Array.from(cells).filter((c) => c.textContent === '\u2014');
      expect(emDashCells.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders em dash for null log body', async () => {
    const nullBodyLogResponse = {
      ...detailsResponse,
      agent_logs: [
        {
          id: 'al-nobody',
          severity: 'info',
          body: null,
          timestamp: '2026-02-16 10:00:00',
          span_id: null,
        },
      ],
    };
    mockGetMessageDetails.mockResolvedValue(nullBodyLogResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      const logCells = container.querySelectorAll('.msg-detail__log-body');
      expect(logCells.length).toBe(1);
      expect(logCells[0]!.textContent).toBe('\u2014');
    });
  });

  it('omits Provider and Model when the message has no model attached', async () => {
    const noModelResponse = {
      ...detailsResponse,
      message: { ...detailsResponse.message, model: null },
    };
    mockGetMessageDetails.mockResolvedValue(noModelResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      // With model=null, inferProviderName isn't called and `Provider` MetaField
      // renders nothing (value is null).
      expect(container.textContent).toContain('Message');
      expect(container.textContent).not.toContain('Provider');
      expect(container.textContent).not.toContain('Model ID');
    });
  });

  it('omits the attempt # when fallback_index is null but fallback_from_model is set', async () => {
    const fallbackNoIndexResponse = {
      ...detailsResponse,
      message: {
        ...detailsResponse.message,
        fallback_from_model: 'gemini-2.5-flash-lite',
        fallback_index: null,
      },
    };
    mockGetMessageDetails.mockResolvedValue(fallbackNoIndexResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      const banner = container.querySelector('.msg-detail__fallback-banner');
      expect(banner).not.toBeNull();
      expect(banner!.textContent).toContain('gemini-2.5-flash-lite');
      // Without fallback_index, the "(attempt #N)" suffix is hidden.
      expect(banner!.textContent).not.toContain('attempt #');
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

  describe('miscategorization control', () => {
    const specificityResponse = {
      ...detailsResponse,
      message: {
        ...detailsResponse.message,
        specificity_category: 'web_browsing',
        specificity_miscategorized: false,
      },
    };

    it('is hidden when the message was not routed by specificity', async () => {
      mockGetMessageDetails.mockResolvedValue(detailsResponse);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('Routing');
      });
      expect(container.querySelector('.msg-detail__miscat-btn')).toBeNull();
    });

    it('shows the button when specificity_category is set', async () => {
      mockGetMessageDetails.mockResolvedValue(specificityResponse);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      await vi.waitFor(() => {
        const btn = container.querySelector('.msg-detail__miscat-btn') as HTMLButtonElement;
        expect(btn).not.toBeNull();
        expect(btn.textContent).toContain('Wrong category?');
      });
    });

    it('reflects already-flagged state on initial render', async () => {
      const flagged = {
        ...specificityResponse,
        message: { ...specificityResponse.message, specificity_miscategorized: true },
      };
      mockGetMessageDetails.mockResolvedValue(flagged);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      await vi.waitFor(() => {
        const btn = container.querySelector('.msg-detail__miscat-btn') as HTMLButtonElement;
        expect(btn).not.toBeNull();
        expect(btn.getAttribute('aria-pressed')).toBe('true');
        expect(btn.textContent).toContain('undo');
      });
    });

    it('calls flag API on first click and reveals undo state', async () => {
      mockGetMessageDetails.mockResolvedValue(specificityResponse);
      mockFlagMiscategorized.mockResolvedValue(undefined);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      const btn = await vi.waitFor(() => {
        const b = container.querySelector('.msg-detail__miscat-btn') as HTMLButtonElement;
        expect(b).not.toBeNull();
        return b;
      });
      btn.click();
      await vi.waitFor(() => {
        expect(mockFlagMiscategorized).toHaveBeenCalledWith('msg-1');
        expect(btn.getAttribute('aria-pressed')).toBe('true');
      });
    });

    it('calls clear API when undoing a flag', async () => {
      const flagged = {
        ...specificityResponse,
        message: { ...specificityResponse.message, specificity_miscategorized: true },
      };
      mockGetMessageDetails.mockResolvedValue(flagged);
      mockClearMiscategorized.mockResolvedValue(undefined);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      const btn = await vi.waitFor(() => {
        const b = container.querySelector('.msg-detail__miscat-btn') as HTMLButtonElement;
        expect(b).not.toBeNull();
        return b;
      });
      btn.click();
      await vi.waitFor(() => {
        expect(mockClearMiscategorized).toHaveBeenCalledWith('msg-1');
        expect(btn.getAttribute('aria-pressed')).toBe('false');
      });
    });

    it('ignores rapid clicks while a request is in flight', async () => {
      mockGetMessageDetails.mockResolvedValue(specificityResponse);
      let resolveFlag: (() => void) | null = null;
      mockFlagMiscategorized.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveFlag = resolve;
        }),
      );
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      const btn = await vi.waitFor(() => {
        const b = container.querySelector('.msg-detail__miscat-btn') as HTMLButtonElement;
        expect(b).not.toBeNull();
        return b;
      });
      // The handler sets busy=true on the first click and early-returns on
      // subsequent clicks while the flag request is pending. Yielding to the
      // microtask queue between clicks lets the `setBusy(true)` write settle
      // so the second click's `if (busy()) return` guard fires.
      btn.click();
      await Promise.resolve();
      await Promise.resolve();
      btn.click();
      await Promise.resolve();
      btn.click();
      resolveFlag!();
      await vi.waitFor(() => {
        expect(mockFlagMiscategorized).toHaveBeenCalledTimes(1);
      });
    });
  });
});

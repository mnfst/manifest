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

  it('shows message summary', async () => {
    const summaryResponse = {
      message: { ...detailsResponse.message, error_message: null },
    };
    mockGetMessageDetails.mockResolvedValue(summaryResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Message');
      expect(container.textContent).toContain('Provider');
      expect(container.textContent).toContain('OpenAI');
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

  it('renders App and SDK metadata when caller_attribution is present', async () => {
    const withAttribution = {
      ...detailsResponse,
      message: {
        ...detailsResponse.message,
        caller_attribution: {
          sdk: 'openai-js',
          sdkVersion: '6.26.0',
          appName: 'OpenClaw',
          appUrl: 'https://openclaw.dev',
        },
      },
    };
    mockGetMessageDetails.mockResolvedValue(withAttribution);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('App');
      expect(container.textContent).toContain('OpenClaw');
      expect(container.textContent).toContain('SDK');
      expect(container.textContent).toContain('openai-js');
    });
  });

  it('hides App and SDK fields when caller_attribution is null', async () => {
    mockGetMessageDetails.mockResolvedValue(detailsResponse);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Message');
    });
    const labels = Array.from(container.querySelectorAll('.msg-detail__meta-label')).map(
      (n) => n.textContent,
    );
    expect(labels).not.toContain('App');
    expect(labels).not.toContain('SDK');
  });

  it('renders Request Headers section collapsed by default with a visible count', async () => {
    const withHeaders = {
      ...detailsResponse,
      message: {
        ...detailsResponse.message,
        request_headers: {
          'user-agent': 'curl/8.14.1',
          'x-custom-foo': 'bar',
          'content-type': 'application/json',
        },
      },
    };
    mockGetMessageDetails.mockResolvedValue(withHeaders);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Request Headers');
    });

    // Title button is visible with aria-expanded="false"
    const toggle = container.querySelector(
      '.msg-detail__section-title--toggle',
    ) as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle!.tagName).toBe('BUTTON');
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');

    // Count badge stays visible when collapsed. Request Headers uses the
    // `msg-detail__count-badge` styling (border + bg).
    const headerCount = container.querySelector('.msg-detail__count-badge');
    expect(headerCount).not.toBeNull();
    expect(headerCount!.textContent).toBe('3');

    // Table body is not rendered while collapsed.
    expect(container.textContent).not.toContain('curl/8.14.1');
    expect(container.textContent).not.toContain('x-custom-foo');
    // No tables render while the only collapsible section is collapsed.
    const tables = container.querySelectorAll('table.msg-detail__table');
    expect(tables.length).toBe(0);
  });

  it('expands Request Headers when the title is clicked, and collapses on second click', async () => {
    const withHeaders = {
      ...detailsResponse,
      message: {
        ...detailsResponse.message,
        request_headers: {
          'user-agent': 'curl/8.14.1',
          'x-custom-foo': 'bar',
        },
      },
    };
    mockGetMessageDetails.mockResolvedValue(withHeaders);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Request Headers');
    });

    const toggle = container.querySelector(
      '.msg-detail__section-title--toggle',
    ) as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    // Expand.
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('curl/8.14.1');
    expect(container.textContent).toContain('x-custom-foo');
    expect(container.textContent).toContain('bar');

    // aria-controls points at the now-rendered table wrapper.
    const controlsId = toggle.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    expect(container.querySelector(`#${controlsId}`)).not.toBeNull();

    // Collapse again.
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('curl/8.14.1');
  });

  it('renders header rows sorted alphabetically by key when expanded', async () => {
    const withHeaders = {
      ...detailsResponse,
      message: {
        ...detailsResponse.message,
        request_headers: { 'z-last': '3', 'a-first': '1', 'm-mid': '2' },
      },
    };
    mockGetMessageDetails.mockResolvedValue(withHeaders);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Request Headers');
    });
    const toggle = container.querySelector(
      '.msg-detail__section-title--toggle',
    ) as HTMLButtonElement;
    toggle.click();
    const tables = container.querySelectorAll('table.msg-detail__table');
    // First table after expanding is Request Headers.
    const headersTable = tables[0]!;
    const keyCells = Array.from(headersTable.querySelectorAll('tbody tr td:first-child')).map(
      (c) => c.textContent,
    );
    expect(keyCells).toEqual(['a-first', 'm-mid', 'z-last']);
  });

  it('rotates the chevron when the Request Headers section is expanded', async () => {
    const withHeaders = {
      ...detailsResponse,
      message: {
        ...detailsResponse.message,
        request_headers: { 'a-first': '1' },
      },
    };
    mockGetMessageDetails.mockResolvedValue(withHeaders);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Request Headers');
    });
    const chevron = container.querySelector('.msg-detail__chevron')!;
    expect(chevron.classList.contains('msg-detail__chevron--open')).toBe(false);
    const toggle = container.querySelector(
      '.msg-detail__section-title--toggle',
    ) as HTMLButtonElement;
    toggle.click();
    expect(chevron.classList.contains('msg-detail__chevron--open')).toBe(true);
  });

  it('hides Request Headers section when headers are null', async () => {
    const noHeaders = {
      ...detailsResponse,
      message: { ...detailsResponse.message, request_headers: null },
    };
    mockGetMessageDetails.mockResolvedValue(noHeaders);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Message');
    });
    expect(container.textContent).not.toContain('Request Headers');
  });

  it('hides Request Headers section when headers are an empty object', async () => {
    const empty = {
      ...detailsResponse,
      message: { ...detailsResponse.message, request_headers: {} },
    };
    mockGetMessageDetails.mockResolvedValue(empty);
    const { container } = render(() => <MessageDetails messageId="msg-1" />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Message');
    });
    expect(container.textContent).not.toContain('Request Headers');
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

  // The Model Parameters section is purely additive — every existing test
  // above this block uses a `detailsResponse` fixture that never sets
  // `request_params`, so they implicitly verify the back-compat property
  // (rows created before this feature stay visually unchanged).
  describe('Model Parameters section', () => {
    it('stays hidden for messages without request_params (back-compat for pre-feature rows)', async () => {
      // No `request_params` on the base fixture → the dashboard renders
      // exactly as it did before the column existed, so nothing breaks for
      // historical data captured before the migration ran.
      mockGetMessageDetails.mockResolvedValue(detailsResponse);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('Message');
      });
      expect(container.textContent).not.toContain('Model Parameters');
    });

    it('stays hidden when request_params is explicitly null', async () => {
      const nullParams = {
        ...detailsResponse,
        message: { ...detailsResponse.message, request_params: null },
      };
      mockGetMessageDetails.mockResolvedValue(nullParams);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('Message');
      });
      expect(container.textContent).not.toContain('Model Parameters');
    });

    it('stays hidden when request_params is an empty object', async () => {
      const emptyParams = {
        ...detailsResponse,
        message: { ...detailsResponse.message, request_params: {} },
      };
      mockGetMessageDetails.mockResolvedValue(emptyParams);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('Message');
      });
      expect(container.textContent).not.toContain('Model Parameters');
    });

    it('renders the section with a count badge for a DeepSeek thinking-disabled request', async () => {
      const withParams = {
        ...detailsResponse,
        message: {
          ...detailsResponse.message,
          request_params: { thinking: { type: 'disabled' } },
        },
      };
      mockGetMessageDetails.mockResolvedValue(withParams);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('Model Parameters');
      });
      // The section header shows a "1" count to match the single param key.
      const titleButton = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.msg-detail__section-title--toggle'),
      ).find((b) => b.textContent?.includes('Model Parameters'));
      expect(titleButton).toBeDefined();
      expect(titleButton!.textContent).toContain('1');
    });

    it('expands on toggle and pretty-prints the thinking object value across multiple lines', async () => {
      const withParams = {
        ...detailsResponse,
        message: {
          ...detailsResponse.message,
          request_params: { thinking: { type: 'disabled' } },
        },
      };
      mockGetMessageDetails.mockResolvedValue(withParams);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      const titleButton = await vi.waitFor(() => {
        const b = Array.from(
          container.querySelectorAll<HTMLButtonElement>('.msg-detail__section-title--toggle'),
        ).find((btn) => btn.textContent?.includes('Model Parameters'));
        expect(b).toBeDefined();
        return b!;
      });
      titleButton.click();
      await vi.waitFor(() => {
        const valueCell = container.querySelector('.msg-detail__param-value');
        expect(valueCell).not.toBeNull();
        // Pretty-printed JSON keeps the inner key on its own line, so a long
        // value never collapses into an unbreakable single token in the cell.
        expect(valueCell!.textContent).toContain('"type": "disabled"');
        expect(valueCell!.textContent).toContain('\n');
      });
    });

    it('toggles the chevron when expanded', async () => {
      const withParams = {
        ...detailsResponse,
        message: {
          ...detailsResponse.message,
          request_params: { thinking: { type: 'enabled' } },
        },
      };
      mockGetMessageDetails.mockResolvedValue(withParams);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      const titleButton = await vi.waitFor(() => {
        const b = Array.from(
          container.querySelectorAll<HTMLButtonElement>('.msg-detail__section-title--toggle'),
        ).find((btn) => btn.textContent?.includes('Model Parameters'));
        expect(b).toBeDefined();
        return b!;
      });
      const chevron = titleButton.querySelector('.msg-detail__chevron')!;
      expect(chevron.classList.contains('msg-detail__chevron--open')).toBe(false);
      titleButton.click();
      expect(chevron.classList.contains('msg-detail__chevron--open')).toBe(true);
    });

    it("renders an info tooltip explaining what model parameters are and that the surface will grow", async () => {
      const withParams = {
        ...detailsResponse,
        message: {
          ...detailsResponse.message,
          request_params: { thinking: { type: 'disabled' } },
        },
      };
      mockGetMessageDetails.mockResolvedValue(withParams);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('Model Parameters');
      });
      // The tooltip lives next to the toggle button as a sibling — putting
      // it inside the button would nest interactive elements (invalid HTML).
      const row = container.querySelector('.msg-detail__section-row');
      expect(row).not.toBeNull();
      const tooltip = row!.querySelector('.info-tooltip');
      expect(tooltip).not.toBeNull();
      const aria = tooltip!.getAttribute('aria-label') ?? '';
      // Today's only example — DeepSeek's `thinking` toggle.
      expect(aria.toLowerCase()).toContain('thinking');
      // Forward-compat promise — the tooltip explicitly hints at custom
      // user-defined parameters landing here as the feature ships.
      expect(aria.toLowerCase()).toContain('custom');
    });

    it('renders Model Parameters above Request Headers — user intent before protocol noise', async () => {
      // When both sections are present, Model Parameters comes first in the
      // DOM. Headers are protocol noise; params are user intent. The reading
      // order in routing analytics is intent → wire → response.
      const withBoth = {
        ...detailsResponse,
        message: {
          ...detailsResponse.message,
          request_headers: { 'a-first': '1' },
          request_params: { thinking: { type: 'disabled' } },
        },
      };
      mockGetMessageDetails.mockResolvedValue(withBoth);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      await vi.waitFor(() => {
        expect(container.textContent).toContain('Model Parameters');
        expect(container.textContent).toContain('Request Headers');
      });
      const html = container.innerHTML;
      expect(html.indexOf('Model Parameters')).toBeLessThan(html.indexOf('Request Headers'));
    });

    it('renders multiple parameter keys as separate rows, sorted alphabetically — forward-compat for new providers', async () => {
      // Demonstrates the surface stays sane as we add more provider knobs
      // (`reasoning_effort` for OpenAI o-series, `safety` for Gemini, etc.)
      // and as users define their own per-custom-provider keys.
      const futureMultiKey = {
        ...detailsResponse,
        message: {
          ...detailsResponse.message,
          request_params: {
            thinking: { type: 'enabled' },
            reasoning_effort: 'high',
            // A user-defined custom-provider param — the JSONB column accepts
            // arbitrary keys so future custom-model UIs can land here without
            // a migration.
            custom_safety_level: 'permissive',
          },
        },
      };
      mockGetMessageDetails.mockResolvedValue(futureMultiKey);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      const titleButton = await vi.waitFor(() => {
        const b = Array.from(
          container.querySelectorAll<HTMLButtonElement>('.msg-detail__section-title--toggle'),
        ).find((btn) => btn.textContent?.includes('Model Parameters'));
        expect(b).toBeDefined();
        return b!;
      });
      // Three keys → count badge shows 3.
      expect(titleButton.textContent).toContain('3');
      titleButton.click();
      // Scope the key-extraction to the Model Parameters table specifically;
      // the Request Headers section also uses `.msg-detail__table` and would
      // dilute a global selector. The wrapper id starts with
      // `msg-detail-model-params-` for exactly this kind of disambiguation.
      await vi.waitFor(() => {
        const wrapper = Array.from(container.querySelectorAll<HTMLElement>('[id]')).find((el) =>
          el.id.startsWith('msg-detail-model-params-'),
        );
        expect(wrapper).toBeDefined();
        const keyCells = Array.from(
          wrapper!.querySelectorAll<HTMLTableCellElement>('tbody tr td:first-child'),
        ).map((c) => c.textContent?.trim());
        expect(keyCells).toEqual(['custom_safety_level', 'reasoning_effort', 'thinking']);
      });
    });

    it('renders primitive parameter values directly without JSON quoting', async () => {
      // Forward-compat: not every future param is an object. Strings,
      // numbers, booleans should render as their natural string form so a
      // value like `reasoning_effort: "high"` shows as `high`, not `"high"`.
      const primitives = {
        ...detailsResponse,
        message: {
          ...detailsResponse.message,
          request_params: {
            string_param: 'high',
            number_param: 42,
            boolean_param: true,
          },
        },
      };
      mockGetMessageDetails.mockResolvedValue(primitives);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      const titleButton = await vi.waitFor(() => {
        const b = Array.from(
          container.querySelectorAll<HTMLButtonElement>('.msg-detail__section-title--toggle'),
        ).find((btn) => btn.textContent?.includes('Model Parameters'));
        expect(b).toBeDefined();
        return b!;
      });
      titleButton.click();
      await vi.waitFor(() => {
        const cells = Array.from(
          container.querySelectorAll<HTMLTableCellElement>('.msg-detail__param-value'),
        ).map((c) => c.textContent?.trim());
        expect(cells).toContain('high');
        expect(cells).toContain('42');
        expect(cells).toContain('true');
        // Specifically NOT quoted as JSON literals.
        expect(cells).not.toContain('"high"');
      });
    });

    it("renders 'null' for a parameter explicitly set to null", async () => {
      const nullValue = {
        ...detailsResponse,
        message: {
          ...detailsResponse.message,
          request_params: { thinking: null },
        },
      };
      mockGetMessageDetails.mockResolvedValue(nullValue);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      const titleButton = await vi.waitFor(() => {
        const b = Array.from(
          container.querySelectorAll<HTMLButtonElement>('.msg-detail__section-title--toggle'),
        ).find((btn) => btn.textContent?.includes('Model Parameters'));
        expect(b).toBeDefined();
        return b!;
      });
      titleButton.click();
      await vi.waitFor(() => {
        const valueCell = container.querySelector('.msg-detail__param-value');
        expect(valueCell).not.toBeNull();
        expect(valueCell!.textContent?.trim()).toBe('null');
      });
    });

    it('renders an em-dash for a parameter whose value is undefined (defensive — JSONB never stores undefined directly but the render path stays consistent with other empty cells)', async () => {
      // JSONB can't actually store `undefined` — Postgres turns it into
      // NULL. But the render helper handles `undefined` defensively so the
      // table cell never collapses to blank if a future code path ever
      // serializes that way (e.g. a TypeORM intermediate step). Em-dash
      // matches the convention used everywhere else in this panel.
      const undefValue = {
        ...detailsResponse,
        message: {
          ...detailsResponse.message,
          request_params: { ghost: undefined },
        },
      };
      mockGetMessageDetails.mockResolvedValue(undefValue);
      const { container } = render(() => <MessageDetails messageId="msg-1" />);
      const titleButton = await vi.waitFor(() => {
        const b = Array.from(
          container.querySelectorAll<HTMLButtonElement>('.msg-detail__section-title--toggle'),
        ).find((btn) => btn.textContent?.includes('Model Parameters'));
        expect(b).toBeDefined();
        return b!;
      });
      titleButton.click();
      await vi.waitFor(() => {
        const valueCell = container.querySelector('.msg-detail__param-value');
        expect(valueCell).not.toBeNull();
        expect(valueCell!.textContent?.trim()).toBe('—');
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';

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
    return m;
  },
}));

vi.mock('../../src/services/model-display.js', () => ({
  getModelDisplayName: (slug: string) => slug,
}));

import MessageDetails from '../../src/components/MessageDetails';

// The Auto-fix model is now two linked rows: a failed `original` and its
// successful `retry`. Each row carries `autofix_role`, the Phoenix
// `autofix_operations`, and an `autofix_sibling` pointer to the paired row.
const baseMessage = {
  id: 'msg-1',
  timestamp: '2026-02-16 10:00:00',
  agent_name: 'test-agent',
  model: 'gpt-4o',
  status: 'error',
  error_message: null,
  description: null,
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
  specificity_category: null,
  specificity_miscategorized: false,
  auth_type: 'api_key',
  provider_key_label: null,
  skill_name: null,
  fallback_from_model: null,
  fallback_index: null,
  session_key: null,
  feedback_rating: null,
  feedback_tags: null,
  feedback_details: null,
  request_headers: null,
  request_params: null,
  header_tier_id: null,
  header_tier_name: null,
  header_tier_color: null,
  caller_attribution: null,
  autofix_applied: false,
  autofix_role: null,
  autofix_operations: null,
  autofix_phoenix: null,
  autofix_sibling: null,
};

// The failed original: 400'd on an unknown parameter, Phoenix renamed it, and
// it links forward to the successful retry row.
const originalResponse = {
  message: {
    ...baseMessage,
    id: 'orig-1',
    status: 'error',
    error_message: 'Unknown parameter: max_tokens',
    autofix_applied: true,
    autofix_role: 'original',
    autofix_operations: [{ type: 'rename_param', from: 'max_tokens', to: 'max_output_tokens' }],
    autofix_sibling: { id: 'retry-1', role: 'retry', status: 'ok' },
  },
};

// The successful retry: 200 after the patch, linking back to the original.
const retryResponse = {
  message: {
    ...baseMessage,
    id: 'retry-1',
    status: 'ok',
    error_message: null,
    autofix_applied: true,
    autofix_role: 'retry',
    autofix_operations: null,
    autofix_sibling: { id: 'orig-1', role: 'original', status: 'error' },
  },
};

describe('MessageDetails Auto-fix section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('renders the original-side panel: banner, operation, and the retry link', async () => {
    mockGetMessageDetails.mockResolvedValue(originalResponse);
    const onOpenMessage = vi.fn();
    const { container } = render(() => (
      <MessageDetails messageId="orig-1" onOpenMessage={onOpenMessage} />
    ));

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Auto-fix');
    });

    // Section title.
    const titles = Array.from(container.querySelectorAll('.msg-detail__section-title')).map((n) =>
      n.textContent,
    );
    expect(titles).toContain('Auto-fix');

    // The original-side banner explains the request was repaired then retried.
    expect(container.textContent).toContain(
      'This request failed and was automatically repaired, then retried.',
    );

    // The Phoenix operation renders as `type: from → to`.
    expect(container.textContent).toContain('rename_param: max_tokens → max_output_tokens');

    // The forward link to the successful retry.
    const link = container.querySelector('.msg-detail__autofix-link');
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe('→ View the successful auto-fix retry');

    // Clicking it opens the sibling (retry) row.
    fireEvent.click(link!);
    expect(onOpenMessage).toHaveBeenCalledWith('retry-1');
  });

  it('renders the retry-side panel: banner and the back-link to the original', async () => {
    mockGetMessageDetails.mockResolvedValue(retryResponse);
    const onOpenMessage = vi.fn();
    const { container } = render(() => (
      <MessageDetails messageId="retry-1" onOpenMessage={onOpenMessage} />
    ));

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Auto-fix');
    });

    // The retry-side banner.
    expect(container.textContent).toContain('Successful retry of a request Manifest auto-fixed.');

    // The back-link to the original failed request.
    const link = container.querySelector('.msg-detail__autofix-link');
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe('← View the original failed request');

    fireEvent.click(link!);
    expect(onOpenMessage).toHaveBeenCalledWith('orig-1');
  });

  it('does not render the Auto-fix section when autofix_applied is false', async () => {
    mockGetMessageDetails.mockResolvedValue({ message: { ...baseMessage } });
    const onOpenMessage = vi.fn();
    const { container } = render(() => (
      <MessageDetails messageId="msg-1" onOpenMessage={onOpenMessage} />
    ));

    await vi.waitFor(() => {
      // Wait for the panel to render at all.
      expect(container.textContent).toContain('Message');
    });

    // No Auto-fix title and no link.
    const titles = Array.from(container.querySelectorAll('.msg-detail__section-title')).map((n) =>
      n.textContent,
    );
    expect(titles).not.toContain('Auto-fix');
    expect(container.querySelector('.msg-detail__autofix-link')).toBeNull();
  });

  it('omits the sibling link when onOpenMessage is not provided', async () => {
    // A sibling exists, but with no handler the link can go nowhere — so it is
    // not rendered. The banner still appears.
    mockGetMessageDetails.mockResolvedValue(originalResponse);
    const { container } = render(() => <MessageDetails messageId="orig-1" />);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Auto-fix');
    });

    expect(container.textContent).toContain(
      'This request failed and was automatically repaired, then retried.',
    );
    expect(container.querySelector('.msg-detail__autofix-link')).toBeNull();
  });

  it('shows the "could not repair" banner and no link when autofix_sibling is null', async () => {
    // An `original` row with no retry sibling means Auto-fix ran but never
    // produced a working request — the banner must not claim it was repaired,
    // and there is no sibling to link to.
    const noSibling = {
      message: {
        ...originalResponse.message,
        autofix_sibling: null,
      },
    };
    mockGetMessageDetails.mockResolvedValue(noSibling);
    const onOpenMessage = vi.fn();
    const { container } = render(() => (
      <MessageDetails messageId="orig-1" onOpenMessage={onOpenMessage} />
    ));

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Auto-fix');
    });

    // The "could not repair" banner, not the "repaired then retried" one.
    expect(container.textContent).toContain(
      'This request failed. Auto-fix tried but could not repair it.',
    );
    expect(container.textContent).not.toContain(
      'This request failed and was automatically repaired, then retried.',
    );

    // The section still renders its operation chips, but there is no link.
    expect(container.textContent).toContain('rename_param: max_tokens → max_output_tokens');
    expect(container.querySelector('.msg-detail__autofix-link')).toBeNull();
  });

  it('renders the Auto-fix banner with no operations chips when the list is empty', async () => {
    // Defensive: autofix_applied is true but no operations serialized. The
    // `operations && operations.length > 0` guard keeps the chips row absent.
    const noOps = {
      message: {
        ...retryResponse.message,
        autofix_operations: [],
      },
    };
    mockGetMessageDetails.mockResolvedValue(noOps);
    const onOpenMessage = vi.fn();
    const { container } = render(() => (
      <MessageDetails messageId="retry-1" onOpenMessage={onOpenMessage} />
    ));

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Auto-fix');
    });
    // Banner present, no operation chips, but the sibling link still renders.
    expect(container.textContent).toContain('Successful retry of a request Manifest auto-fixed.');
    expect(container.textContent).not.toContain('rename_param');
    expect(container.querySelector('.msg-detail__autofix-link')).not.toBeNull();
  });

  it('renders an operation chip without an arrow when from/to are missing', async () => {
    // An operation type that is not a param-rename carries no from/to, so the
    // `: from → to` suffix is suppressed. Sibling omitted so the only place a
    // `→` could appear is the operation chip itself.
    const bareOp = {
      message: {
        ...originalResponse.message,
        autofix_operations: [{ type: 'strip_unsupported_field' }],
        autofix_sibling: null,
      },
    };
    mockGetMessageDetails.mockResolvedValue(bareOp);
    const onOpenMessage = vi.fn();
    const { container } = render(() => (
      <MessageDetails messageId="orig-1" onOpenMessage={onOpenMessage} />
    ));

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Auto-fix');
    });
    expect(container.textContent).toContain('strip_unsupported_field');
    expect(container.textContent).not.toContain('→');
  });

  it('renders Phoenix issue/patch/heal ids (first 8 chars) when autofix_phoenix is present', async () => {
    // Phoenix's own identifiers for the heal decision. Each id renders as a
    // labelled 8-char slice: "Issue <8>", "Patch <8>", "Heal-attempt <8>".
    const withPhoenix = {
      message: {
        ...originalResponse.message,
        autofix_applied: true,
        autofix_role: 'original',
        autofix_phoenix: {
          issueId: 'issue-1234abcd',
          patchId: 'patch-5678efgh',
          healAttemptId: 'heal-9012ijkl',
        },
      },
    };
    mockGetMessageDetails.mockResolvedValue(withPhoenix);
    const onOpenMessage = vi.fn();
    const { container } = render(() => (
      <MessageDetails messageId="orig-1" onOpenMessage={onOpenMessage} />
    ));

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Auto-fix');
    });

    // 8-char slices of each id, with their labels.
    expect(container.textContent).toContain('Issue issue-12');
    expect(container.textContent).toContain('Patch patch-56');
    expect(container.textContent).toContain('Heal-attempt heal-901');
  });

  it('renders only the Heal-attempt id when issueId and patchId are absent', async () => {
    // Exercises the `issueId || patchId || healAttemptId` OR short-circuit past
    // the first two operands: only healAttemptId is present, so the Issue/Patch
    // chips are suppressed while the section still shows the heal id.
    const healOnly = {
      message: {
        ...originalResponse.message,
        autofix_applied: true,
        autofix_role: 'original',
        autofix_phoenix: {
          issueId: null,
          patchId: null,
          healAttemptId: 'heal-9012ijkl',
        },
      },
    };
    mockGetMessageDetails.mockResolvedValue(healOnly);
    const onOpenMessage = vi.fn();
    const { container } = render(() => (
      <MessageDetails messageId="orig-1" onOpenMessage={onOpenMessage} />
    ));

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Auto-fix');
    });

    expect(container.textContent).toContain('Heal-attempt heal-901');
    expect(container.textContent).not.toContain('Issue ');
    expect(container.textContent).not.toContain('Patch ');
  });

  it('renders no Phoenix ids when autofix_phoenix is null', async () => {
    // The original-side panel with autofix_phoenix null (the default) must not
    // render any Issue/Patch/Heal-attempt labels — covers the absent branch.
    mockGetMessageDetails.mockResolvedValue(originalResponse);
    const onOpenMessage = vi.fn();
    const { container } = render(() => (
      <MessageDetails messageId="orig-1" onOpenMessage={onOpenMessage} />
    ));

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Auto-fix');
    });

    expect(container.textContent).not.toContain('Issue ');
    expect(container.textContent).not.toContain('Patch ');
    expect(container.textContent).not.toContain('Heal-attempt');
  });
});

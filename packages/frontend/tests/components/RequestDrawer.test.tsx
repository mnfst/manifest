import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

const mockGetMessageDetails = vi.fn();

vi.mock('../../src/services/api/messages.js', () => ({
  getMessageDetails: (...args: unknown[]) => mockGetMessageDetails(...args),
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (provider: string) => <span data-provider={provider} />,
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: (authType: string) => <span data-auth={authType} />,
}));

vi.mock('../../src/components/MessageDetailsSections.jsx', () => ({
  formatParamValue: (value: unknown) => JSON.stringify(value),
}));

import RequestDrawer from '../../src/components/RequestDrawer';

const fullMessage = {
  id: 'request-1234567890',
  status: 'auto_fixed',
  provider: 'openai',
  model: 'requested-model',
  model_id: 'requested-model-id',
  auth_type: 'api_key',
  timestamp: '2026-07-15T10:11:12Z',
  trace_id: 'request-trace',
  service_type: 'chat',
  session_key: 'session',
  description: 'request description',
  error_message: 'request failed',
  fallback_from_model: 'old-model',
  fallback_index: 1,
  autofix_applied: true,
  autofix_phoenix: { issueId: 'issue' },
  attempts: [
    {
      id: 'attempt-1',
      status: 'auto_fixed',
      provider: 'openai',
      model: 'gpt-4o',
      model_id: 'gpt-4o-id',
      auth_type: 'api_key',
      error_message: 'bad parameter',
      error_origin: 'provider',
      error_class: 'invalid_request',
      error_http_status: 400,
      trace_id: 'trace-1',
      routing_tier: 'default',
      routing_reason: 'configured',
      service_type: 'chat',
      session_key: 'session-1',
      description: 'first',
      duration_ms: 123,
      cost_usd: '0.0123',
      input_tokens: 10,
      output_tokens: 20,
      request_headers: { zeta: 'z', alpha: 'a' },
      request_params: { temperature: 0.2, nested: { ok: true } },
      autofix_applied: true,
      autofix_operations: [{ type: 'rename', from: 'old', to: 'new' }, { type: 'remove' }],
      autofix_phoenix: { issueId: 'attempt-issue' },
      autofix_sibling: { id: 'sibling' },
    },
    {
      id: 'attempt-2',
      status: 'rate_limited',
      fallback_from_model: 'gpt-4o',
      provider: null,
      model: null,
      auth_type: null,
    },
    {
      id: 'attempt-3',
      status: 'ok',
      autofix_role: 'retry',
      provider: 'anthropic',
      model: 'claude',
      auth_type: 'subscription',
    },
    {
      id: 'attempt-4',
      status: 'error',
      provider: 'openai',
      model: 'gpt',
      auth_type: 'api_key',
    },
  ],
};

describe('RequestDrawer', () => {
  it('renders request attempts, metadata, tabs, and close interactions', async () => {
    mockGetMessageDetails.mockResolvedValue({ message: fullMessage });
    const onClose = vi.fn();
    const { container } = render(() => (
      <RequestDrawer messageId="request-1234567890" onClose={onClose} />
    ));

    await waitFor(() => expect(screen.getByText('Request request-1234')).toBeDefined());
    expect(mockGetMessageDetails).toHaveBeenCalledWith('request-1234567890');
    expect(screen.getAllByText('Auto-fixed').length).toBeGreaterThan(0);
    // Header badges use the branded logotype (icon square + word).
    expect(screen.getAllByText('fallback').length).toBeGreaterThan(0);
    expect(screen.getAllByText('autofix').length).toBeGreaterThan(0);
    expect(container.querySelector('.drawer__meta-row .trigger-badge--autofix .autofix-icon')).not.toBeNull();
    expect(container.querySelector('.drawer__meta-row .trigger-badge--fallback .fallback-icon')).not.toBeNull();
    // Sidebar attempt icons use the same branded squares.
    expect(container.querySelector('.attempt-item__icon .fallback-icon')).not.toBeNull();
    expect(container.querySelector('.attempt-item__icon .autofix-icon')).not.toBeNull();
    expect(screen.getByText('bad parameter')).toBeDefined();
    expect(screen.getByText('invalid_request')).toBeDefined();
    expect(screen.getByText('$0.0123')).toBeDefined();
    // Auto-fix context card: role-aware copy + operations table.
    expect(container.textContent).toContain('rename: old → new');

    fireEvent.click(screen.getByText('Request headers'));
    expect(screen.getByText('alpha')).toBeDefined();
    expect(screen.getByText('zeta')).toBeDefined();
    fireEvent.click(screen.getByText('Model params'));
    expect(screen.getByText('temperature')).toBeDefined();
    expect(screen.getByText('0.2')).toBeDefined();

    const attempts = container.querySelectorAll('.attempt-item');
    fireEvent.click(attempts[1]!);
    expect(screen.getByText('Rate limited')).toBeDefined();
    fireEvent.click(attempts[2]!);
    expect(screen.getAllByText('Success').length).toBeGreaterThan(0);
    fireEvent.click(attempts[3]!);
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ fallback_from_model: 'old' }, 'fallback'],
    [{ autofix_role: 'retry' }, 'auto-fix'],
    [{}, 'initial'],
  ])('builds a single %s attempt when no attempt array is present', async (extra, type) => {
    mockGetMessageDetails.mockResolvedValue({
      ...fullMessage,
      ...extra,
      attempts: [],
      status: 'ok',
      autofix_applied: false,
      fallback_index: undefined,
      fallback_from_model: (extra as { fallback_from_model?: string }).fallback_from_model,
      autofix_role: (extra as { autofix_role?: string }).autofix_role,
      request_headers: { header: 'value' },
      request_params: { max_tokens: 10 },
      cost: 0,
      duration_ms: 0,
      input_tokens: 0,
      output_tokens: 0,
    });
    const { container } = render(() => (
      <RequestDrawer messageId={`single-${type}`} onClose={vi.fn()} />
    ));
    await waitFor(() => expect(container.querySelector('.attempt-item')).not.toBeNull());
    expect(container.querySelector('.drawer-kv:nth-child(2)')?.textContent).toContain(type);
  });

  it('shows loading state while an open request is unresolved and stays closed for null', () => {
    mockGetMessageDetails.mockReturnValue(new Promise(() => {}));
    const { container, unmount } = render(() => (
      <RequestDrawer messageId="pending" onClose={vi.fn()} />
    ));
    expect(screen.getByText('Loading...')).toBeDefined();
    expect(container.querySelector('.drawer--open')).not.toBeNull();
    unmount();

    const closed = render(() => <RequestDrawer messageId={null} onClose={vi.fn()} />);
    expect(closed.container.querySelector('.drawer--open')).toBeNull();
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  it('stacks the context cards WITH the error card (cumulative, never exclusive)', async () => {
    // A real fallback chain: attempt 1 fails (auth), attempt 2 recovers.
    mockGetMessageDetails.mockResolvedValue({
      message: {
        id: 'fb-chain',
        status: 'ok',
        model: 'gpt-4.1-nano',
        provider: 'openai',
        auth_type: 'api_key',
        timestamp: '2026-07-15T10:11:12Z',
        attempts: [
          {
            id: 'fb-1',
            status: 'fallback_error',
            provider: 'deepseek',
            model: 'deepseek-chat',
            auth_type: 'api_key',
            error_message: 'Authentication Fails',
            error_origin: 'provider',
            error_class: 'auth',
            error_http_status: 401,
          },
          {
            id: 'fb-2',
            status: 'ok',
            provider: 'openai',
            model: 'gpt-4.1-nano',
            auth_type: 'api_key',
            fallback_from_model: 'deepseek-chat',
            fallback_index: 0,
          },
        ],
      },
    });
    const { container } = render(() => <RequestDrawer messageId="fb-chain" onClose={vi.fn()} />);
    await waitFor(() => expect(container.querySelectorAll('.attempt-item').length).toBe(2));

    // Sidebar shows binary HTTP-code tags: red 401 on the failure, green 200
    // on the success — recovery is NOT encoded in the tag color.
    const codes = [...container.querySelectorAll('.attempt-item .attempt-code')].map((e) => ({
      code: e.textContent?.trim(),
      ok: e.classList.contains('attempt-code--ok'),
    }));
    expect(codes).toEqual([
      { code: '401', ok: false },
      { code: '200', ok: true },
    ]);
    // The Details Status row carries the code too.
    expect(container.querySelector('.drawer-kv .attempt-code')?.textContent?.trim()).toBe('401');

    // Attempt 1 (failed): the error card AND the fallback CONSEQUENCE card,
    // together — and in reading order: error first, consequence after.
    expect(screen.getByText('Authentication Fails')).toBeDefined();
    expect(screen.getByText('Error')).toBeDefined();
    const text = container.textContent!;
    const errorIdx = text.indexOf('Authentication Fails');
    const consequenceIdx = text.indexOf('recovered by fallback to gpt-4.1-nano');
    expect(consequenceIdx).toBeGreaterThan(errorIdx);
    // Branded title: the little logotype badge, not an uppercase word.
    expect(container.querySelector('.trigger-badge--fallback .fallback-icon')).not.toBeNull();

    // Attempt 2 (recovery): fallback ORIGIN card explaining where it came from.
    const attempts = container.querySelectorAll('.attempt-item');
    fireEvent.click(attempts[1]!);
    await waitFor(() =>
      expect(container.textContent).toContain('fell back from deepseek-chat'),
    );
    expect(screen.queryByText('Error')).toBeNull();
  });
});

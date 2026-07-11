import type { IncomingHttpHeaders } from 'http';

import {
  buildEndpointAwareUpstreamHeaders,
  chooseAgentSessionKey,
  classifyAgentCaller,
  extractAgentRequestContext,
} from '../agent-request-context';

describe('agent request context', () => {
  describe('classifyAgentCaller', () => {
    it('recognizes Claude Code from each strong client signal', () => {
      expect(classifyAgentCaller({ 'user-agent': 'claude-cli/2.1.207 (external, sdk-cli)' })).toBe(
        'claude-code',
      );
      expect(classifyAgentCaller({ 'anthropic-beta': 'effort-2025,claude-code-20250219' })).toBe(
        'claude-code',
      );
      expect(classifyAgentCaller({ 'x-claude-code-session-id': 'sess-1' })).toBe('claude-code');
    });

    it('recognizes Codex from originator, user-agent, or Codex-specific metadata', () => {
      expect(classifyAgentCaller({ originator: 'codex_cli_rs' })).toBe('codex');
      expect(classifyAgentCaller({ 'user-agent': 'codex_cli_rs/0.250.0 (Linux)' })).toBe('codex');
      expect(classifyAgentCaller({ 'user-agent': 'codex_exec/0.144.1 (Linux)' })).toBe('codex');
      expect(classifyAgentCaller({ 'x-codex-window-id': 'window-1' })).toBe('codex');
    });

    it('does not classify generic SDK signals and rejects conflicting identities', () => {
      expect(classifyAgentCaller({ 'x-app': 'cli', 'x-stainless-lang': 'js' })).toBe('unknown');
      expect(
        classifyAgentCaller({
          'user-agent': 'claude-cli/2.1.207',
          originator: 'codex_cli_rs',
        }),
      ).toBe('unknown');
    });
  });

  describe('extractAgentRequestContext', () => {
    it('extracts open-ended Anthropic protocol headers and current Claude identity', () => {
      const context = extractAgentRequestContext({
        'user-agent': 'claude-cli/2.1.207 (external, sdk-cli)',
        'x-app': 'cli',
        'x-stainless-lang': 'js',
        'x-stainless-package-version': '0.94.0',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': ['claude-code-20250219', 'effort-2025-11-24'],
        'anthropic-future-feature': 'enabled',
      });

      expect(context).toEqual({
        caller: 'claude-code',
        anthropicHeaders: {
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'claude-code-20250219,effort-2025-11-24',
          'anthropic-future-feature': 'enabled',
        },
        claudeIdentityHeaders: {
          'user-agent': 'claude-cli/2.1.207 (external, sdk-cli)',
          'x-app': 'cli',
          'x-stainless-lang': 'js',
          'x-stainless-package-version': '0.94.0',
        },
        codexHeaders: {},
      });
    });

    it('extracts exactly the allowlisted Codex metadata and real identity', () => {
      const metadata: IncomingHttpHeaders = {
        'user-agent': 'codex_cli_rs/0.250.0 (Linux)',
        originator: 'codex_cli_rs',
        version: '0.250.0',
        'x-codex-beta-features': 'feature-a',
        'x-codex-window-id': 'window-1',
        'x-codex-turn-metadata': '{"kind":"tool"}',
        'x-codex-parent-thread-id': 'parent-1',
        'x-client-request-id': 'request-1',
        'session-id': 'session-1',
        'thread-id': 'thread-1',
        'x-openai-subagent': 'reviewer',
        'x-codex-turn-state': 'sticky-state',
        'x-codex-not-allowlisted': 'drop-me',
        'x-random': 'drop-me-too',
      };

      const context = extractAgentRequestContext(metadata);

      expect(context.caller).toBe('codex');
      expect(context.codexHeaders).toEqual({
        'user-agent': 'codex_cli_rs/0.250.0 (Linux)',
        originator: 'codex_cli_rs',
        version: '0.250.0',
        'x-codex-beta-features': 'feature-a',
        'x-codex-window-id': 'window-1',
        'x-codex-turn-metadata': '{"kind":"tool"}',
        'x-codex-parent-thread-id': 'parent-1',
        'x-client-request-id': 'request-1',
        'session-id': 'session-1',
        'thread-id': 'thread-1',
        'x-openai-subagent': 'reviewer',
        'x-codex-turn-state': 'sticky-state',
      });
      expect(context.codexHeaders).not.toHaveProperty('x-codex-not-allowlisted');
      expect(context.codexHeaders).not.toHaveProperty('x-random');
    });

    it('drops credentials, cookies, account routing, and credential-shaped extensions', () => {
      const context = extractAgentRequestContext({
        'user-agent': 'claude-cli/2.1.207',
        authorization: 'Bearer caller-secret',
        'x-api-key': 'caller-key',
        cookie: 'session=secret',
        'set-cookie': ['secret=one', 'secret=two'],
        'chatgpt-account-id': 'caller-account',
        'anthropic-api-key': 'future-secret',
        'anthropic-access-token': 'future-token',
        'anthropic-session-token': 'future-session-secret',
        'anthropic-id-token': 'future-id-secret',
        'anthropic-password': 'future-password',
        'x-stainless-api-key': 'sdk-secret',
        'anthropic-token-count': 'safe-protocol-metadata',
      });

      expect(context.anthropicHeaders).toEqual({
        'anthropic-token-count': 'safe-protocol-metadata',
      });
      expect(context.claudeIdentityHeaders).toEqual({
        'user-agent': 'claude-cli/2.1.207',
      });
      expect(JSON.stringify(context)).not.toContain('secret');
      expect(JSON.stringify(context)).not.toContain('caller-account');
    });

    it('strips control characters and drops oversized values instead of corrupting them', () => {
      const context = extractAgentRequestContext({
        'anthropic-version': '2023-06-01\r\n',
        'anthropic-beta': `safe${'a'.repeat(9_000)}€`,
      });

      expect(context.anthropicHeaders['anthropic-version']).toBe('2023-06-01');
      expect(context.anthropicHeaders).not.toHaveProperty('anthropic-beta');
    });
  });

  describe('chooseAgentSessionKey', () => {
    it('prefers an explicit Manifest session key and sanitizes it', () => {
      expect(
        chooseAgentSessionKey({
          'x-session-key': 'explicit\r\n-key',
          'x-claude-code-session-id': 'claude-session',
          'session-id': 'codex-session',
        }),
      ).toBe('explicit-key');
    });

    it('uses opaque Claude session and agent ids before Codex ids', () => {
      const key = chooseAgentSessionKey({
        'x-claude-code-session-id': 'session-1',
        'x-claude-code-agent-id': 'agent-2',
        'session-id': 'codex-session',
      });
      expect(key).toMatch(/^claude:[a-f0-9]{64}$/);
      expect(key).not.toContain('session-1');
      expect(key).not.toContain('agent-2');

      const agentKey = chooseAgentSessionKey({ 'x-claude-code-parent-agent-id': 'parent-1' });
      expect(agentKey).toMatch(/^claude-agent:[a-f0-9]{64}$/);
      expect(agentKey).not.toContain('parent-1');
    });

    it('falls through stable opaque Codex ids in order, then defaults', () => {
      const session = chooseAgentSessionKey({
        'session-id': 'session-1',
        'thread-id': 'thread-1',
        'x-client-request-id': 'request-1',
      });
      const thread = chooseAgentSessionKey({
        'thread-id': 'thread-1',
        'x-client-request-id': 'request-1',
      });
      const request = chooseAgentSessionKey({ 'x-client-request-id': 'request-1' });

      expect(session).toMatch(/^codex-session:[a-f0-9]{64}$/);
      expect(thread).toMatch(/^codex-thread:[a-f0-9]{64}$/);
      expect(request).toMatch(/^codex-request:[a-f0-9]{64}$/);
      expect(`${session}${thread}${request}`).not.toMatch(/session-1|thread-1|request-1/);
      expect(chooseAgentSessionKey({ 'session-id': 'session-1' })).toBe(session);
      expect(chooseAgentSessionKey({})).toBe('default');
    });

    it('caps derived session values', () => {
      const key = chooseAgentSessionKey({ 'session-id': 's'.repeat(1_000) });
      expect(key).toMatch(/^codex-session:[a-f0-9]{64}$/);
    });
  });

  describe('buildEndpointAwareUpstreamHeaders', () => {
    const claudeContext = extractAgentRequestContext({
      'user-agent': 'claude-cli/2.1.207',
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'claude-code-20250219,effort-2025-11-24,oauth-2025-04-20',
    });
    const codexContext = extractAgentRequestContext({
      'user-agent': 'codex_cli_rs/0.250.0 (Linux)',
      originator: 'codex_cli_rs',
      'session-id': 'session-1',
      'x-codex-window-id': 'window-1',
      'anthropic-beta': 'must-not-cross-protocols',
    });

    it('forwards only Anthropic protocol and Claude identity to Anthropic Messages', () => {
      const headers = buildEndpointAwareUpstreamHeaders(
        {
          Authorization: 'Bearer stored-provider-token',
          'Content-Type': 'application/json',
          'User-Agent': 'stale-synthetic-client',
          'Anthropic-Beta': 'context-management-2025-06-27,oauth-2025-04-20',
        },
        claudeContext,
        { apiMode: 'messages', endpointKey: 'anthropic', authType: 'subscription' },
      );

      expect(headers).toMatchObject({
        Authorization: 'Bearer stored-provider-token',
        'Content-Type': 'application/json',
        'user-agent': 'claude-cli/2.1.207',
        'anthropic-version': '2023-06-01',
      });
      expect(headers).not.toHaveProperty('User-Agent');
      expect(headers['anthropic-beta'].split(',')).toEqual([
        'claude-code-20250219',
        'effort-2025-11-24',
        'oauth-2025-04-20',
      ]);
      expect(headers['anthropic-beta'].match(/oauth-2025-04-20/g)).toHaveLength(1);
      expect(headers).not.toHaveProperty('x-codex-window-id');
    });

    it('adds the subscription OAuth beta once when the caller omitted it', () => {
      const context = extractAgentRequestContext({
        'user-agent': 'claude-cli/2.1.207',
        'anthropic-beta': 'claude-code-20250219',
      });
      const headers = buildEndpointAwareUpstreamHeaders(
        { Authorization: 'Bearer stored-token' },
        context,
        { apiMode: 'messages', endpointKey: 'anthropic', authType: 'subscription' },
      );

      expect(headers['anthropic-beta']).toBe('claude-code-20250219,oauth-2025-04-20');
    });

    it('does not inject the OAuth beta for Anthropic API-key auth', () => {
      const context = extractAgentRequestContext({
        'user-agent': 'claude-cli/2.1.207',
        'anthropic-beta': 'claude-code-20250219',
      });
      const headers = buildEndpointAwareUpstreamHeaders(
        { 'x-api-key': 'stored-api-key' },
        context,
        { apiMode: 'messages', endpointKey: 'anthropic', authType: 'api_key' },
      );

      expect(headers['anthropic-beta']).toBe('claude-code-20250219');
      expect(headers['x-api-key']).toBe('stored-api-key');
    });

    it('forwards only Codex metadata and identity to OpenAI subscription Responses', () => {
      const headers = buildEndpointAwareUpstreamHeaders(
        {
          Authorization: 'Bearer stored-openai-token',
          'chatgpt-account-id': 'stored-account',
          'user-agent': 'stale-synthetic-client',
        },
        codexContext,
        { apiMode: 'responses', endpointKey: 'openai-subscription', authType: 'subscription' },
      );

      expect(headers).toMatchObject({
        Authorization: 'Bearer stored-openai-token',
        'chatgpt-account-id': 'stored-account',
        'user-agent': 'codex_cli_rs/0.250.0 (Linux)',
        originator: 'codex_cli_rs',
        'session-id': 'session-1',
        'x-codex-window-id': 'window-1',
      });
      expect(headers).not.toHaveProperty('anthropic-beta');
    });

    it('keeps provider-generated auth authoritative regardless of context shape', () => {
      const hostileContext = {
        caller: 'codex' as const,
        anthropicHeaders: {},
        claudeIdentityHeaders: {},
        codexHeaders: {
          Authorization: 'Bearer caller-token',
          'chatgpt-account-id': 'caller-account',
          'user-agent': 'codex_cli_rs/0.250.0',
        },
      };
      const headers = buildEndpointAwareUpstreamHeaders(
        {
          authorization: 'Bearer stored-token',
          'ChatGPT-Account-Id': 'stored-account',
        },
        hostileContext,
        { apiMode: 'responses', endpointKey: 'openai-subscription' },
      );

      expect(headers.authorization).toBe('Bearer stored-token');
      expect(headers['ChatGPT-Account-Id']).toBe('stored-account');
      expect(headers).not.toHaveProperty('Authorization');
      expect(headers).not.toHaveProperty('chatgpt-account-id');
    });

    it('does not cross protocol families or forward caller context to other endpoints', () => {
      const messagesToOpenAi = buildEndpointAwareUpstreamHeaders(
        { Authorization: 'Bearer provider' },
        claudeContext,
        { apiMode: 'messages', endpointKey: 'openai-subscription' },
      );
      const responsesToAnthropic = buildEndpointAwareUpstreamHeaders(
        { 'x-api-key': 'provider' },
        codexContext,
        { apiMode: 'responses', endpointKey: 'anthropic' },
      );

      expect(messagesToOpenAi).toEqual({ Authorization: 'Bearer provider' });
      expect(responsesToAnthropic).toEqual({ 'x-api-key': 'provider' });
    });
  });
});

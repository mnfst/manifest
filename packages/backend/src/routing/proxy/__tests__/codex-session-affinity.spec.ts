import { CodexSessionAffinity } from '../codex-session-affinity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function okResponseWithTurnState(token: string): Response {
  return new Response('{}', { status: 200, headers: { 'x-codex-turn-state': token } });
}

describe('CodexSessionAffinity', () => {
  let affinity: CodexSessionAffinity;

  beforeEach(() => {
    jest.useFakeTimers();
    affinity = new CodexSessionAffinity();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('prepare', () => {
    it('derives UUID-shaped session-id and thread-id headers', () => {
      const { headers } = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(headers['session-id']).toMatch(UUID_RE);
      expect(headers['thread-id']).toMatch(UUID_RE);
      expect(headers['session-id']).not.toBe(headers['thread-id']);
    });

    it('is deterministic for the same token + cache key, distinct otherwise', () => {
      const a = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      const b = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      const otherConversation = affinity.prepare('token', { prompt_cache_key: 'conv-2' });
      const otherToken = affinity.prepare('token-2', { prompt_cache_key: 'conv-1' });

      expect(a.headers).toEqual(b.headers);
      expect(a.storeKey).toBe(b.storeKey);
      expect(otherConversation.headers['session-id']).not.toBe(a.headers['session-id']);
      expect(otherToken.headers['session-id']).not.toBe(a.headers['session-id']);
    });

    it('keeps a caller-supplied prompt_cache_key untouched', () => {
      const body: Record<string, unknown> = { prompt_cache_key: 'caller-key' };

      affinity.prepare('token', body);

      expect(body.prompt_cache_key).toBe('caller-key');
    });

    it.each([[undefined], [''], [42]])(
      'injects a stable per-token default when prompt_cache_key is %p',
      (callerKey) => {
        const body: Record<string, unknown> = { prompt_cache_key: callerKey };
        const bodyAgain: Record<string, unknown> = { prompt_cache_key: callerKey };
        const otherToken: Record<string, unknown> = { prompt_cache_key: callerKey };

        affinity.prepare('token', body);
        affinity.prepare('token', bodyAgain);
        affinity.prepare('token-2', otherToken);

        expect(body.prompt_cache_key).toMatch(UUID_RE);
        expect(bodyAgain.prompt_cache_key).toBe(body.prompt_cache_key);
        expect(otherToken.prompt_cache_key).not.toBe(body.prompt_cache_key);
      },
    );

    it('omits x-codex-turn-state when nothing has been captured', () => {
      const { headers } = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(headers).not.toHaveProperty('x-codex-turn-state');
    });
  });

  describe('capture + replay', () => {
    it('replays the captured turn-state token on the next request for the same session', () => {
      const first = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      affinity.capture(first.storeKey, okResponseWithTurnState('turn-abc'));

      const second = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(second.headers['x-codex-turn-state']).toBe('turn-abc');
    });

    it('scopes turn-state to the session it was captured for', () => {
      const first = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      affinity.capture(first.storeKey, okResponseWithTurnState('turn-abc'));

      const other = affinity.prepare('token', { prompt_cache_key: 'conv-2' });

      expect(other.headers).not.toHaveProperty('x-codex-turn-state');
    });

    it('overwrites the stored token with the most recent one', () => {
      const { storeKey } = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      affinity.capture(storeKey, okResponseWithTurnState('turn-1'));
      affinity.capture(storeKey, okResponseWithTurnState('turn-2'));

      const next = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(next.headers['x-codex-turn-state']).toBe('turn-2');
    });

    it('ignores responses without a turn-state header', () => {
      const { storeKey } = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      affinity.capture(storeKey, new Response('{}', { status: 200 }));

      const next = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(next.headers).not.toHaveProperty('x-codex-turn-state');
    });

    it('evicts the stored token when the upstream rejects a request', () => {
      const { storeKey } = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      affinity.capture(storeKey, okResponseWithTurnState('turn-abc'));
      affinity.capture(storeKey, new Response('{}', { status: 400 }));

      const next = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(next.headers).not.toHaveProperty('x-codex-turn-state');
    });

    it('expires tokens after the TTL', () => {
      const { storeKey } = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      affinity.capture(storeKey, okResponseWithTurnState('turn-abc'));

      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      const next = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(next.headers).not.toHaveProperty('x-codex-turn-state');
    });

    it('slides the TTL while the session stays active', () => {
      const { storeKey } = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      affinity.capture(storeKey, okResponseWithTurnState('turn-abc'));

      jest.advanceTimersByTime(4 * 60 * 1000);
      expect(
        affinity.prepare('token', { prompt_cache_key: 'conv-1' }).headers['x-codex-turn-state'],
      ).toBe('turn-abc');

      // 8 minutes after capture — would be expired without the refresh above.
      jest.advanceTimersByTime(4 * 60 * 1000);
      expect(
        affinity.prepare('token', { prompt_cache_key: 'conv-1' }).headers['x-codex-turn-state'],
      ).toBe('turn-abc');
    });

    it('sweeps expired entries during capture', () => {
      const expired = affinity.prepare('token', { prompt_cache_key: 'conv-expired' });
      affinity.capture(expired.storeKey, okResponseWithTurnState('turn-old'));

      jest.advanceTimersByTime(6 * 60 * 1000);
      const fresh = affinity.prepare('token', { prompt_cache_key: 'conv-fresh' });
      affinity.capture(fresh.storeKey, okResponseWithTurnState('turn-new'));

      expect(
        affinity.prepare('token', { prompt_cache_key: 'conv-fresh' }).headers['x-codex-turn-state'],
      ).toBe('turn-new');
      expect(
        affinity.prepare('token', { prompt_cache_key: 'conv-expired' }).headers,
      ).not.toHaveProperty('x-codex-turn-state');
    });

    it('evicts the oldest entry at capacity, but never for an already-stored session', () => {
      const first = affinity.prepare('token', { prompt_cache_key: 'conv-0' });
      affinity.capture(first.storeKey, okResponseWithTurnState('turn-0'));
      for (let i = 1; i < 10_000; i++) {
        affinity.capture(`store-key-${i}`, okResponseWithTurnState(`turn-${i}`));
      }

      // Re-capturing an existing session at capacity must not evict anything.
      affinity.capture(first.storeKey, okResponseWithTurnState('turn-0-updated'));
      expect(
        affinity.prepare('token', { prompt_cache_key: 'conv-0' }).headers['x-codex-turn-state'],
      ).toBe('turn-0-updated');

      // A new session at capacity evicts the oldest entry (store-key-1 — the
      // re-capture above moved conv-0 to the back of the recency order).
      const overflow = affinity.prepare('token', { prompt_cache_key: 'conv-overflow' });
      affinity.capture(overflow.storeKey, okResponseWithTurnState('turn-overflow'));

      expect(
        affinity.prepare('token', { prompt_cache_key: 'conv-overflow' }).headers[
          'x-codex-turn-state'
        ],
      ).toBe('turn-overflow');
      expect(
        affinity.prepare('token', { prompt_cache_key: 'conv-0' }).headers['x-codex-turn-state'],
      ).toBe('turn-0-updated');
    });
  });
});

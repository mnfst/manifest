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
    it('issues UUID-shaped session-id and thread-id headers', () => {
      const { headers } = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(headers['session-id']).toMatch(UUID_RE);
      expect(headers['thread-id']).toMatch(UUID_RE);
      expect(headers['session-id']).not.toBe(headers['thread-id']);
    });

    it('reuses the same ids for the same token + cache key, distinct otherwise', () => {
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

    it('treats an over-long prompt_cache_key as absent to cap per-key memory', () => {
      const longKey = 'x'.repeat(513);
      const body: Record<string, unknown> = { prompt_cache_key: longKey };
      const otherLongKey: Record<string, unknown> = { prompt_cache_key: 'y'.repeat(600) };

      const first = affinity.prepare('token', body);
      const second = affinity.prepare('token', otherLongKey);

      // The giant key is never echoed back to the upstream…
      expect(body.prompt_cache_key).toMatch(UUID_RE);
      expect(body.prompt_cache_key).not.toBe(longKey);
      // …and distinct over-long keys collapse onto the single per-token session
      // (storeKey is just the token), so they cannot amplify the cache.
      expect(first.storeKey).toBe(second.storeKey);
      expect(first.headers['session-id']).toBe(second.headers['session-id']);
    });

    it('accepts a prompt_cache_key at the length boundary', () => {
      const maxKey = 'x'.repeat(512);
      const body: Record<string, unknown> = { prompt_cache_key: maxKey };

      const { storeKey } = affinity.prepare('token', body);

      expect(body.prompt_cache_key).toBe(maxKey);
      expect(storeKey).toContain(maxKey);
    });

    it('rotates session ids after the TTL', () => {
      const before = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      const after = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(after.headers['session-id']).not.toBe(before.headers['session-id']);
    });

    it('rotates an expired session in place when no sweep has run yet', () => {
      const before = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      // A sweep 4m30s in leaves conv-1 alive and resets the cleanup clock…
      jest.advanceTimersByTime(4 * 60 * 1000 + 30 * 1000);
      affinity.prepare('token', { prompt_cache_key: 'conv-other' });

      // …so 40s later conv-1 is expired but still in the map, and prepare()
      // must replace it rather than reuse it.
      jest.advanceTimersByTime(40 * 1000);
      const after = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(after.headers['session-id']).not.toBe(before.headers['session-id']);
    });

    it('slides the TTL while the session stays active', () => {
      const before = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      jest.advanceTimersByTime(4 * 60 * 1000);
      affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      // 8 minutes after creation — would have rotated without the refresh above.
      jest.advanceTimersByTime(4 * 60 * 1000);
      const after = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(after.headers['session-id']).toBe(before.headers['session-id']);
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

    it('drops the stored token but keeps the session when the upstream rejects a request', () => {
      const first = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      affinity.capture(first.storeKey, okResponseWithTurnState('turn-abc'));
      affinity.capture(first.storeKey, new Response('{}', { status: 400 }));

      const next = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(next.headers).not.toHaveProperty('x-codex-turn-state');
      expect(next.headers['session-id']).toBe(first.headers['session-id']);
    });

    it('expires tokens after the TTL', () => {
      const { storeKey } = affinity.prepare('token', { prompt_cache_key: 'conv-1' });
      affinity.capture(storeKey, okResponseWithTurnState('turn-abc'));

      jest.advanceTimersByTime(5 * 60 * 1000 + 1);
      const next = affinity.prepare('token', { prompt_cache_key: 'conv-1' });

      expect(next.headers).not.toHaveProperty('x-codex-turn-state');
    });

    it('is a no-op when the session has been swept before the response arrived', () => {
      const stale = affinity.prepare('token', { prompt_cache_key: 'conv-stale' });

      // The sweep during this prepare() removes the expired conv-stale session.
      jest.advanceTimersByTime(6 * 60 * 1000);
      affinity.prepare('token', { prompt_cache_key: 'conv-other' });

      affinity.capture(stale.storeKey, okResponseWithTurnState('turn-late'));
      const next = affinity.prepare('token', { prompt_cache_key: 'conv-stale' });

      expect(next.headers).not.toHaveProperty('x-codex-turn-state');
    });
  });

  describe('capacity', () => {
    it('evicts the oldest session at capacity, preserving recently used ones', () => {
      const first = affinity.prepare('token-0', {});
      const second = affinity.prepare('token-1', {});
      for (let i = 2; i < 10_000; i++) {
        affinity.prepare(`token-${i}`, {});
      }

      // Touching token-0 at capacity must not evict anything, and moves it to
      // the back of the recency order…
      expect(affinity.prepare('token-0', {}).headers).toEqual(first.headers);

      // …so a brand-new session evicts token-1 (now the oldest), not token-0.
      affinity.prepare('token-overflow', {});

      expect(affinity.prepare('token-1', {}).headers).not.toEqual(second.headers);
      expect(affinity.prepare('token-0', {}).headers).toEqual(first.headers);
    });
  });
});

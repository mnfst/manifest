import { ProxyMessageDedup, SUCCESS_SESSION_DEDUP_WINDOW_MS } from '../proxy-message-dedup';
import { IngestionContext } from '../../../otlp/interfaces/ingestion-context.interface';

const testCtx: IngestionContext = {
  tenantId: 'tenant-1',
  agentId: 'agent-1',
  agentName: 'test-agent',
  userId: 'user-1',
};

function makeMockMessageRepo() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    manager: {
      transaction: jest.fn().mockImplementation(async (fn: (...args: unknown[]) => unknown) => {
        const txManager = {
          connection: { options: { type: 'postgres' } },
          query: jest.fn().mockResolvedValue([]),
          getRepository: jest.fn().mockReturnValue({}),
        };
        return fn(txManager);
      }),
    },
  };
}

describe('ProxyMessageDedup', () => {
  let dedup: ProxyMessageDedup;

  beforeEach(() => {
    jest.clearAllMocks();
    dedup = new ProxyMessageDedup();
  });

  /* ── normalizeSessionKey ── */

  describe('normalizeSessionKey', () => {
    it('should return null for undefined', () => {
      expect(dedup.normalizeSessionKey(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(dedup.normalizeSessionKey('')).toBeNull();
    });

    it('should return null for "default"', () => {
      expect(dedup.normalizeSessionKey('default')).toBeNull();
    });

    it('should return the session key for valid values', () => {
      expect(dedup.normalizeSessionKey('my-session-123')).toBe('my-session-123');
    });

    it('should return null for null input', () => {
      expect(dedup.normalizeSessionKey(null)).toBeNull();
    });
  });

  /* ── getSuccessWriteLockKey ── */

  describe('getSuccessWriteLockKey', () => {
    it('should return trace-based key when traceId is provided', () => {
      const key = dedup.getSuccessWriteLockKey(testCtx, 'gpt-4o', 'trace-abc');

      expect(key).toBe('trace:tenant-1:agent-1:trace-abc');
    });

    it('should return success-based key without traceId', () => {
      const key = dedup.getSuccessWriteLockKey(testCtx, 'gpt-4o');

      expect(key).toBe('success:tenant-1:agent-1:user-1:no-session:gpt-4o');
    });

    it('should include session key when provided', () => {
      const key = dedup.getSuccessWriteLockKey(testCtx, 'gpt-4o', undefined, 'session-1');

      expect(key).toBe('success:tenant-1:agent-1:user-1:session-1:gpt-4o');
    });

    it('should use no-session when session key is null', () => {
      const key = dedup.getSuccessWriteLockKey(testCtx, 'gpt-4o', undefined, null);

      expect(key).toBe('success:tenant-1:agent-1:user-1:no-session:gpt-4o');
    });

    it('should prefer trace-based key even when sessionKey is provided', () => {
      const key = dedup.getSuccessWriteLockKey(testCtx, 'gpt-4o', 'trace-abc', 'session-1');

      expect(key).toBe('trace:tenant-1:agent-1:trace-abc');
    });
  });

  /* ── withSuccessWriteLock ── */

  describe('withSuccessWriteLock', () => {
    it('should execute the function and return its result', async () => {
      const result = await dedup.withSuccessWriteLock('key-1', async () => 'hello');

      expect(result).toBe('hello');
    });

    it('should serialize concurrent calls on the same key', async () => {
      const order: number[] = [];
      const p1 = dedup.withSuccessWriteLock('key-1', async () => {
        await new Promise((r) => setTimeout(r, 20));
        order.push(1);
        return 1;
      });
      const p2 = dedup.withSuccessWriteLock('key-1', async () => {
        order.push(2);
        return 2;
      });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe(1);
      expect(r2).toBe(2);
      expect(order).toEqual([1, 2]);
    });

    it('should allow concurrent execution on different keys', async () => {
      const order: string[] = [];
      const p1 = dedup.withSuccessWriteLock('key-a', async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push('a');
      });
      const p2 = dedup.withSuccessWriteLock('key-b', async () => {
        order.push('b');
      });

      await Promise.all([p1, p2]);

      // b should complete before a since they run in parallel
      expect(order).toEqual(['b', 'a']);
    });

    it('should release lock and clean up map entry after execution', async () => {
      await dedup.withSuccessWriteLock('key-1', async () => 'done');

      const locksMap = (dedup as any).successWriteLocks as Map<string, Promise<void>>;
      expect(locksMap.has('key-1')).toBe(false);
    });

    it('should release lock even when function throws', async () => {
      await expect(
        dedup.withSuccessWriteLock('key-1', async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');

      // Lock should be cleaned up so next call can proceed
      const result = await dedup.withSuccessWriteLock('key-1', async () => 'ok');
      expect(result).toBe('ok');
    });

    it('should not remove lock entry if another call is queued behind it', async () => {
      let release1!: () => void;
      const block1 = new Promise<void>((r) => {
        release1 = r;
      });

      const p1 = dedup.withSuccessWriteLock('key-1', async () => {
        await block1;
        return 1;
      });
      // Queue p2 behind p1
      const p2 = dedup.withSuccessWriteLock('key-1', async () => 2);

      // Let p1 complete
      release1();
      await p1;

      // The lock entry should still exist because p2 is still queued
      const locksMap = (dedup as any).successWriteLocks as Map<string, Promise<void>>;
      // After p2 completes, it should clean up
      await p2;
      expect(locksMap.has('key-1')).toBe(false);
    });
  });

  /* ── findExistingSuccessMessage ── */

  describe('findExistingSuccessMessage', () => {
    it('should return trace-matched message when traceId is provided', async () => {
      const existing = {
        id: 'msg-1',
        timestamp: new Date().toISOString(),
        input_tokens: 100,
        output_tokens: 50,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: 1000,
      };
      const repo = makeMockMessageRepo();
      repo.findOne.mockResolvedValue(existing);

      const result = await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
        'trace-abc',
      );

      expect(result).toBe(existing);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ trace_id: 'trace-abc', status: 'ok' }),
        }),
      );
    });

    it('should fall through to model-based search when no trace match', async () => {
      const repo = makeMockMessageRepo();
      repo.findOne.mockResolvedValue(null); // no trace match
      repo.find.mockResolvedValue([]); // no model match

      const result = await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
        'trace-abc',
      );

      expect(result).toBeNull();
      expect(repo.find).toHaveBeenCalled();
    });

    it('should match by token counts and timing without traceId', async () => {
      const now = Date.now();
      const existing = {
        id: 'msg-1',
        timestamp: new Date(now - 500).toISOString(),
        input_tokens: 100,
        output_tokens: 50,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: 500,
      };
      const repo = makeMockMessageRepo();
      repo.find.mockResolvedValue([existing]);

      const result = await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
      );

      expect(result).toBe(existing);
    });

    it('should not match when row is outside dedup window', async () => {
      const oldTime = Date.now() - SUCCESS_SESSION_DEDUP_WINDOW_MS - 1000;
      const existing = {
        id: 'msg-1',
        timestamp: new Date(oldTime).toISOString(),
        input_tokens: 100,
        output_tokens: 50,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: 500,
      };
      const repo = makeMockMessageRepo();
      repo.find.mockResolvedValue([existing]);

      const result = await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
      );

      expect(result).toBeNull();
    });

    it('should not match when duration_ms is null', async () => {
      const now = Date.now();
      const existing = {
        id: 'msg-1',
        timestamp: new Date(now - 500).toISOString(),
        input_tokens: 100,
        output_tokens: 50,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: null,
      };
      const repo = makeMockMessageRepo();
      repo.find.mockResolvedValue([existing]);

      const result = await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
      );

      expect(result).toBeNull();
    });

    it('should not match when timestamp is NaN', async () => {
      const existing = {
        id: 'msg-1',
        timestamp: 'invalid-date',
        input_tokens: 100,
        output_tokens: 50,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: 500,
      };
      const repo = makeMockMessageRepo();
      repo.find.mockResolvedValue([existing]);

      const result = await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
      );

      expect(result).toBeNull();
    });

    it('should not match when token counts differ', async () => {
      const now = Date.now();
      const existing = {
        id: 'msg-1',
        timestamp: new Date(now - 500).toISOString(),
        input_tokens: 200, // different from usage
        output_tokens: 50,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: 500,
      };
      const repo = makeMockMessageRepo();
      repo.find.mockResolvedValue([existing]);

      const result = await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
      );

      expect(result).toBeNull();
    });

    it('should not match when end time delta exceeds grace window', async () => {
      const now = Date.now();
      // Message started 20s ago with 1s duration -- end time delta will be ~19s >> 5s grace
      const existing = {
        id: 'msg-1',
        timestamp: new Date(now - 20_000).toISOString(),
        input_tokens: 100,
        output_tokens: 50,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: 1000,
      };
      const repo = makeMockMessageRepo();
      repo.find.mockResolvedValue([existing]);

      const result = await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
      );

      expect(result).toBeNull();
    });

    it('should include sessionKey in query when provided', async () => {
      const repo = makeMockMessageRepo();
      repo.find.mockResolvedValue([]);

      await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
        undefined,
        'session-key-1',
      );

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ session_key: 'session-key-1' }),
        }),
      );
    });

    it('should not include sessionKey in query when null', async () => {
      const repo = makeMockMessageRepo();
      repo.find.mockResolvedValue([]);

      await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
        undefined,
        null,
      );

      const where = repo.find.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('session_key');
    });

    it('should include cache tokens in totalPromptTokens calculation', async () => {
      const now = Date.now();
      const existing = {
        id: 'msg-1',
        timestamp: new Date(now - 500).toISOString(),
        input_tokens: 50,
        output_tokens: 50,
        cache_read_tokens: 30,
        cache_creation_tokens: 20,
        duration_ms: 500,
      };
      const repo = makeMockMessageRepo();
      repo.find.mockResolvedValue([existing]);

      // Total prompt tokens: 50 + 30 + 20 = 100
      const result = await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 100, completion_tokens: 50 },
      );

      expect(result).toBe(existing);
    });

    it('should handle null token fields as 0', async () => {
      const now = Date.now();
      const existing = {
        id: 'msg-1',
        timestamp: new Date(now - 500).toISOString(),
        input_tokens: null,
        output_tokens: null,
        cache_read_tokens: null,
        cache_creation_tokens: null,
        duration_ms: 500,
      };
      const repo = makeMockMessageRepo();
      repo.find.mockResolvedValue([existing]);

      // null tokens should be treated as 0
      const result = await dedup.findExistingSuccessMessage(
        repo as unknown as any,
        testCtx,
        'gpt-4o',
        { prompt_tokens: 0, completion_tokens: 0 },
      );

      expect(result).toBe(existing);
    });
  });

  /* ── withAgentMessageTransaction ── */

  describe('withAgentMessageTransaction', () => {
    it('should execute function within a transaction and acquire lock', async () => {
      const repo = makeMockMessageRepo();
      const txRepo = {} as any;
      const mockManager = {
        connection: { options: { type: 'postgres' } },
        query: jest.fn().mockResolvedValue([]),
        getRepository: jest.fn().mockReturnValue(txRepo),
      };
      repo.manager.transaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) =>
        fn(mockManager),
      );

      const result = await dedup.withAgentMessageTransaction(
        repo as unknown as any,
        testCtx,
        async (txR) => {
          expect(txR).toBe(txRepo);
          return 'result';
        },
      );

      expect(result).toBe('result');
      expect(mockManager.query).toHaveBeenCalledWith(
        'SELECT id FROM agents WHERE id = $1 FOR UPDATE',
        ['agent-1'],
      );
    });

    it('should skip lock for non-postgres databases', async () => {
      const repo = makeMockMessageRepo();
      const txRepo = {} as any;
      const mockManager = {
        connection: { options: { type: 'sqljs' } },
        query: jest.fn(),
        getRepository: jest.fn().mockReturnValue(txRepo),
      };
      repo.manager.transaction.mockImplementation(async (fn: (...args: unknown[]) => unknown) =>
        fn(mockManager),
      );

      await dedup.withAgentMessageTransaction(repo as unknown as any, testCtx, async () => 'done');

      expect(mockManager.query).not.toHaveBeenCalled();
    });
  });
});

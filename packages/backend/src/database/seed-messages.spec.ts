import { Logger } from '@nestjs/common';
import { seedAgentMessages } from './seed-messages';

function makeMockRepo() {
  return {
    count: jest.fn().mockResolvedValue(0),
    insert: jest.fn().mockResolvedValue({}),
  };
}

function makeMockLogger(): Logger & { log: jest.Mock } {
  return { log: jest.fn() } as unknown as Logger & { log: jest.Mock };
}

/** Collects all messages passed to repo.insert across batched calls. */
function collectInsertedMessages(
  mockRepo: ReturnType<typeof makeMockRepo>,
): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  for (const call of mockRepo.insert.mock.calls) {
    const batch = call[0] as Array<Record<string, unknown>>;
    messages.push(...batch);
  }
  return messages;
}

describe('seedAgentMessages', () => {
  let mockRepo: ReturnType<typeof makeMockRepo>;
  let logger: Logger & { log: jest.Mock };

  beforeEach(() => {
    mockRepo = makeMockRepo();
    logger = makeMockLogger();
    jest.clearAllMocks();
  });

  describe('early exit when messages exist', () => {
    it('should skip seeding when message count > 0', async () => {
      mockRepo.count.mockResolvedValue(10);

      await seedAgentMessages(mockRepo as never, 'user-1', logger);

      expect(mockRepo.count).toHaveBeenCalledTimes(1);
      expect(mockRepo.insert).not.toHaveBeenCalled();
      expect(logger.log).not.toHaveBeenCalled();
    });

    it('should check the message count before proceeding', async () => {
      mockRepo.count.mockResolvedValue(1);

      await seedAgentMessages(mockRepo as never, 'user-1', logger);

      expect(mockRepo.count).toHaveBeenCalled();
      expect(mockRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('seeding when table is empty', () => {
    it('should insert messages when count is 0', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);

      expect(mockRepo.insert).toHaveBeenCalled();
    });

    it('should log the total number of seeded messages', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);

      expect(logger.log).toHaveBeenCalledTimes(1);
      expect(logger.log).toHaveBeenCalledWith(expect.stringMatching(/^Seeded \d+ agent messages$/));
    });

    it('should generate approximately 695 messages over 7 days', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);

      const messages = collectInsertedMessages(mockRepo);
      // The exact count depends on the PRNG and the current time's UTC hours,
      // but 168 hours with ~4 msgs/hour should yield several hundred messages.
      expect(messages.length).toBeGreaterThan(200);
      expect(messages.length).toBeLessThan(1500);
    });
  });

  describe('context parameter', () => {
    it('should use default context when not provided', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);

      const messages = collectInsertedMessages(mockRepo);
      expect(messages.length).toBeGreaterThan(0);
      for (const msg of messages) {
        expect(msg.tenant_id).toBe('seed-tenant-001');
        expect(msg.agent_id).toBe('seed-agent-001');
        expect(msg.agent_name).toBe('demo-agent');
      }
    });

    it('should use custom context when provided', async () => {
      const customCtx = {
        tenantId: 'custom-tenant',
        agentId: 'custom-agent-id',
        agentName: 'my-agent',
      };

      await seedAgentMessages(mockRepo as never, 'user-2', logger, customCtx);

      const messages = collectInsertedMessages(mockRepo);
      expect(messages.length).toBeGreaterThan(0);
      for (const msg of messages) {
        expect(msg.tenant_id).toBe('custom-tenant');
        expect(msg.agent_id).toBe('custom-agent-id');
        expect(msg.agent_name).toBe('my-agent');
      }
    });

    it('should attach the provided userId to all messages', async () => {
      await seedAgentMessages(mockRepo as never, 'test-user-42', logger);

      const messages = collectInsertedMessages(mockRepo);
      for (const msg of messages) {
        expect(msg.user_id).toBe('test-user-42');
      }
    });
  });

  describe('determinism', () => {
    it('should produce identical messages on repeated runs', async () => {
      // Run 1
      const repo1 = makeMockRepo();
      await seedAgentMessages(repo1 as never, 'user-1', logger);
      const msgs1 = collectInsertedMessages(repo1);

      // Run 2
      const repo2 = makeMockRepo();
      await seedAgentMessages(repo2 as never, 'user-1', logger);
      const msgs2 = collectInsertedMessages(repo2);

      expect(msgs1.length).toBe(msgs2.length);
      for (let i = 0; i < msgs1.length; i++) {
        expect(msgs1[i].id).toBe(msgs2[i].id);
        expect(msgs1[i].model).toBe(msgs2[i].model);
        expect(msgs1[i].input_tokens).toBe(msgs2[i].input_tokens);
        expect(msgs1[i].output_tokens).toBe(msgs2[i].output_tokens);
        expect(msgs1[i].cost_usd).toBe(msgs2[i].cost_usd);
        expect(msgs1[i].status).toBe(msgs2[i].status);
        expect(msgs1[i].session_key).toBe(msgs2[i].session_key);
      }
    });
  });

  describe('message field validation', () => {
    let messages: Array<Record<string, unknown>>;

    beforeEach(async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);
      messages = collectInsertedMessages(mockRepo);
    });

    it('should generate unique sequential ids', () => {
      const ids = messages.map((m) => m.id as string);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // IDs should follow the seed-msg-NNNN pattern
      for (const id of ids) {
        expect(id).toMatch(/^seed-msg-\d{4}$/);
      }
    });

    it('should set valid ISO timestamps on all messages', () => {
      for (const msg of messages) {
        const ts = msg.timestamp as string;
        expect(ts).toBeDefined();
        const parsed = new Date(ts);
        expect(parsed.getTime()).not.toBeNaN();
      }
    });

    it('should generate timestamps within the last 7 days and never in the future', () => {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 3600000;
      const margin = 3600000; // hour-level margin for 7-day boundary

      for (const msg of messages) {
        const ts = new Date(msg.timestamp as string).getTime();
        expect(ts).toBeGreaterThanOrEqual(sevenDaysAgo - margin);
        expect(ts).toBeLessThanOrEqual(now);
      }
    });

    it('should assign a model from the predefined list', () => {
      const validModels = new Set([
        'claude-sonnet-4-5-20250929',
        'gpt-4o',
        'claude-haiku-4-5-20251001',
        'gemini-2.5-flash',
        'gpt-4.1',
      ]);

      for (const msg of messages) {
        expect(validModels.has(msg.model as string)).toBe(true);
      }
    });

    it('should span multiple models (not all the same)', () => {
      const models = new Set(messages.map((m) => m.model as string));
      expect(models.size).toBe(5);
    });

    it('should have positive input_tokens and output_tokens', () => {
      for (const msg of messages) {
        expect(msg.input_tokens).toBeGreaterThan(0);
        expect(msg.output_tokens).toBeGreaterThan(0);
      }
    });

    it('should have input_tokens larger than output_tokens for the vast majority', () => {
      // The source ranges overlap slightly at the edges:
      // input: 800..14800, output: 60..1260. Most messages will have
      // input >> output, but a few edge cases can be close or inverted.
      let inputLargerCount = 0;
      for (const msg of messages) {
        if ((msg.input_tokens as number) > (msg.output_tokens as number)) {
          inputLargerCount++;
        }
      }
      expect(inputLargerCount / messages.length).toBeGreaterThan(0.95);
    });

    it('should have non-negative cache_read_tokens', () => {
      for (const msg of messages) {
        expect(msg.cache_read_tokens).toBeGreaterThanOrEqual(0);
      }
    });

    it('should set cache_creation_tokens to 0', () => {
      for (const msg of messages) {
        expect(msg.cache_creation_tokens).toBe(0);
      }
    });

    it('should have positive duration_ms within expected range', () => {
      for (const msg of messages) {
        const dur = msg.duration_ms as number;
        expect(dur).toBeGreaterThanOrEqual(200);
        expect(dur).toBeLessThan(5000);
      }
    });

    it('should assign session keys in the format sess-NNN', () => {
      for (const msg of messages) {
        expect(msg.session_key).toMatch(/^sess-\d{3}$/);
      }
    });
  });

  describe('cost calculation', () => {
    it('should calculate cost_usd for api_key messages and zero for subscription', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);
      const messages = collectInsertedMessages(mockRepo);

      for (const msg of messages) {
        if (msg.auth_type === 'subscription') {
          expect(msg.cost_usd).toBe(0);
        } else {
          const input = msg.input_tokens as number;
          const output = msg.output_tokens as number;
          const expectedCost = input * 0.000003 + output * 0.000015;
          expect(msg.cost_usd).toBeCloseTo(expectedCost, 10);
        }
      }
    });

    it('should produce non-negative cost for every message', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);
      const messages = collectInsertedMessages(mockRepo);

      for (const msg of messages) {
        expect(msg.cost_usd as number).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('status distribution', () => {
    it('should set most messages to status ok', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);
      const messages = collectInsertedMessages(mockRepo);

      const okCount = messages.filter((m) => m.status === 'ok').length;
      const errorCount = messages.filter((m) => m.status === 'error').length;

      // The vast majority should be 'ok' (threshold > 0.95 means ~5% error)
      expect(okCount).toBeGreaterThan(errorCount);
      expect(okCount / messages.length).toBeGreaterThan(0.8);
    });

    it('should include some error messages', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);
      const messages = collectInsertedMessages(mockRepo);

      const errorMsgs = messages.filter((m) => m.status === 'error');
      expect(errorMsgs.length).toBeGreaterThan(0);
    });

    it('should set error_message only on error status messages', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);
      const messages = collectInsertedMessages(mockRepo);

      for (const msg of messages) {
        if (msg.status === 'error') {
          expect(msg.error_message).toBe('Rate limit exceeded');
        } else {
          expect(msg.error_message).toBeNull();
        }
      }
    });

    it('should only contain ok and error statuses', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);
      const messages = collectInsertedMessages(mockRepo);

      for (const msg of messages) {
        expect(['ok', 'error']).toContain(msg.status);
      }
    });
  });

  describe('batch insertion', () => {
    it('should insert in batches of 100', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);
      const messages = collectInsertedMessages(mockRepo);
      const totalCalls = mockRepo.insert.mock.calls.length;

      // All batches except possibly the last should have exactly 100
      for (let i = 0; i < totalCalls - 1; i++) {
        const batch = mockRepo.insert.mock.calls[i][0] as unknown[];
        expect(batch).toHaveLength(100);
      }

      // Last batch should have the remainder
      const lastBatch = mockRepo.insert.mock.calls[totalCalls - 1][0] as unknown[];
      expect(lastBatch.length).toBeGreaterThan(0);
      expect(lastBatch.length).toBeLessThanOrEqual(100);

      // Total messages across all batches should match
      let total = 0;
      for (const call of mockRepo.insert.mock.calls) {
        total += (call[0] as unknown[]).length;
      }
      expect(total).toBe(messages.length);
    });

    it('should call insert the correct number of times for the data size', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);
      const messages = collectInsertedMessages(mockRepo);
      const expectedCalls = Math.ceil(messages.length / 100);
      expect(mockRepo.insert).toHaveBeenCalledTimes(expectedCalls);
    });
  });

  describe('day/night pattern', () => {
    it('should generate fewer messages during night hours (0-7 UTC)', async () => {
      await seedAgentMessages(mockRepo as never, 'user-1', logger);
      const messages = collectInsertedMessages(mockRepo);

      let nightCount = 0;
      let dayCount = 0;

      for (const msg of messages) {
        const hour = new Date(msg.timestamp as string).getUTCHours();
        // Messages within an hour window can spill into adjacent hours
        // due to the random offset, so use a conservative range
        if (hour >= 1 && hour <= 6) {
          nightCount++;
        } else if (hour >= 9 && hour <= 21) {
          dayCount++;
        }
      }

      // Day hours (9-21 = 13 hours) should have more messages per hour
      // than night hours (1-6 = 6 hours). Compare normalized rates.
      const nightRate = nightCount / 6;
      const dayRate = dayCount / 13;
      expect(dayRate).toBeGreaterThan(nightRate);
    });
  });
});

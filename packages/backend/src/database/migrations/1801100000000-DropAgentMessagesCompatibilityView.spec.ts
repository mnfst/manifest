import { DropAgentMessagesCompatibilityView1801100000000 } from './1801100000000-DropAgentMessagesCompatibilityView';

describe('DropAgentMessagesCompatibilityView1801100000000', () => {
  const migration = new DropAgentMessagesCompatibilityView1801100000000();
  const runner = { query: jest.fn().mockResolvedValue(undefined) } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bounds the lock wait before dropping the compatibility view', async () => {
    await migration.up(runner);

    expect((runner as { query: jest.Mock }).query.mock.calls).toEqual([
      ["SET LOCAL lock_timeout = '5s'"],
      ['DROP VIEW IF EXISTS "agent_messages"'],
    ]);
  });

  it('recreates the compatibility view when rolled back', async () => {
    await migration.down(runner);

    const sql = (runner as { query: jest.Mock }).query.mock.calls[0][0] as string;
    expect(sql).toContain("to_regclass('public.agent_messages') IS NULL");
    expect(sql).toContain('CREATE VIEW "agent_messages" AS SELECT * FROM "provider_attempts"');
  });
});

import { FixNegativeCosts1773800000000 } from './1773800000000-FixNegativeCosts';

describe('FixNegativeCosts1773800000000', () => {
  const migration = new FixNegativeCosts1773800000000();

  it('runs UPDATE setting cost_usd to NULL where negative', async () => {
    const query = jest.fn();
    await migration.up({ query } as never);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      'UPDATE "agent_messages" SET "cost_usd" = NULL WHERE "cost_usd" < 0',
    );
  });

  it('targets the agent_message table specifically', async () => {
    const query = jest.fn();
    await migration.up({ query } as never);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('"agent_messages"');
  });

  it('sets to NULL (not zero) so unknown costs remain distinguishable', async () => {
    const query = jest.fn();
    await migration.up({ query } as never);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('SET "cost_usd" = NULL');
    expect(sql).not.toContain('= 0');
  });

  it('down is a no-op (irreversible migration)', async () => {
    const query = jest.fn();
    await migration.down({ query } as never);
    expect(query).not.toHaveBeenCalled();
  });
});

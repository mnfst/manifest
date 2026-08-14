import { AddAgentType1775100000000 } from './1775100000000-AddAgentType';

describe('AddAgentType1775100000000', () => {
  const migration = new AddAgentType1775100000000();

  it('adds agent_category column to agents', async () => {
    const addColumn = jest.fn();
    const query = jest.fn();
    await migration.up({ addColumn, query } as never);
    expect(addColumn).toHaveBeenCalledWith(
      'agents',
      expect.objectContaining({ name: 'agent_category' }),
    );
  });

  it('adds agent_platform column to agents', async () => {
    const addColumn = jest.fn();
    const query = jest.fn();
    await migration.up({ addColumn, query } as never);
    expect(addColumn).toHaveBeenCalledWith(
      'agents',
      expect.objectContaining({ name: 'agent_platform' }),
    );
  });

  it('creates nullable varchar columns', async () => {
    const addColumn = jest.fn();
    const query = jest.fn();
    await migration.up({ addColumn, query } as never);
    expect(addColumn).toHaveBeenCalledTimes(2);
    for (const call of addColumn.mock.calls) {
      expect(call[1].type).toBe('varchar');
      expect(call[1].isNullable).toBe(true);
    }
  });

  it('backfills existing agents to personal/openclaw', async () => {
    const addColumn = jest.fn();
    const query = jest.fn();
    await migration.up({ addColumn, query } as never);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("agent_category = 'personal'"));
    expect(query).toHaveBeenCalledWith(expect.stringContaining("agent_platform = 'openclaw'"));
  });

  it('drops both columns on rollback', async () => {
    const dropColumn = jest.fn();
    await migration.down({ dropColumn } as never);
    expect(dropColumn).toHaveBeenCalledTimes(2);
    expect(dropColumn).toHaveBeenCalledWith('agents', 'agent_platform');
    expect(dropColumn).toHaveBeenCalledWith('agents', 'agent_category');
  });
});

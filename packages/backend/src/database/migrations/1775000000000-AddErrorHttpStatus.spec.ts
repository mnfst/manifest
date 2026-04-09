import { AddErrorHttpStatus1775000000000 } from './1775000000000-AddErrorHttpStatus';

describe('AddErrorHttpStatus1775000000000', () => {
  const migration = new AddErrorHttpStatus1775000000000();

  it('adds error_http_status column to agent_messages', async () => {
    const addColumn = jest.fn();
    await migration.up({ addColumn } as never);
    expect(addColumn).toHaveBeenCalledTimes(1);
    expect(addColumn).toHaveBeenCalledWith(
      'agent_messages',
      expect.objectContaining({ name: 'error_http_status' }),
    );
  });

  it('creates a nullable integer column', async () => {
    const addColumn = jest.fn();
    await migration.up({ addColumn } as never);
    const column = addColumn.mock.calls[0][1];
    expect(column.type).toBe('integer');
    expect(column.isNullable).toBe(true);
  });

  it('drops the column on rollback', async () => {
    const dropColumn = jest.fn();
    await migration.down({ dropColumn } as never);
    expect(dropColumn).toHaveBeenCalledWith('agent_messages', 'error_http_status');
  });
});

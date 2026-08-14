import { AddCustomProviderApiKind1777200000000 } from './1777200000000-AddCustomProviderApiKind';

describe('AddCustomProviderApiKind1777200000000', () => {
  const migration = new AddCustomProviderApiKind1777200000000();

  it('adds api_kind column to custom_providers', async () => {
    const addColumn = jest.fn();
    await migration.up({ addColumn } as never);
    expect(addColumn).toHaveBeenCalledTimes(1);
    expect(addColumn).toHaveBeenCalledWith(
      'custom_providers',
      expect.objectContaining({ name: 'api_kind' }),
    );
  });

  it('creates a non-null varchar column defaulting to openai', async () => {
    const addColumn = jest.fn();
    await migration.up({ addColumn } as never);
    const column = addColumn.mock.calls[0][1];
    expect(column.type).toBe('varchar');
    expect(column.isNullable).toBe(false);
    expect(column.default).toBe("'openai'");
  });

  it('drops the column on rollback', async () => {
    const dropColumn = jest.fn();
    await migration.down({ dropColumn } as never);
    expect(dropColumn).toHaveBeenCalledWith('custom_providers', 'api_kind');
  });
});

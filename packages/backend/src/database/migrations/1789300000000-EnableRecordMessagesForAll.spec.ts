import { EnableRecordMessagesForAll1789300000000 } from './1789300000000-EnableRecordMessagesForAll';

describe('EnableRecordMessagesForAll1789300000000', () => {
  let migration: EnableRecordMessagesForAll1789300000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new EnableRecordMessagesForAll1789300000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('sets record_messages to true for all agents', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.up(queryRunner as any);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'UPDATE agents SET record_messages = true WHERE record_messages = false',
    );
  });

  it('down is a no-op', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.down(queryRunner as any);

    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});

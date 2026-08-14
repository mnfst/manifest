import { AddRequestParamsColumn1786000000000 } from './1786000000000-AddRequestParamsColumn';

describe('AddRequestParamsColumn1786000000000', () => {
  let migration: AddRequestParamsColumn1786000000000;
  let queryRunner: { query: jest.Mock };

  beforeEach(() => {
    migration = new AddRequestParamsColumn1786000000000();
    queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
  });

  it('up adds a nullable jsonb request_params column on agent_messages', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.up(queryRunner as any);
    expect(queryRunner.query).toHaveBeenCalledWith(
      `ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "request_params" jsonb DEFAULT NULL`,
    );
  });

  it('down drops the column', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migration.down(queryRunner as any);
    expect(queryRunner.query).toHaveBeenCalledWith(
      `ALTER TABLE "agent_messages" DROP COLUMN IF EXISTS "request_params"`,
    );
  });
});

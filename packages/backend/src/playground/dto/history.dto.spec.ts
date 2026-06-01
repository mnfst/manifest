import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ListHistoryQueryDto, RunIdParamDto, SetBestColumnDto } from './history.dto';

const UUID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

describe('ListHistoryQueryDto', () => {
  it('accepts a well-formed agent name', async () => {
    const dto = plainToInstance(ListHistoryQueryDto, { agentName: 'demo-agent_1' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty agent name', async () => {
    const dto = plainToInstance(ListHistoryQueryDto, { agentName: '' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('rejects an agent name with disallowed characters', async () => {
    const dto = plainToInstance(ListHistoryQueryDto, { agentName: 'bad name!' });
    const errors = await validate(dto);
    expect(errors[0]?.constraints?.matches).toBe('Invalid agent name');
  });
});

describe('RunIdParamDto', () => {
  it('accepts a valid uuid', async () => {
    const dto = plainToInstance(RunIdParamDto, { runId: UUID });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-uuid run id', async () => {
    const dto = plainToInstance(RunIdParamDto, { runId: 'not-a-uuid' });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});

describe('SetBestColumnDto', () => {
  it('accepts a valid uuid columnId', async () => {
    const dto = plainToInstance(SetBestColumnDto, { columnId: UUID });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts an explicit null columnId (clears the pick)', async () => {
    const dto = plainToInstance(SetBestColumnDto, { columnId: null });
    // ValidateIf skips @IsUUID only for an explicit null.
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an undefined / absent columnId', async () => {
    const dto = plainToInstance(SetBestColumnDto, {});
    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.constraints?.isUuid).toBeDefined();
  });

  it('rejects a non-uuid garbage columnId', async () => {
    const dto = plainToInstance(SetBestColumnDto, { columnId: 'garbage' });
    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.constraints?.isUuid).toBeDefined();
  });
});

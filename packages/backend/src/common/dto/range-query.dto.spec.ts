import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RangeQueryDto } from './range-query.dto';

describe('RangeQueryDto', () => {
  it('accepts valid range values', async () => {
    for (const range of ['1h', '6h', '24h', '7d', '30d']) {
      const dto = plainToInstance(RangeQueryDto, { range });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid range values', async () => {
    const dto = plainToInstance(RangeQueryDto, { range: '2h' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows omitting all fields', async () => {
    const dto = plainToInstance(RangeQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts agent_name as string', async () => {
    const dto = plainToInstance(RangeQueryDto, { agent_name: 'my-agent' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

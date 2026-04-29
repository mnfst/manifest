import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SavingsQueryDto, SavingsTimeseriesQueryDto } from './savings-query.dto';

describe('SavingsQueryDto', () => {
  it('validates with valid range and agent_name', async () => {
    const dto = plainToInstance(SavingsQueryDto, { range: '30d', agent_name: 'demo' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('validates with all accepted ranges', async () => {
    for (const range of ['1h', '6h', '24h', '7d', '30d']) {
      const dto = plainToInstance(SavingsQueryDto, { range, agent_name: 'demo' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid range', async () => {
    const dto = plainToInstance(SavingsQueryDto, { range: '2h', agent_name: 'demo' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing agent_name', async () => {
    const dto = plainToInstance(SavingsQueryDto, { range: '24h' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects empty agent_name', async () => {
    const dto = plainToInstance(SavingsQueryDto, { range: '24h', agent_name: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('SavingsTimeseriesQueryDto', () => {
  it('validates with valid range and agent_name', async () => {
    const dto = plainToInstance(SavingsTimeseriesQueryDto, { range: '7d', agent_name: 'demo' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('validates with all accepted ranges', async () => {
    for (const range of ['1h', '6h', '24h', '7d', '30d']) {
      const dto = plainToInstance(SavingsTimeseriesQueryDto, { range, agent_name: 'demo' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid range', async () => {
    const dto = plainToInstance(SavingsTimeseriesQueryDto, { range: '2h', agent_name: 'demo' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing agent_name', async () => {
    const dto = plainToInstance(SavingsTimeseriesQueryDto, { range: '24h' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

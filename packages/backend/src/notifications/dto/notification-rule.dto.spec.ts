import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateNotificationRuleDto, UpdateNotificationRuleDto } from './notification-rule.dto';

describe('CreateNotificationRuleDto', () => {
  it('validates a correct DTO', async () => {
    const dto = plainToInstance(CreateNotificationRuleDto, {
      agent_name: 'demo-agent',
      metric_type: 'tokens',
      threshold: 1000,
      period: 'hour',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid metric_type', async () => {
    const dto = plainToInstance(CreateNotificationRuleDto, {
      agent_name: 'demo-agent',
      metric_type: 'invalid',
      threshold: 1000,
      period: 'hour',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects negative threshold', async () => {
    const dto = plainToInstance(CreateNotificationRuleDto, {
      agent_name: 'demo-agent',
      metric_type: 'cost',
      threshold: -5,
      period: 'day',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([['hour'], ['day'], ['week'], ['month']])('accepts valid period "%s"', async (period) => {
    const dto = plainToInstance(CreateNotificationRuleDto, {
      agent_name: 'demo-agent',
      metric_type: 'tokens',
      threshold: 1000,
      period,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each([['invalid'], ['daily'], ['yearly'], ['HOUR'], ['Day'], ['minute'], ['second'], ['']])(
    'rejects invalid period "%s"',
    async (period) => {
      const dto = plainToInstance(CreateNotificationRuleDto, {
        agent_name: 'demo-agent',
        metric_type: 'tokens',
        threshold: 1000,
        period,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const periodError = errors.find((e) => e.property === 'period');
      expect(periodError).toBeDefined();
      expect(periodError?.constraints).toHaveProperty('isIn');
    },
  );

  it('rejects missing period (required field)', async () => {
    const dto = plainToInstance(CreateNotificationRuleDto, {
      agent_name: 'demo-agent',
      metric_type: 'tokens',
      threshold: 1000,
    });
    const errors = await validate(dto);
    const periodError = errors.find((e) => e.property === 'period');
    expect(periodError).toBeDefined();
    expect(periodError?.constraints).toHaveProperty('isIn');
  });

  it('rejects numeric period', async () => {
    const dto = plainToInstance(CreateNotificationRuleDto, {
      agent_name: 'demo-agent',
      metric_type: 'tokens',
      threshold: 1000,
      period: 1,
    });
    const errors = await validate(dto);
    const periodError = errors.find((e) => e.property === 'period');
    expect(periodError).toBeDefined();
    expect(periodError?.constraints).toHaveProperty('isIn');
  });

  it('rejects null period', async () => {
    const dto = plainToInstance(CreateNotificationRuleDto, {
      agent_name: 'demo-agent',
      metric_type: 'tokens',
      threshold: 1000,
      period: null,
    });
    const errors = await validate(dto);
    const periodError = errors.find((e) => e.property === 'period');
    expect(periodError).toBeDefined();
    expect(periodError?.constraints).toHaveProperty('isIn');
  });
});

describe('UpdateNotificationRuleDto', () => {
  it('validates with only partial fields', async () => {
    const dto = plainToInstance(UpdateNotificationRuleDto, {
      threshold: 500,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('validates empty update', async () => {
    const dto = plainToInstance(UpdateNotificationRuleDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid period', async () => {
    const dto = plainToInstance(UpdateNotificationRuleDto, {
      period: 'yearly',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([['hour'], ['day'], ['week'], ['month']])('accepts valid period "%s"', async (period) => {
    const dto = plainToInstance(UpdateNotificationRuleDto, { period });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it.each([['invalid'], ['daily'], ['HOUR'], ['Day'], ['minute'], ['second'], ['']])(
    'rejects invalid period "%s" with isIn constraint',
    async (period) => {
      const dto = plainToInstance(UpdateNotificationRuleDto, { period });
      const errors = await validate(dto);
      const periodError = errors.find((e) => e.property === 'period');
      expect(periodError).toBeDefined();
      expect(periodError?.constraints).toHaveProperty('isIn');
    },
  );

  it('rejects numeric period', async () => {
    const dto = plainToInstance(UpdateNotificationRuleDto, { period: 7 });
    const errors = await validate(dto);
    const periodError = errors.find((e) => e.property === 'period');
    expect(periodError).toBeDefined();
    expect(periodError?.constraints).toHaveProperty('isIn');
  });

  it('transforms is_active via @Type(() => Boolean)', async () => {
    const dto = plainToInstance(UpdateNotificationRuleDto, {
      is_active: 'true',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.is_active).toBe(true);
  });

  it('validates is_active as boolean after transform', async () => {
    const dto = plainToInstance(UpdateNotificationRuleDto, {
      is_active: false,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.is_active).toBe(false);
  });
});

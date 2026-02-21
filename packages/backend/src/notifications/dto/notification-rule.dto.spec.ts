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
});

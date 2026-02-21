import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTelemetryDto, TelemetryEventDto, SecurityEventDto } from './create-telemetry.dto';

describe('SecurityEventDto', () => {
  it('accepts valid severity values', async () => {
    for (const severity of ['critical', 'warning', 'info']) {
      const dto = plainToInstance(SecurityEventDto, {
        severity,
        category: 'auth',
        description: 'test event',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid severity', async () => {
    const dto = plainToInstance(SecurityEventDto, {
      severity: 'low',
      category: 'auth',
      description: 'test',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('TelemetryEventDto', () => {
  const validEvent = {
    timestamp: '2025-01-01T00:00:00Z',
    description: 'Test message',
    service_type: 'agent',
    status: 'ok',
  };

  it('accepts valid events', async () => {
    const dto = plainToInstance(TelemetryEventDto, validEvent);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts all valid service_type values', async () => {
    for (const service_type of ['agent', 'browser', 'voice', 'whatsapp', 'api', 'other']) {
      const dto = plainToInstance(TelemetryEventDto, { ...validEvent, service_type });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('accepts all valid status values', async () => {
    for (const status of ['ok', 'retry', 'error']) {
      const dto = plainToInstance(TelemetryEventDto, { ...validEvent, status });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects invalid status', async () => {
    const dto = plainToInstance(TelemetryEventDto, { ...validEvent, status: 'fail' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts optional numeric fields', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      ...validEvent,
      input_tokens: 100,
      output_tokens: 200,
      model: 'gpt-4o',
      agent_name: 'my-bot',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects negative token values', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      ...validEvent,
      input_tokens: -1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateTelemetryDto', () => {
  it('accepts valid events array', async () => {
    const dto = plainToInstance(CreateTelemetryDto, {
      events: [{
        timestamp: '2025-01-01T00:00:00Z',
        description: 'test',
        service_type: 'agent',
        status: 'ok',
      }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects empty events array', async () => {
    const dto = plainToInstance(CreateTelemetryDto, { events: [] });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing events', async () => {
    const dto = plainToInstance(CreateTelemetryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTelemetryDto, TelemetryEventDto, SecurityEventDto } from './create-telemetry.dto';

describe('SecurityEventDto', () => {
  it('validates correct security event', async () => {
    const dto = plainToInstance(SecurityEventDto, {
      severity: 'critical',
      category: 'injection',
      description: 'SQL injection attempt',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid severity', async () => {
    const dto = plainToInstance(SecurityEventDto, {
      severity: 'high',
      category: 'test',
      description: 'test',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('TelemetryEventDto', () => {
  it('validates a minimal event', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      timestamp: '2024-01-01T00:00:00Z',
      description: 'test event',
      service_type: 'agent',
      status: 'ok',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('validates with optional numeric fields', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      timestamp: '2024-01-01T00:00:00Z',
      description: 'test event',
      service_type: 'api',
      status: 'error',
      input_tokens: 100,
      output_tokens: 200,
      model: 'gpt-4',
      agent_name: 'my-agent',
      skill_name: 'search',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects negative input_tokens', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      timestamp: '2024-01-01T00:00:00Z',
      description: 'test',
      service_type: 'agent',
      status: 'ok',
      input_tokens: -1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects negative output_tokens', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      timestamp: '2024-01-01T00:00:00Z',
      description: 'test',
      service_type: 'agent',
      status: 'ok',
      output_tokens: -5,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateTelemetryDto', () => {
  it('validates with array of events', async () => {
    const dto = plainToInstance(CreateTelemetryDto, {
      events: [
        {
          timestamp: '2024-01-01T00:00:00Z',
          description: 'test',
          service_type: 'agent',
          status: 'ok',
        },
      ],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects empty events array', async () => {
    const dto = plainToInstance(CreateTelemetryDto, { events: [] });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

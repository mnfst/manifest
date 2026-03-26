import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTelemetryDto, TelemetryEventDto } from './create-telemetry.dto';

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

  it('rejects timestamp exceeding max length', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      timestamp: 'x'.repeat(51),
      description: 'test',
      service_type: 'agent',
      status: 'ok',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects description exceeding max length', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      timestamp: '2024-01-01T00:00:00Z',
      description: 'x'.repeat(4097),
      service_type: 'agent',
      status: 'ok',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects model exceeding max length', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      timestamp: '2024-01-01T00:00:00Z',
      description: 'test',
      service_type: 'agent',
      status: 'ok',
      model: 'x'.repeat(257),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects agent_name exceeding max length', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      timestamp: '2024-01-01T00:00:00Z',
      description: 'test',
      service_type: 'agent',
      status: 'ok',
      agent_name: 'x'.repeat(257),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects skill_name exceeding max length', async () => {
    const dto = plainToInstance(TelemetryEventDto, {
      timestamp: '2024-01-01T00:00:00Z',
      description: 'test',
      service_type: 'agent',
      status: 'ok',
      skill_name: 'x'.repeat(257),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
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

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TelemetryService } from './telemetry.service';
import { AgentMessage } from '../entities/agent-message.entity';
import { SecurityEvent } from '../entities/security-event.entity';
import { TelemetryEventDto } from './dto/create-telemetry.dto';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';
import { ModelPricingCacheService } from '../model-prices/model-pricing-cache.service';

function makeEvent(overrides: Partial<TelemetryEventDto> = {}): TelemetryEventDto {
  const dto = new TelemetryEventDto();
  dto.timestamp = '2026-02-16T10:00:00Z';
  dto.description = 'Test event';
  dto.service_type = 'agent';
  dto.status = 'ok';
  Object.assign(dto, overrides);
  return dto;
}

describe('TelemetryService', () => {
  let service: TelemetryService;
  let mockTurnInsert: jest.Mock;
  let mockPricingGetByModel: jest.Mock;
  let mockSecurityInsert: jest.Mock;

  beforeEach(async () => {
    mockTurnInsert = jest.fn().mockResolvedValue({});
    mockPricingGetByModel = jest.fn().mockReturnValue(undefined);
    mockSecurityInsert = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        { provide: getRepositoryToken(AgentMessage), useValue: { insert: mockTurnInsert } },
        { provide: getRepositoryToken(SecurityEvent), useValue: { insert: mockSecurityInsert } },
        { provide: IngestEventBusService, useValue: { emit: jest.fn() } },
        { provide: ModelPricingCacheService, useValue: { getByModel: mockPricingGetByModel } },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('accepts valid events', async () => {
    const result = await service.ingest([
      makeEvent({ input_tokens: 100, output_tokens: 50 }),
    ], 'test-user');

    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockTurnInsert).toHaveBeenCalledTimes(1);
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        input_tokens: 100,
        output_tokens: 50,
        user_id: 'test-user',
      }),
    );
  });

  it('reports rejected when insert fails', async () => {
    mockTurnInsert.mockRejectedValueOnce(new Error('DB error'));

    const result = await service.ingest([makeEvent()], 'test-user');

    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(1);
    expect(result.errors[0].reason).toBe('DB error');
  });

  it('handles mixed success and failure', async () => {
    mockTurnInsert
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('DB error'));

    const result = await service.ingest([makeEvent(), makeEvent()], 'test-user');

    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(1);
  });

  it('looks up model pricing for cost calculation', async () => {
    mockPricingGetByModel.mockReturnValue({
      input_price_per_token: 0.000015,
      output_price_per_token: 0.000075,
    });

    const result = await service.ingest([
      makeEvent({
        model: 'claude-opus-4-6',
        input_tokens: 1000,
        output_tokens: 500,
      }),
    ], 'test-user');

    expect(result.accepted).toBe(1);
    expect(mockPricingGetByModel).toHaveBeenCalledWith('claude-opus-4-6');
    expect(mockTurnInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        // cost = 1000 * 0.000015 + 500 * 0.000075 = 0.0525
        cost_usd: expect.closeTo(0.0525, 4),
      }),
    );
  });
});

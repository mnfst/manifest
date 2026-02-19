import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService, IngestResult } from './telemetry.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { Request } from 'express';

describe('TelemetryController', () => {
  let controller: TelemetryController;
  let mockIngest: jest.Mock;

  beforeEach(async () => {
    mockIngest = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelemetryController],
      providers: [
        {
          provide: TelemetryService,
          useValue: { ingest: mockIngest },
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TelemetryController>(TelemetryController);
  });

  function makeRequest(apiKeyUserId?: string): Request & { apiKeyUserId?: string } {
    return { apiKeyUserId } as Request & { apiKeyUserId?: string };
  }

  it('returns ingest result when events are accepted', async () => {
    const ingestResult: IngestResult = { accepted: 2, rejected: 0, errors: [] };
    mockIngest.mockResolvedValue(ingestResult);

    const body = { events: [{ timestamp: 't', description: 'd', service_type: 'agent', status: 'ok' }] };
    const result = await controller.ingest(body as never, makeRequest('user-1'));

    expect(result).toEqual(ingestResult);
    expect(mockIngest).toHaveBeenCalledWith(body.events, 'user-1');
  });

  it('uses empty string when apiKeyUserId is not set', async () => {
    const ingestResult: IngestResult = { accepted: 1, rejected: 0, errors: [] };
    mockIngest.mockResolvedValue(ingestResult);

    const body = { events: [{ timestamp: 't', description: 'd', service_type: 'agent', status: 'ok' }] };
    await controller.ingest(body as never, makeRequest());

    expect(mockIngest).toHaveBeenCalledWith(body.events, '');
  });

  it('throws BadRequestException when all events are rejected', async () => {
    const ingestResult: IngestResult = {
      accepted: 0,
      rejected: 2,
      errors: [
        { index: 0, reason: 'fail 1' },
        { index: 1, reason: 'fail 2' },
      ],
    };
    mockIngest.mockResolvedValue(ingestResult);

    const body = { events: [{ timestamp: 't' }, { timestamp: 't2' }] };
    await expect(controller.ingest(body as never, makeRequest('u'))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns partial result when some events succeed and some fail', async () => {
    const ingestResult: IngestResult = {
      accepted: 1,
      rejected: 1,
      errors: [{ index: 1, reason: 'DB error' }],
    };
    mockIngest.mockResolvedValue(ingestResult);

    const body = { events: [{ timestamp: 't1' }, { timestamp: 't2' }] };
    const result = await controller.ingest(body as never, makeRequest('u'));

    expect(result).toEqual(ingestResult);
  });
});

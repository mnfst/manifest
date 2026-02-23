import { Test, TestingModule } from '@nestjs/testing';
import { OtlpController } from './otlp.controller';
import { OtlpDecoderService } from './services/otlp-decoder.service';
import { TraceIngestService } from './services/trace-ingest.service';
import { MetricIngestService } from './services/metric-ingest.service';
import { LogIngestService } from './services/log-ingest.service';
import { OtlpAuthGuard } from './guards/otlp-auth.guard';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';

jest.mock('../common/utils/product-telemetry', () => ({
  trackCloudEvent: jest.fn(),
}));

describe('OtlpController', () => {
  let controller: OtlpController;
  let mockDecoder: Record<string, jest.Mock>;
  let mockTraceIngest: Record<string, jest.Mock>;
  let mockMetricIngest: Record<string, jest.Mock>;
  let mockLogIngest: Record<string, jest.Mock>;
  let mockEventBus: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockDecoder = {
      decodeTraces: jest.fn().mockReturnValue({ resourceSpans: [] }),
      decodeMetrics: jest.fn().mockReturnValue({ resourceMetrics: [] }),
      decodeLogs: jest.fn().mockReturnValue({ resourceLogs: [] }),
    };
    mockTraceIngest = { ingest: jest.fn().mockResolvedValue({ accepted: 5 }) };
    mockMetricIngest = { ingest: jest.fn().mockResolvedValue({ accepted: 3 }) };
    mockLogIngest = { ingest: jest.fn().mockResolvedValue({ accepted: 2 }) };
    mockEventBus = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OtlpController],
      providers: [
        { provide: OtlpDecoderService, useValue: mockDecoder },
        { provide: TraceIngestService, useValue: mockTraceIngest },
        { provide: MetricIngestService, useValue: mockMetricIngest },
        { provide: LogIngestService, useValue: mockLogIngest },
        { provide: IngestEventBusService, useValue: mockEventBus },
      ],
    })
      .overrideGuard(OtlpAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OtlpController>(OtlpController);
  });

  function makeReq(contentType: string, body: unknown, rawBody?: Buffer) {
    return {
      headers: { 'content-type': contentType },
      body,
      rawBody,
      ingestionContext: { tenantId: 'test-tenant', agentId: 'test-agent', agentName: 'test-agent', userId: 'test-user' },
    } as never;
  }

  describe('ingestTraces', () => {
    it('decodes and ingests trace data', async () => {
      await controller.ingestTraces(makeReq('application/json', {}, undefined));

      expect(mockDecoder.decodeTraces).toHaveBeenCalled();
      expect(mockTraceIngest.ingest).toHaveBeenCalled();
    });

    it('returns undefined partialSuccess when spans are accepted', async () => {
      mockTraceIngest.ingest.mockResolvedValue({ accepted: 5 });
      const result = await controller.ingestTraces(makeReq('application/json', {}, undefined));

      expect(result.partialSuccess).toBeUndefined();
    });

    it('returns partialSuccess with rejectedSpans 0 when no spans accepted', async () => {
      mockTraceIngest.ingest.mockResolvedValue({ accepted: 0 });
      const result = await controller.ingestTraces(makeReq('application/json', {}, undefined));

      expect(result.partialSuccess).toEqual({ rejectedSpans: 0 });
    });
  });

  describe('ingestMetrics', () => {
    it('decodes and ingests metric data', async () => {
      await controller.ingestMetrics(makeReq('application/json', {}, undefined));

      expect(mockDecoder.decodeMetrics).toHaveBeenCalled();
      expect(mockMetricIngest.ingest).toHaveBeenCalled();
    });

    it('returns partialSuccess with rejectedDataPoints 0 when no metrics accepted', async () => {
      mockMetricIngest.ingest.mockResolvedValue({ accepted: 0 });
      const result = await controller.ingestMetrics(makeReq('application/json', {}, undefined));

      expect(result.partialSuccess).toEqual({ rejectedDataPoints: 0 });
    });
  });

  describe('ingestLogs', () => {
    it('decodes and ingests log data', async () => {
      await controller.ingestLogs(makeReq('application/json', {}, undefined));

      expect(mockDecoder.decodeLogs).toHaveBeenCalled();
      expect(mockLogIngest.ingest).toHaveBeenCalled();
    });

    it('returns partialSuccess with rejectedLogRecords 0 when no logs accepted', async () => {
      mockLogIngest.ingest.mockResolvedValue({ accepted: 0 });
      const result = await controller.ingestLogs(makeReq('application/json', {}, undefined));

      expect(result.partialSuccess).toEqual({ rejectedLogRecords: 0 });
    });
  });
});

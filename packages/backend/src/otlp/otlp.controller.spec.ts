import { Test, TestingModule } from '@nestjs/testing';
import { OtlpController } from './otlp.controller';
import { OtlpDecoderService } from './services/otlp-decoder.service';
import { TraceIngestService } from './services/trace-ingest.service';
import { MetricIngestService } from './services/metric-ingest.service';
import { LogIngestService } from './services/log-ingest.service';
import { OtlpAuthGuard } from './guards/otlp-auth.guard';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';
import { trackEvent, trackCloudEvent } from '../common/utils/product-telemetry';
import { existsSync } from 'fs';

jest.mock('../common/utils/product-telemetry', () => ({
  trackEvent: jest.fn(),
  trackCloudEvent: jest.fn(),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(false),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
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
      ingestionContext: {
        tenantId: 'test-tenant',
        agentId: 'test-agent',
        agentName: 'test-agent',
        userId: 'test-user',
      },
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

  describe('trackFirstTelemetry', () => {
    const origMode = process.env['MANIFEST_MODE'];

    beforeEach(() => {
      (trackEvent as jest.Mock).mockClear();
      (trackCloudEvent as jest.Mock).mockClear();
      (existsSync as jest.Mock).mockReturnValue(false);
    });

    afterEach(() => {
      if (origMode === undefined) delete process.env['MANIFEST_MODE'];
      else process.env['MANIFEST_MODE'] = origMode;
    });

    it('calls trackCloudEvent in cloud mode', async () => {
      delete process.env['MANIFEST_MODE'];
      await controller.ingestTraces(makeReq('application/json', {}, undefined));

      expect(trackCloudEvent).toHaveBeenCalledWith('first_telemetry_received', 'test-user', {
        agent_id_hash: 'test-age',
      });
      expect(trackCloudEvent).not.toHaveBeenCalledWith(
        'plugin_registered',
        expect.anything(),
        expect.anything(),
      );
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('calls trackEvent in local mode', async () => {
      process.env['MANIFEST_MODE'] = 'local';
      (existsSync as jest.Mock).mockReturnValue(false);
      await controller.ingestTraces(makeReq('application/json', {}, undefined));

      expect(trackEvent).toHaveBeenCalledWith('first_telemetry_received', {
        agent_id_hash: 'test-age',
      });
      expect(trackCloudEvent).not.toHaveBeenCalled();
    });

    it('skips tracking in local mode when marker file exists', async () => {
      process.env['MANIFEST_MODE'] = 'local';
      (existsSync as jest.Mock).mockReturnValue(true);
      await controller.ingestTraces(makeReq('application/json', {}, undefined));

      expect(trackEvent).not.toHaveBeenCalled();
      expect(trackCloudEvent).not.toHaveBeenCalled();
    });

    it('deduplicates by agentId in cloud mode', async () => {
      delete process.env['MANIFEST_MODE'];
      await controller.ingestTraces(makeReq('application/json', {}, undefined));
      await controller.ingestTraces(makeReq('application/json', {}, undefined));

      // 1 call on first ingest (first_telemetry_received), 0 on second
      expect(trackCloudEvent).toHaveBeenCalledTimes(1);
    });

    it('emits first_telemetry_received via metrics ingestion', async () => {
      delete process.env['MANIFEST_MODE'];
      await controller.ingestMetrics(makeReq('application/json', {}, undefined));

      expect(trackCloudEvent).toHaveBeenCalledWith('first_telemetry_received', 'test-user', {
        agent_id_hash: 'test-age',
      });
      expect(trackCloudEvent).not.toHaveBeenCalledWith(
        'plugin_registered',
        expect.anything(),
        expect.anything(),
      );
    });

    it('emits first_telemetry_received via logs ingestion', async () => {
      delete process.env['MANIFEST_MODE'];
      await controller.ingestLogs(makeReq('application/json', {}, undefined));

      expect(trackCloudEvent).toHaveBeenCalledWith('first_telemetry_received', 'test-user', {
        agent_id_hash: 'test-age',
      });
      expect(trackCloudEvent).not.toHaveBeenCalledWith(
        'plugin_registered',
        expect.anything(),
        expect.anything(),
      );
    });

    it('deduplicates across different ingestion methods for the same agent', async () => {
      delete process.env['MANIFEST_MODE'];
      await controller.ingestTraces(makeReq('application/json', {}, undefined));
      await controller.ingestMetrics(makeReq('application/json', {}, undefined));
      await controller.ingestLogs(makeReq('application/json', {}, undefined));

      // Only the first call (traces) should trigger the event
      expect(trackCloudEvent).toHaveBeenCalledTimes(1);
    });

    it('tracks separately for different agentIds in cloud mode', async () => {
      delete process.env['MANIFEST_MODE'];

      const reqAgent1 = {
        headers: { 'content-type': 'application/json' },
        body: {},
        rawBody: undefined,
        ingestionContext: {
          tenantId: 'tenant-1',
          agentId: 'agent-1',
          agentName: 'agent-1',
          userId: 'user-1',
        },
      } as never;

      const reqAgent2 = {
        headers: { 'content-type': 'application/json' },
        body: {},
        rawBody: undefined,
        ingestionContext: {
          tenantId: 'tenant-1',
          agentId: 'agent-2',
          agentName: 'agent-2',
          userId: 'user-1',
        },
      } as never;

      await controller.ingestTraces(reqAgent1);
      await controller.ingestTraces(reqAgent2);

      // 1 event per agent = 2 total
      expect(trackCloudEvent).toHaveBeenCalledTimes(2);
    });

    it('uses userId as the distinct_id key for trackCloudEvent', async () => {
      delete process.env['MANIFEST_MODE'];

      const req = {
        headers: { 'content-type': 'application/json' },
        body: {},
        rawBody: undefined,
        ingestionContext: {
          tenantId: 'my-tenant',
          agentId: 'my-agent',
          agentName: 'my-agent',
          userId: 'user-abc-123',
        },
      } as never;

      await controller.ingestTraces(req);

      expect(trackCloudEvent).toHaveBeenCalledWith('first_telemetry_received', 'user-abc-123', {
        agent_id_hash: 'my-agent',
      });
      expect(trackCloudEvent).not.toHaveBeenCalledWith(
        'plugin_registered',
        expect.anything(),
        expect.anything(),
      );
    });

    it('does not emit events when no data is accepted', async () => {
      delete process.env['MANIFEST_MODE'];
      mockTraceIngest.ingest.mockResolvedValue({ accepted: 0 });

      await controller.ingestTraces(makeReq('application/json', {}, undefined));

      expect(trackCloudEvent).not.toHaveBeenCalled();
      expect(trackEvent).not.toHaveBeenCalled();
    });
  });
});

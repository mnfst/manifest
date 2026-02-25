import { Controller, Post, Req, UseGuards, HttpCode, Logger } from '@nestjs/common';
import { Request } from 'express';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Public } from '../common/decorators/public.decorator';
import { OtlpAuthGuard } from './guards/otlp-auth.guard';
import { OtlpDecoderService } from './services/otlp-decoder.service';
import { TraceIngestService } from './services/trace-ingest.service';
import { MetricIngestService } from './services/metric-ingest.service';
import { LogIngestService } from './services/log-ingest.service';
import { IngestionContext } from './interfaces/ingestion-context.interface';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';
import { trackEvent, trackCloudEvent } from '../common/utils/product-telemetry';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
  ingestionContext: IngestionContext;
}

@Controller('otlp/v1')
@Public()
@UseGuards(OtlpAuthGuard)
export class OtlpController {
  private readonly logger = new Logger(OtlpController.name);
  private readonly seenAgents = new Set<string>();

  constructor(
    private readonly decoder: OtlpDecoderService,
    private readonly traceIngest: TraceIngestService,
    private readonly metricIngest: MetricIngestService,
    private readonly logIngest: LogIngestService,
    private readonly eventBus: IngestEventBusService,
  ) {}

  @Post('traces')
  @HttpCode(200)
  async ingestTraces(@Req() req: RawBodyRequest) {
    const ctx = req.ingestionContext;
    const payload = this.decoder.decodeTraces(req.headers['content-type'], req.body, req.rawBody);
    const result = await this.traceIngest.ingest(payload, ctx);
    if (result.accepted > 0) {
      this.eventBus.emit(ctx.userId);
      this.trackFirstTelemetry(ctx);
    }
    this.logger.debug(`[${ctx.tenantId}/${ctx.agentId}] Traces: ${result.accepted} spans`);
    return { partialSuccess: result.accepted === 0 ? { rejectedSpans: 0 } : undefined };
  }

  @Post('metrics')
  @HttpCode(200)
  async ingestMetrics(@Req() req: RawBodyRequest) {
    const ctx = req.ingestionContext;
    const payload = this.decoder.decodeMetrics(req.headers['content-type'], req.body, req.rawBody);
    const result = await this.metricIngest.ingest(payload, ctx);
    if (result.accepted > 0) {
      this.eventBus.emit(ctx.userId);
      this.trackFirstTelemetry(ctx);
    }
    this.logger.debug(`[${ctx.tenantId}/${ctx.agentId}] Metrics: ${result.accepted} points`);
    return { partialSuccess: result.accepted === 0 ? { rejectedDataPoints: 0 } : undefined };
  }

  @Post('logs')
  @HttpCode(200)
  async ingestLogs(@Req() req: RawBodyRequest) {
    const ctx = req.ingestionContext;
    const payload = this.decoder.decodeLogs(req.headers['content-type'], req.body, req.rawBody);
    const result = await this.logIngest.ingest(payload, ctx);
    if (result.accepted > 0) {
      this.eventBus.emit(ctx.userId);
      this.trackFirstTelemetry(ctx);
    }
    this.logger.debug(`[${ctx.tenantId}/${ctx.agentId}] Logs: ${result.accepted} records`);
    return { partialSuccess: result.accepted === 0 ? { rejectedLogRecords: 0 } : undefined };
  }

  private trackFirstTelemetry(ctx: IngestionContext): void {
    const isLocal = process.env['MANIFEST_MODE'] === 'local';
    if (isLocal) {
      const markerDir = join(homedir(), '.openclaw', 'manifest');
      const markerPath = join(markerDir, '.first_telemetry_sent');
      if (existsSync(markerPath)) return;
      trackEvent('first_telemetry_received', {
        agent_id_hash: ctx.agentId.slice(0, 8),
      });
      mkdirSync(markerDir, { recursive: true });
      writeFileSync(markerPath, new Date().toISOString(), { mode: 0o600 });
    } else {
      if (this.seenAgents.has(ctx.agentId)) return;
      this.seenAgents.add(ctx.agentId);
      trackCloudEvent('first_telemetry_received', ctx.tenantId, {
        agent_id_hash: ctx.agentId.slice(0, 8),
      });
    }
  }
}

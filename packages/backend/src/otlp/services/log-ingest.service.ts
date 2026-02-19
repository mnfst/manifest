import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AgentLog } from '../../entities/agent-log.entity';
import { OtlpExportLogsServiceRequest } from '../interfaces';
import { IngestionContext } from '../interfaces/ingestion-context.interface';
import {
  extractAttributes,
  nanoToDatetime,
  toHexString,
  severityNumberToString,
  attrString,
} from './otlp-helpers';

@Injectable()
export class LogIngestService {
  constructor(
    @InjectRepository(AgentLog)
    private readonly logRepo: Repository<AgentLog>,
  ) {}

  async ingest(
    request: OtlpExportLogsServiceRequest,
    ctx: IngestionContext,
  ): Promise<{ accepted: number }> {
    let accepted = 0;

    for (const rl of request.resourceLogs ?? []) {
      const resourceAttrs = extractAttributes(rl.resource?.attributes);
      const agentName = attrString(resourceAttrs, 'agent.name') ?? attrString(resourceAttrs, 'service.name');

      for (const sl of rl.scopeLogs ?? []) {
        for (const log of sl.logRecords ?? []) {
          const logAttrs = extractAttributes(log.attributes);
          const severity = log.severityText ?? severityNumberToString(log.severityNumber);
          const body = log.body?.stringValue ?? (log.body ? JSON.stringify(log.body) : null);

          await this.logRepo.insert({
            id: uuidv4(),
            tenant_id: ctx.tenantId,
            agent_id: ctx.agentId,
            timestamp: nanoToDatetime(log.timeUnixNano),
            agent_name: attrString(logAttrs, 'agent.name') ?? agentName,
            severity,
            body,
            trace_id: log.traceId ? toHexString(log.traceId) : null,
            span_id: log.spanId ? toHexString(log.spanId) : null,
            attributes: Object.keys(logAttrs).length > 0 ? JSON.stringify(logAttrs) : null,
          });
          accepted++;
        }
      }
    }

    return { accepted };
  }
}

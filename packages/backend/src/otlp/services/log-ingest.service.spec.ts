import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LogIngestService } from './log-ingest.service';
import { AgentLog } from '../../entities/agent-log.entity';
import { IngestionContext } from '../interfaces/ingestion-context.interface';

const testCtx: IngestionContext = { tenantId: 'test-tenant', agentId: 'test-agent', agentName: 'test-agent', userId: 'test-user' };

describe('LogIngestService', () => {
  let service: LogIngestService;
  let mockInsert: jest.Mock;

  beforeEach(async () => {
    mockInsert = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogIngestService,
        { provide: getRepositoryToken(AgentLog), useValue: { insert: mockInsert } },
      ],
    }).compile();

    service = module.get<LogIngestService>(LogIngestService);
  });

  it('returns accepted count of 0 for empty request', async () => {
    const result = await service.ingest({ resourceLogs: [] }, testCtx);
    expect(result.accepted).toBe(0);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('ingests a single log record', async () => {
    const request = {
      resourceLogs: [{
        resource: {
          attributes: [{ key: 'agent.name', value: { stringValue: 'bot-1' } }],
        },
        scopeLogs: [{
          scope: { name: 'test' },
          logRecords: [{
            timeUnixNano: '1708000000000000000',
            severityText: 'info',
            body: { stringValue: 'Test log message' },
            attributes: [],
          }],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.tenant_id).toBe('test-tenant');
    expect(insertArg.agent_id).toBe('test-agent');
    expect(insertArg.agent_name).toBe('bot-1');
    expect(insertArg.severity).toBe('info');
    expect(insertArg.body).toBe('Test log message');
  });

  it('falls back to severityNumber when severityText is absent', async () => {
    const request = {
      resourceLogs: [{
        resource: { attributes: [] },
        scopeLogs: [{
          scope: { name: 'test' },
          logRecords: [{
            timeUnixNano: '1708000000000000000',
            severityNumber: 17,
            body: { stringValue: 'Error occurred' },
          }],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.severity).toBe('error');
  });

  it('ingests multiple log records across scopes', async () => {
    const request = {
      resourceLogs: [{
        resource: { attributes: [] },
        scopeLogs: [
          {
            scope: { name: 'scope1' },
            logRecords: [
              { timeUnixNano: '1708000000000000000', severityText: 'info', body: { stringValue: 'msg1' } },
              { timeUnixNano: '1708000000000000000', severityText: 'warn', body: { stringValue: 'msg2' } },
            ],
          },
          {
            scope: { name: 'scope2' },
            logRecords: [
              { timeUnixNano: '1708000000000000000', severityText: 'error', body: { stringValue: 'msg3' } },
            ],
          },
        ],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(3);
    expect(mockInsert).toHaveBeenCalledTimes(3);
  });

  it('serializes non-string body as JSON', async () => {
    const request = {
      resourceLogs: [{
        resource: { attributes: [] },
        scopeLogs: [{
          scope: { name: 'test' },
          logRecords: [{
            timeUnixNano: '1708000000000000000',
            severityText: 'info',
            body: { intValue: 42 },
          }],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.body).toBe('{"intValue":42}');
  });

  it('handles traceId and spanId when present', async () => {
    const request = {
      resourceLogs: [{
        resource: { attributes: [] },
        scopeLogs: [{
          scope: { name: 'test' },
          logRecords: [{
            timeUnixNano: '1708000000000000000',
            severityText: 'info',
            body: { stringValue: 'msg' },
            traceId: 'abc123',
            spanId: 'def456',
          }],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.trace_id).toBe('abc123');
    expect(insertArg.span_id).toBe('def456');
  });

  it('handles missing resourceLogs', async () => {
    const request = { resourceLogs: undefined as never };
    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(0);
  });
});

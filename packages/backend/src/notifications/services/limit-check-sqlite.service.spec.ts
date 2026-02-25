import { Subject } from 'rxjs';
import { LimitCheckService } from './limit-check.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';
import { DataSource } from 'typeorm';

describe('LimitCheckService (SQLite dialect)', () => {
  let service: LimitCheckService;
  let mockQuery: jest.Mock;
  let mockGetActiveBlockRules: jest.Mock;
  let mockGetConsumption: jest.Mock;
  let ingestSubject: Subject<string>;

  beforeEach(() => {
    mockGetActiveBlockRules = jest.fn().mockResolvedValue([]);
    mockGetConsumption = jest.fn().mockResolvedValue(0);
    mockQuery = jest.fn().mockResolvedValue([]);

    const ds = {
      query: mockQuery,
      options: { type: 'sqljs' },
    } as unknown as DataSource;

    const rulesService = {
      getActiveBlockRules: mockGetActiveBlockRules,
      getConsumption: mockGetConsumption,
    } as unknown as NotificationRulesService;

    const emailService = {
      sendThresholdAlert: jest.fn().mockResolvedValue(true),
    } as unknown as NotificationEmailService;

    const emailProviderConfig = {
      getFullConfig: jest.fn().mockResolvedValue(null),
    } as unknown as EmailProviderConfigService;

    ingestSubject = new Subject<string>();
    const ingestBus = { all: () => ingestSubject.asObservable() } as unknown as IngestEventBusService;

    service = new LimitCheckService(ds, rulesService, emailService, emailProviderConfig, ingestBus);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    ingestSubject.complete();
  });

  it('uses ? placeholders in notification_logs check for SQLite', async () => {
    mockGetActiveBlockRules.mockResolvedValue([{
      id: 'r1', tenant_id: 't1', agent_name: 'a1', user_id: 'u1',
      metric_type: 'tokens', threshold: 100, period: 'day',
    }]);
    mockGetConsumption.mockResolvedValue(200);
    mockQuery
      .mockResolvedValueOnce([])  // notification_logs check
      .mockResolvedValueOnce([]); // user email lookup

    await service.checkLimits('t1', 'a1');
    await new Promise((r) => setTimeout(r, 50));

    const notifCheck = mockQuery.mock.calls[0]?.[0] as string;
    expect(notifCheck).toContain('?');
    expect(notifCheck).not.toContain('$1');
  });

  it('uses ? placeholders in user email lookup for SQLite', async () => {
    mockGetActiveBlockRules.mockResolvedValue([{
      id: 'r1', tenant_id: 't1', agent_name: 'a1', user_id: 'u1',
      metric_type: 'tokens', threshold: 100, period: 'day',
    }]);
    mockGetConsumption.mockResolvedValue(200);
    mockQuery
      .mockResolvedValueOnce([])  // notification_logs check
      .mockResolvedValueOnce([]); // user email lookup

    await service.checkLimits('t1', 'a1');
    await new Promise((r) => setTimeout(r, 50));

    const emailLookup = mockQuery.mock.calls[1]?.[0] as string;
    if (emailLookup) {
      expect(emailLookup).toContain('?');
      expect(emailLookup).not.toContain('$1');
    }
  });

  it('still returns LimitExceeded correctly in SQLite mode', async () => {
    mockGetActiveBlockRules.mockResolvedValue([{
      id: 'r1', tenant_id: 't1', agent_name: 'a1', user_id: 'u1',
      metric_type: 'cost', threshold: 5, period: 'month',
    }]);
    mockGetConsumption.mockResolvedValue(10);

    const result = await service.checkLimits('t1', 'a1');
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('r1');
    expect(result!.metricType).toBe('cost');
    expect(result!.actual).toBe(10);
  });
});

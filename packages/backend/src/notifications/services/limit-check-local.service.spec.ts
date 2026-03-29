import { Subject } from 'rxjs';
import { LimitCheckService } from './limit-check.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { NotificationLogService } from './notification-log.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';
import { ManifestRuntimeService } from '../../common/services/manifest-runtime.service';

describe('LimitCheckService (local mode)', () => {
  let service: LimitCheckService;
  let mockGetActiveBlockRules: jest.Mock;
  let mockGetConsumption: jest.Mock;
  let ingestSubject: Subject<string>;
  let mockRuntime: { isLocalMode: jest.Mock; getAuthBaseUrl: jest.Mock };

  beforeEach(() => {
    mockGetActiveBlockRules = jest.fn().mockResolvedValue([]);
    mockGetConsumption = jest.fn().mockResolvedValue(0);

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

    mockRuntime = {
      isLocalMode: jest.fn().mockReturnValue(true),
      getAuthBaseUrl: jest.fn().mockReturnValue('http://localhost:3001'),
    };

    ingestSubject = new Subject<string>();
    const ingestBus = {
      all: () => ingestSubject.asObservable(),
    } as unknown as IngestEventBusService;

    const notificationLog = {
      hasAlreadySent: jest.fn().mockResolvedValue(false),
      insertLog: jest.fn().mockResolvedValue(undefined),
      resolveUserEmail: jest.fn().mockResolvedValue(null),
    } as unknown as NotificationLogService;

    service = new LimitCheckService(
      rulesService,
      emailService,
      emailProviderConfig,
      ingestBus,
      mockRuntime as unknown as ManifestRuntimeService,
      notificationLog,
    );
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    ingestSubject.complete();
  });

  it('still returns LimitExceeded correctly in local mode', async () => {
    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 't1',
        agent_name: 'a1',
        user_id: 'u1',
        metric_type: 'cost',
        threshold: 5,
        period: 'month',
      },
    ]);
    mockGetConsumption.mockResolvedValue(10);

    const result = await service.checkLimits('t1', 'a1');
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('r1');
    expect(result!.metricType).toBe('cost');
    expect(result!.actual).toBe(10);
  });
});

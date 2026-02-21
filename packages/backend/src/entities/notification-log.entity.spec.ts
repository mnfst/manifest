import { NotificationLog } from './notification-log.entity';

describe('NotificationLog entity', () => {
  it('creates an instance with all required fields', () => {
    const log = new NotificationLog();
    log.id = 'log-1';
    log.rule_id = 'rule-1';
    log.period_start = '2024-01-01T00:00:00Z';
    log.period_end = '2024-01-01T01:00:00Z';
    log.actual_value = 150.5;
    log.threshold_value = 100;
    log.metric_type = 'tokens';
    log.agent_name = 'test-agent';
    log.sent_at = '2024-01-01T00:30:00Z';
    expect(log.id).toBe('log-1');
    expect(log.rule_id).toBe('rule-1');
    expect(log.actual_value).toBe(150.5);
    expect(log.threshold_value).toBe(100);
    expect(log.metric_type).toBe('tokens');
    expect(log.agent_name).toBe('test-agent');
  });
});

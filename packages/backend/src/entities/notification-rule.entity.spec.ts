import { NotificationRule } from './notification-rule.entity';

describe('NotificationRule entity', () => {
  it('creates an instance with all fields', () => {
    const rule = new NotificationRule();
    rule.id = 'rule-1';
    rule.tenant_id = 'tenant-1';
    rule.agent_id = 'agent-1';
    rule.agent_name = 'demo-agent';
    rule.user_id = 'user-1';
    rule.metric_type = 'cost';
    rule.threshold = 50.25;
    rule.period = 'day';
    rule.is_active = true;
    rule.created_at = '2024-01-01T00:00:00Z';
    rule.updated_at = '2024-01-02T00:00:00Z';
    expect(rule.id).toBe('rule-1');
    expect(rule.metric_type).toBe('cost');
    expect(rule.threshold).toBe(50.25);
    expect(rule.period).toBe('day');
    expect(rule.is_active).toBe(true);
  });

  it('supports tokens metric type', () => {
    const rule = new NotificationRule();
    rule.metric_type = 'tokens';
    expect(rule.metric_type).toBe('tokens');
  });

  it('supports all period values', () => {
    const rule = new NotificationRule();
    for (const period of ['hour', 'day', 'week', 'month'] as const) {
      rule.period = period;
      expect(rule.period).toBe(period);
    }
  });
});

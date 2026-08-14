import { IngestEventBusService, IngestEvent } from './ingest-event-bus.service';

describe('IngestEventBusService', () => {
  let service: IngestEventBusService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new IngestEventBusService();
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('emits to the correct tenant after debounce', () => {
    const received: IngestEvent[] = [];
    service.forTenant('tenant-1').subscribe((e) => received.push(e));

    service.emit('tenant-1');
    expect(received).toHaveLength(0);

    jest.advanceTimersByTime(250);
    expect(received).toEqual([{ tenantId: 'tenant-1', kind: 'message', userId: undefined }]);
  });

  it('debounces rapid emissions for the same tenant/kind', () => {
    const received: IngestEvent[] = [];
    service.forTenant('tenant-1').subscribe((e) => received.push(e));

    service.emit('tenant-1');
    jest.advanceTimersByTime(100);
    service.emit('tenant-1');
    jest.advanceTimersByTime(100);
    service.emit('tenant-1');
    jest.advanceTimersByTime(100);

    expect(received).toHaveLength(0);

    jest.advanceTimersByTime(150);
    expect(received).toEqual([{ tenantId: 'tenant-1', kind: 'message', userId: undefined }]);
  });

  it('forwards the optional userId attribution', () => {
    const received: IngestEvent[] = [];
    service.forTenant('tenant-1').subscribe((e) => received.push(e));

    service.emit('tenant-1', 'message', 'user-9');
    jest.advanceTimersByTime(250);

    expect(received).toEqual([{ tenantId: 'tenant-1', kind: 'message', userId: 'user-9' }]);
  });

  it('different kinds for the same tenant fire independently', () => {
    const received: IngestEvent[] = [];
    service.forTenant('tenant-1').subscribe((e) => received.push(e));

    service.emit('tenant-1', 'message');
    service.emit('tenant-1', 'agent');
    jest.advanceTimersByTime(250);

    expect(received).toEqual([
      { tenantId: 'tenant-1', kind: 'message', userId: undefined },
      { tenantId: 'tenant-1', kind: 'agent', userId: undefined },
    ]);
  });

  it('does not deliver events for other tenants', () => {
    const received: IngestEvent[] = [];
    service.forTenant('tenant-1').subscribe((e) => received.push(e));

    service.emit('tenant-2');
    jest.advanceTimersByTime(250);

    expect(received).toHaveLength(0);
  });

  it('emits independently for different tenants', () => {
    const tenant1: IngestEvent[] = [];
    const tenant2: IngestEvent[] = [];
    service.forTenant('tenant-1').subscribe((e) => tenant1.push(e));
    service.forTenant('tenant-2').subscribe((e) => tenant2.push(e));

    service.emit('tenant-1');
    service.emit('tenant-2', 'routing');
    jest.advanceTimersByTime(250);

    expect(tenant1).toEqual([{ tenantId: 'tenant-1', kind: 'message', userId: undefined }]);
    expect(tenant2).toEqual([{ tenantId: 'tenant-2', kind: 'routing', userId: undefined }]);
  });

  it('null tenantId matches no events', () => {
    const received: IngestEvent[] = [];
    service.forTenant(null).subscribe((e) => received.push(e));

    service.emit('tenant-1');
    jest.advanceTimersByTime(250);

    expect(received).toHaveLength(0);
  });

  it('all() observes every event regardless of tenant', () => {
    const received: IngestEvent[] = [];
    service.all().subscribe((e) => received.push(e));

    service.emit('a');
    service.emit('b', 'agent');
    jest.advanceTimersByTime(250);

    expect(received).toHaveLength(2);
    expect(received).toContainEqual({ tenantId: 'a', kind: 'message', userId: undefined });
    expect(received).toContainEqual({ tenantId: 'b', kind: 'agent', userId: undefined });
  });

  it('cleans up timers on module destroy', () => {
    const received: IngestEvent[] = [];
    service.forTenant('tenant-1').subscribe({
      next: (e) => received.push(e),
      complete: () => received.push({ tenantId: 'COMPLETE', kind: 'message' }),
    });

    service.emit('tenant-1');
    service.onModuleDestroy();
    jest.advanceTimersByTime(2000);

    expect(received).toEqual([{ tenantId: 'COMPLETE', kind: 'message' }]);
  });
});

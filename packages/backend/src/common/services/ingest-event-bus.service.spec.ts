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

  it('emits to the correct user after debounce', () => {
    const received: IngestEvent[] = [];
    service.forUser('user-1').subscribe((e) => received.push(e));

    service.emit('user-1');
    expect(received).toHaveLength(0);

    jest.advanceTimersByTime(250);
    expect(received).toEqual([{ userId: 'user-1', kind: 'message' }]);
  });

  it('debounces rapid emissions for the same user/kind', () => {
    const received: IngestEvent[] = [];
    service.forUser('user-1').subscribe((e) => received.push(e));

    service.emit('user-1');
    jest.advanceTimersByTime(100);
    service.emit('user-1');
    jest.advanceTimersByTime(100);
    service.emit('user-1');
    jest.advanceTimersByTime(100);

    expect(received).toHaveLength(0);

    jest.advanceTimersByTime(150);
    expect(received).toEqual([{ userId: 'user-1', kind: 'message' }]);
  });

  it('different kinds for the same user fire independently', () => {
    const received: IngestEvent[] = [];
    service.forUser('user-1').subscribe((e) => received.push(e));

    service.emit('user-1', 'message');
    service.emit('user-1', 'agent');
    jest.advanceTimersByTime(250);

    expect(received).toEqual([
      { userId: 'user-1', kind: 'message' },
      { userId: 'user-1', kind: 'agent' },
    ]);
  });

  it('does not deliver events for other users', () => {
    const received: IngestEvent[] = [];
    service.forUser('user-1').subscribe((e) => received.push(e));

    service.emit('user-2');
    jest.advanceTimersByTime(250);

    expect(received).toHaveLength(0);
  });

  it('emits independently for different users', () => {
    const user1: IngestEvent[] = [];
    const user2: IngestEvent[] = [];
    service.forUser('user-1').subscribe((e) => user1.push(e));
    service.forUser('user-2').subscribe((e) => user2.push(e));

    service.emit('user-1');
    service.emit('user-2', 'routing');
    jest.advanceTimersByTime(250);

    expect(user1).toEqual([{ userId: 'user-1', kind: 'message' }]);
    expect(user2).toEqual([{ userId: 'user-2', kind: 'routing' }]);
  });

  it('all() observes every event regardless of user', () => {
    const received: IngestEvent[] = [];
    service.all().subscribe((e) => received.push(e));

    service.emit('a');
    service.emit('b', 'agent');
    jest.advanceTimersByTime(250);

    expect(received).toHaveLength(2);
    expect(received).toContainEqual({ userId: 'a', kind: 'message' });
    expect(received).toContainEqual({ userId: 'b', kind: 'agent' });
  });

  it('cleans up timers on module destroy', () => {
    const received: IngestEvent[] = [];
    service.forUser('user-1').subscribe({
      next: (e) => received.push(e),
      complete: () => received.push({ userId: 'COMPLETE', kind: 'message' }),
    });

    service.emit('user-1');
    service.onModuleDestroy();
    jest.advanceTimersByTime(2000);

    expect(received).toEqual([{ userId: 'COMPLETE', kind: 'message' }]);
  });
});

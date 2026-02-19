import { IngestEventBusService } from './ingest-event-bus.service';

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
    const received: string[] = [];
    service.forUser('user-1').subscribe((id) => received.push(id));

    service.emit('user-1');
    expect(received).toHaveLength(0);

    jest.advanceTimersByTime(1000);
    expect(received).toEqual(['user-1']);
  });

  it('debounces rapid emissions for the same user', () => {
    const received: string[] = [];
    service.forUser('user-1').subscribe((id) => received.push(id));

    service.emit('user-1');
    jest.advanceTimersByTime(500);
    service.emit('user-1');
    jest.advanceTimersByTime(500);
    service.emit('user-1');
    jest.advanceTimersByTime(500);

    expect(received).toHaveLength(0);

    jest.advanceTimersByTime(500);
    expect(received).toEqual(['user-1']);
  });

  it('does not deliver events for other users', () => {
    const received: string[] = [];
    service.forUser('user-1').subscribe((id) => received.push(id));

    service.emit('user-2');
    jest.advanceTimersByTime(1000);

    expect(received).toHaveLength(0);
  });

  it('emits independently for different users', () => {
    const user1: string[] = [];
    const user2: string[] = [];
    service.forUser('user-1').subscribe((id) => user1.push(id));
    service.forUser('user-2').subscribe((id) => user2.push(id));

    service.emit('user-1');
    service.emit('user-2');
    jest.advanceTimersByTime(1000);

    expect(user1).toEqual(['user-1']);
    expect(user2).toEqual(['user-2']);
  });

  it('cleans up timers on module destroy', () => {
    const received: string[] = [];
    service.forUser('user-1').subscribe({
      next: (id) => received.push(id),
      complete: () => received.push('COMPLETE'),
    });

    service.emit('user-1');
    service.onModuleDestroy();
    jest.advanceTimersByTime(2000);

    expect(received).toEqual(['COMPLETE']);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { Subject, EMPTY } from 'rxjs';
import { SseController } from './sse.controller';
import { IngestEventBusService, IngestEvent } from '../common/services/ingest-event-bus.service';

describe('SseController', () => {
  let controller: SseController;
  let mockSubject: Subject<IngestEvent>;
  let forTenant: jest.Mock;

  beforeEach(async () => {
    mockSubject = new Subject<IngestEvent>();
    // forTenant returns the live stream for a known tenant, and an empty
    // observable for the null (no-tenant-yet) case — mirroring the bus.
    forTenant = jest
      .fn()
      .mockImplementation((tenantId: string | null) =>
        tenantId === null ? EMPTY : mockSubject.asObservable(),
      );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SseController],
      providers: [{ provide: IngestEventBusService, useValue: { forTenant } }],
    }).compile();

    controller = module.get<SseController>(SseController);
  });

  it('subscribes to the bus scoped to the request tenant', () => {
    controller.events({ tenantId: 'tenant-1', userId: 'user-1' });
    expect(forTenant).toHaveBeenCalledWith('tenant-1');
  });

  it('returns an empty stream for a null tenantId (fresh account)', (done) => {
    const stream$ = controller.events({ tenantId: null, userId: 'user-1' });
    let emitted = false;
    stream$.subscribe({
      next: () => {
        emitted = true;
      },
      complete: () => {
        expect(emitted).toBe(false);
        done();
      },
    });
  });

  it('fans each bus event into a typed event and a legacy ping', (done) => {
    const stream$ = controller.events({ tenantId: 'tenant-1', userId: 'user-1' });
    const received: unknown[] = [];

    stream$.subscribe({
      next: (event) => {
        received.push(event);
        if (received.length === 6) {
          expect(received).toEqual([
            { type: 'message', data: 'message' },
            { type: 'ping', data: 'ping' },
            { type: 'agent', data: 'agent' },
            { type: 'ping', data: 'ping' },
            { type: 'routing', data: 'routing' },
            { type: 'ping', data: 'ping' },
          ]);
          done();
        }
      },
    });

    mockSubject.next({ tenantId: 'tenant-1', kind: 'message' });
    mockSubject.next({ tenantId: 'tenant-1', kind: 'agent' });
    mockSubject.next({ tenantId: 'tenant-1', kind: 'routing' });
  });
});

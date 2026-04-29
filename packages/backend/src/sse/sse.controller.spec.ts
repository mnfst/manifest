import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { SseController } from './sse.controller';
import { IngestEventBusService, IngestEvent } from '../common/services/ingest-event-bus.service';

describe('SseController', () => {
  let controller: SseController;
  let mockSubject: Subject<IngestEvent>;

  beforeEach(async () => {
    mockSubject = new Subject<IngestEvent>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SseController],
      providers: [
        {
          provide: IngestEventBusService,
          useValue: { forUser: jest.fn().mockReturnValue(mockSubject.asObservable()) },
        },
      ],
    }).compile();

    controller = module.get<SseController>(SseController);
  });

  it('throws UnauthorizedException when user is null', () => {
    expect(() => controller.events(null as never)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when user has no id', () => {
    expect(() => controller.events({} as never)).toThrow(UnauthorizedException);
  });

  it('fans each bus event into a typed event and a legacy ping', (done) => {
    const user = { id: 'user-1', name: 'Test', email: 'test@test.com' } as never;
    const stream$ = controller.events(user);
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

    mockSubject.next({ userId: 'user-1', kind: 'message' });
    mockSubject.next({ userId: 'user-1', kind: 'agent' });
    mockSubject.next({ userId: 'user-1', kind: 'routing' });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { SseController } from './sse.controller';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';

describe('SseController', () => {
  let controller: SseController;
  let mockSubject: Subject<string>;

  beforeEach(async () => {
    mockSubject = new Subject<string>();

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

  it('returns an observable that maps to ping events', (done) => {
    const user = { id: 'user-1', name: 'Test', email: 'test@test.com' } as never;
    const stream$ = controller.events(user);
    const received: unknown[] = [];

    stream$.subscribe({
      next: (event) => {
        received.push(event);
        if (received.length === 2) {
          expect(received).toEqual([
            { type: 'ping', data: 'ping' },
            { type: 'ping', data: 'ping' },
          ]);
          done();
        }
      },
    });

    mockSubject.next('user-1');
    mockSubject.next('user-1');
  });
});

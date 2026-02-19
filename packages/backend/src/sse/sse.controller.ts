import { Controller, Sse, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CurrentUser } from '../auth/current-user.decorator';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';
import { AuthUser } from '../auth/auth.instance';

interface MessageEvent {
  data: string;
  type: string;
}

@Controller('api/v1')
export class SseController {
  constructor(private readonly eventBus: IngestEventBusService) {}

  @Sse('events')
  events(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    if (!user?.id) {
      throw new UnauthorizedException('Session required for SSE');
    }

    return this.eventBus.forUser(user.id).pipe(
      map(() => ({ type: 'ping', data: 'ping' })),
    );
  }
}

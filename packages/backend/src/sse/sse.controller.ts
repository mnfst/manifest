import { Controller, Sse, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
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

    // Each bus event fans out as TWO SSE messages: the typed one (so new
    // clients can target by kind) AND the legacy 'ping' (so older frontends
    // listening on 'ping' still see every change during a partial upgrade).
    return this.eventBus.forUser(user.id).pipe(
      mergeMap((evt) => [
        { type: evt.kind, data: evt.kind },
        { type: 'ping', data: 'ping' },
      ]),
    );
  }
}

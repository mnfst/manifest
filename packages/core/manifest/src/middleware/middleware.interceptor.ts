import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable, tap } from 'rxjs'
import { EventService } from '../event/event.service'
import { CrudEventName, EntityManifest } from '../../../types/src'
import { CollectionController } from '../crud/controllers/collection.controller'
import { SingleController } from '../crud/controllers/single.controller'
import { EntityManifestService } from '../manifest/services/entity-manifest.service'
import { HandlerService } from '../handler/handler.service'

@Injectable()
export class MiddlewareInterceptor implements NestInterceptor {
  constructor(
    private readonly eventService: EventService,
    private readonly entityManifestService: EntityManifestService,
    private readonly handlerService: HandlerService
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<unknown>> {
    let entityManifest: EntityManifest

    const beforeRequestEvent: CrudEventName =
      this.eventService.getRelatedCrudEvent(
        context.getHandler().name as
          | keyof CollectionController
          | keyof SingleController,
        'before'
      )

    const afterRequestEvent: CrudEventName =
      this.eventService.getRelatedCrudEvent(
        context.getHandler().name as
          | keyof CollectionController
          | keyof SingleController,
        'after'
      )

    if (beforeRequestEvent || afterRequestEvent) {
      entityManifest = this.entityManifestService.getEntityManifest({
        slug: context.getArgs()[0].params.entity
      })
    }

    if (beforeRequestEvent) {
      for (const middleware of entityManifest.middlewares[beforeRequestEvent] ||
        []) {
        await this.handlerService.trigger({
          path: middleware.handler,
          req: context.switchToHttp().getRequest(),
          res: context.switchToHttp().getResponse()
        })
      }
    }

    return next.handle().pipe(
      tap(async () => {
        if (afterRequestEvent) {
          for (const middleware of entityManifest.middlewares[
            afterRequestEvent
          ] || []) {
            await this.handlerService.trigger({
              path: middleware.handler,
              req: context.switchToHttp().getRequest(),
              res: context.switchToHttp().getResponse()
            })
          }
        }
      })
    )
  }
}

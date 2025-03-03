import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable, forkJoin, lastValueFrom, tap } from 'rxjs'
import { EntityManifest, CrudEventName, HookManifest } from '@repo/types'
import { EntityManifestService } from '../manifest/services/entity-manifest.service'
import { HookService } from './hook.service'
import { SingleController } from '../crud/controllers/single.controller'
import { CollectionController } from '../crud/controllers/collection.controller'
import { EventService } from '../event/event.service'

@Injectable()
export class HookInterceptor implements NestInterceptor {
  constructor(
    private readonly entityManifestService: EntityManifestService,
    private readonly hookService: HookService,
    private readonly eventService: EventService
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
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
      // Trigger hooks.
      if (entityManifest.hooks?.[beforeRequestEvent]?.length) {
        const request = context.switchToHttp().getRequest()
        const entitySlug: string = request.params.entity
        const id: string = request.params.id
        let payload: object = request.body

        // On "delete" event, there is no payload so we get the id from the request to pass it to the hook.
        if (!payload && id) {
          payload = { id }
        }

        await lastValueFrom(
          forkJoin(
            (entityManifest.hooks?.[beforeRequestEvent] || []).map(
              (hook: HookManifest) =>
                this.hookService.triggerWebhook(hook, entitySlug, payload)
            )
          )
        )
      }
    }

    return next.handle().pipe(
      tap(async (data) => {
        // Get related "after" hook event.

        if (afterRequestEvent) {
          // Trigger hooks.
          if (entityManifest.hooks?.[afterRequestEvent]?.length) {
            const request = context.switchToHttp().getRequest()
            const entitySlug: string = request.params.entity

            await lastValueFrom(
              forkJoin(
                (entityManifest.hooks?.[afterRequestEvent] || []).map(
                  (hook: HookManifest) =>
                    this.hookService.triggerWebhook(hook, entitySlug, data)
                )
              )
            )
          }
        }
      })
    )
  }
}

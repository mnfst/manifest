import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable, forkJoin, lastValueFrom, tap } from 'rxjs'
import { crudEvents } from '../crud/crud-events'
import { EntityManifest, CrudEventName, HookManifest } from '@repo/types'
import { EntityManifestService } from '../manifest/services/entity-manifest.service'
import { HookService } from './hook.service'
import { SingleController } from '../crud/controllers/single.controller'
import { CollectionController } from '../crud/controllers/collection.controller'

@Injectable()
export class HookInterceptor implements NestInterceptor {
  constructor(
    private readonly entityManifestService: EntityManifestService,
    private readonly hookService: HookService
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    // Get related "before" hook event.
    const functionCalled: keyof CollectionController | keyof SingleController =
      context.getHandler().name as
        | keyof CollectionController
        | keyof SingleController

    const event: CrudEventName = crudEvents.find(
      (event) =>
        event.relatedFunctions.includes(functionCalled) &&
        event.moment === 'before'
    )?.name

    if (event) {
      const request = context.switchToHttp().getRequest()
      const entitySlug: string = request.params.entity
      const id: string = request.params.id
      let payload: object = request.body

      // On "delete" event, there is no payload so we get the id from the request to pass it to the hook.
      if (!payload && id) {
        payload = { id }
      }

      const entityManifest: EntityManifest =
        this.entityManifestService.getEntityManifest({
          slug: context.getArgs()[0].params.entity
        })

      // Trigger hooks.
      if (entityManifest.hooks[event].length) {
        await lastValueFrom(
          forkJoin(
            entityManifest.hooks[event].map((hook: HookManifest) =>
              this.hookService.triggerWebhook(hook, entitySlug, payload)
            )
          )
        )
      }
    }

    return next.handle().pipe(
      tap(async (data) => {
        // Get related "after" hook event.
        const event: CrudEventName = crudEvents.find(
          (event) =>
            event.relatedFunctions.includes(functionCalled) &&
            event.moment === 'after'
        )?.name

        if (event) {
          const request = context.switchToHttp().getRequest()
          const entitySlug: string = request.params.entity

          const entityManifest: EntityManifest =
            this.entityManifestService.getEntityManifest({
              slug: context.getArgs()[0].params.entity
            })

          // Trigger hooks.
          if (entityManifest.hooks[event].length) {
            await lastValueFrom(
              forkJoin(
                entityManifest.hooks[event].map((hook: HookManifest) =>
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

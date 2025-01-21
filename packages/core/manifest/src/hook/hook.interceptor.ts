import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable, tap } from 'rxjs'
import { hookEvents } from './hook-events'
import { EntityManifest } from '@repo/types'
import { EntityManifestService } from '../manifest/services/entity-manifest.service'

@Injectable()
export class HookInterceptor implements NestInterceptor {
  constructor(private readonly entityManifestService: EntityManifestService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const eventName: string = hookEvents.find(
      (event) =>
        event.relatedFunction === context.getHandler().name &&
        event.moment === 'before'
    )?.name

    if (eventName) {
      console.log(eventName)

      const request = context.switchToHttp().getRequest()
      const entitySlug: string = request.params.entity

      const entityManifest: EntityManifest =
        this.entityManifestService.getEntityManifest({
          slug: context.getArgs()[0].params.entity
        })

      // Get related webhooks.
      console.log(entityManifest.hooks.beforeCreate)

      // Trigger sequentially.
    }

    return next.handle().pipe(
      tap(() => {
        const eventName: string = hookEvents.find(
          (event) =>
            event.relatedFunction === context.getHandler().name &&
            event.moment === 'after'
        )?.name

        if (eventName) {
          console.log(eventName)
        }
      })
    )
  }
}

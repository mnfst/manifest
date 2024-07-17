import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { Rule } from '../types/rule.type'
import { ManifestService } from '../../manifest/services/manifest.service'
import { EntityManifest } from '@mnfst/types'

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly manifestService: ManifestService
  ) {}

  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const rule: Rule = this.reflector.get<Rule>('rule', context.getHandler())

    if (!rule) {
      return true
    }

    const entitySlug: string = context.getArgs()[0].params.entity
    const entityManifest: EntityManifest =
      this.manifestService.getEntityManifest({ slug: entitySlug })

    // TODO: Get the policy from the entity.

    // TODO: Check if user matches the policy

    return true
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Rule } from '../types/rule.type'
import { ManifestService } from '../../manifest/services/manifest.service'
import { EntityManifest, PolicyManifest } from '@mnfst/types'
import { AuthService } from '../auth.service'
import { Request } from 'express'

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly manifestService: ManifestService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule: Rule = this.reflector.get<Rule>('rule', context.getHandler())

    if (!rule) {
      return true
    }

    const entitySlug: string = context.getArgs()[0].params.entity
    const entityManifest: EntityManifest =
      this.manifestService.getEntityManifest({ slug: entitySlug })

    console.log(entityManifest.className, entityManifest.policies)

    const policies: PolicyManifest[] = entityManifest.policies[rule]

    console.log(policies)

    const req: Request = context.switchToHttp().getRequest()
    const { user, entitySlug: userEntitySlug }: any =
      await this.authService.getUserFromRequest(req)

    console.log(user, userEntitySlug)

    // TODO: Check if user matches the policy

    return true
  }
}

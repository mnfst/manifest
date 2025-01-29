import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Rule } from './types/rule.type'
import { EntityManifest, PolicyManifest } from '@repo/types'
import { AuthService } from '../auth/auth.service'
import { Request } from 'express'
import { EntityManifestService } from '../manifest/services/entity-manifest.service'
import { policies } from './policies'

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entityManifestService: EntityManifestService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule: Rule = this.reflector.get<Rule>('rule', context.getHandler())

    if (!rule) {
      return true
    }

    const req: Request = context.switchToHttp().getRequest()

    let routePolicies: PolicyManifest[]

    if (rule === 'dynamic-endpoint') {
      routePolicies = req['endpoint'].policies
    } else {
      routePolicies = await this.getCrudPolicies(
        rule,
        context.getArgs()[0].params.entity
      )
    }

    const { user, entitySlug: userEntitySlug }: any =
      (await this.authService.getUserFromRequest(req)) || {}

    let userEntityManifest: EntityManifest
    if (userEntitySlug) {
      userEntityManifest = this.entityManifestService.getEntityManifest({
        slug: userEntitySlug
      })
    } else {
      userEntityManifest = null
    }

    return routePolicies.every((policy: PolicyManifest) => {
      const policyFn = policies[policy.access]

      // Execute the policy function that returns a boolean.
      return policyFn(user, userEntityManifest, { allow: policy.allow })
    })
  }

  /**
   * Retrieves the policies for a CRUD operation.
   *
   * @param rule The rule to retrieve the policies for (e.g. 'read', 'create', 'update', 'delete', 'signup').
   * @param entitySlug The entity slug to retrieve the policies for.
   *
   * @returns The policies for the CRUD operation.
   */
  private async getCrudPolicies(
    rule: Rule,
    entitySlug: string
  ): Promise<PolicyManifest[]> {
    const entityManifest: EntityManifest =
      this.entityManifestService.getEntityManifest({ slug: entitySlug })

    return entityManifest.policies[rule]
  }
}

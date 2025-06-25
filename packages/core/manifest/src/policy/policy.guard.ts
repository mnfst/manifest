import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Rule } from './types/rule.type'
import { EntityManifest, PolicyManifest } from '@repo/types'
import { AuthService } from '../auth/auth.service'
import { Request } from 'express'
import { EntityManifestService } from '../manifest/services/entity-manifest.service'
import { policies } from './policies'
import { EntityService } from '../entity/services/entity.service'

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entityManifestService: EntityManifestService,
    private readonly entityService: EntityService,
    private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule: Rule = this.reflector.get<Rule>('rule', context.getHandler())

    if (!rule) {
      return true
    }

    const request: Request = context.switchToHttp().getRequest()

    let routePolicies: PolicyManifest[]
    let entityManifest: EntityManifest

    if (rule === 'dynamic-endpoint') {
      routePolicies = request['endpoint']?.policies || []
    } else {
      routePolicies = await this.getCrudPolicies(
        rule,
        context.getArgs()[0].params.entity
      )
      entityManifest = this.entityManifestService.getEntityManifest({
        slug: context.getArgs()[0].params.entity
      })
    }

    const { user, entitySlug: userEntitySlug } =
      (await this.authService.getUserFromRequest(request)) || {}

    let userEntityManifest: EntityManifest

    if (userEntitySlug) {
      userEntityManifest = this.entityManifestService.getEntityManifest({
        slug: userEntitySlug
      })
    } else {
      userEntityManifest = null
    }

    return Promise.all(
      routePolicies.map((policy: PolicyManifest) => {
        const policyFn = policies[policy.access]

        return policyFn({
          entityManifest,
          entityRepository: entityManifest
            ? this.entityService.getEntityRepository({
                entitySlug: entityManifest.slug
              })
            : null,
          user,
          userEntityManifest,
          rule,
          request,
          options: {
            allow: policy.allow,
            condition: policy.condition
          }
        })
      })
    )
      .then((results: boolean[]) => {
        // Check if all policies return true
        return results.every((result) => result === true)
      })
      .catch(() => {
        // If any policy fails, deny access
        return false
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

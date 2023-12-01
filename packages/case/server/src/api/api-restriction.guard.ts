import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { EntityDefinition } from '../../../shared/interfaces/entity-definition.interface'
import { RestrictionRule } from '../../../shared/types/restriction-rule.type'
import { AuthService } from '../auth/auth.service'
import { AuthenticableEntity } from '../core-entities/authenticable-entity'
import { EntityMetaService } from '../crud/services/entity-meta.service'

@Injectable()
export class ApiRestrictionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly entityMetaService: EntityMetaService,
    private readonly authService: AuthService
  ) {}

  /**
   * Checks if the user has the required permission to access the endpoint.
   *
   * @param context
   * @returns {Promise<boolean>}
   **/
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const restrictionRule: RestrictionRule =
      this.reflector.get<RestrictionRule>(
        'restrictionRule',
        context.getHandler()
      )

    // If the endpoint doesn't have a restriction rule, it is public.
    if (!restrictionRule) {
      return true
    }

    // Get endpoint policy based on EntityDefinition.
    const entitySlug = context.getArgs()[0].params?.entity
    const entityDefinition: EntityDefinition =
      this.entityMetaService.getEntityDefinition(entitySlug)
    const policy: (user: AuthenticableEntity) => boolean =
      entityDefinition.apiPolicies[restrictionRule]

    // Get the user that is trying to access the endpoint.
    const req: Request = context.switchToHttp().getRequest()
    const user: AuthenticableEntity = await this.authService.getUserFromToken(
      req.headers?.['authorization']
    )

    return policy(user)
  }
}

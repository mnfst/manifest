import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { EntityDefinition } from '../../../shared/interfaces/entity-definition.interface'
import { RestrictionRule } from '../../../shared/types/restriction-rule.type'
import { EntityMetaService } from '../crud/services/entity-meta.service'

@Injectable()
export class ApiRestrictionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly entityMetaService: EntityMetaService
  ) {}

  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const restrictionRule: RestrictionRule =
      this.reflector.get<RestrictionRule>(
        'restrictionRule',
        context.getHandler()
      )

    if (!restrictionRule) {
      return true
    }

    const entitySlug = context.getArgs()[0].params?.entity
    const entityDefinition: EntityDefinition =
      this.entityMetaService.getEntityDefinition(entitySlug)

    const policy: () => Promise<boolean> =
      entityDefinition.apiPolicies[restrictionRule]

    return policy()
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { RestrictionRule } from '../../../shared/types/restriction-rule.type'
import { AuthService } from './auth.service'

@Injectable()
export class ApiRestrictionGuard implements CanActivate {
  constructor(private reflector: Reflector, private authService: AuthService) {}

  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const restrictionRule: RestrictionRule =
      this.reflector.get<RestrictionRule>(
        'restrictionRule',
        context.getHandler()
      )

    // TODO: Get Restriction from entity meta and check if user has access to this entity.

    return true
  }
}

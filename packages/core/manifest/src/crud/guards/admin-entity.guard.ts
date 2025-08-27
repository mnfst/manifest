import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException
} from '@nestjs/common'
import { AuthService } from '../../auth/auth.service'
import { AdminEntity } from '@repo/types'
import { Request } from 'express'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'

/**
 * Guard that checks if the user is a dev admin when accessing the admin entity.
 */
@Injectable()
export class AdminEntityGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const entitySlug = request.params.entity

    // Only apply this guard logic if the entity is the admin entity
    if (entitySlug === ADMIN_ENTITY_MANIFEST.slug) {
      const { user }: { user: AdminEntity; entitySlug: string } =
        (await this.authService.getUserFromRequest(request)) as {
          user: AdminEntity
          entitySlug: string
        }

      const hasDevAccess =
        !!user &&
        entitySlug === ADMIN_ENTITY_MANIFEST.slug &&
        user.hasDeveloperPanelAccess

      if (!hasDevAccess) {
        throw new ForbiddenException(
          'You do not have the required permissions to access this resource.'
        )
      }
    }

    return true
  }
}

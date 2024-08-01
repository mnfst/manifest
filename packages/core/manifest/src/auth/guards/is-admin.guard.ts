import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AuthService } from '../auth.service'
import { AuthenticableEntity } from '@mnfst/types'
import { Request } from 'express'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'

/**
 * Guard that checks if the user is an admin.
 */
@Injectable()
export class IsAdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest()

    const {
      user,
      entitySlug
    }: { user: AuthenticableEntity; entitySlug: string } =
      await this.authService.getUserFromRequest(req)

    return !!user && entitySlug === ADMIN_ENTITY_MANIFEST.slug
  }
}

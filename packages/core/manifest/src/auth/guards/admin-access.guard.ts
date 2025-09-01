import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AdminAccess } from '../../../../types/src/auth/admin-access.type'
import { Reflector } from '@nestjs/core'
import { AdminEntity } from '../../../../types/src'
import { AuthService } from '../auth.service'
import { Request } from 'express'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'

@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const access: AdminAccess = this.reflector.get<AdminAccess>(
      'adminAccess',
      context.getHandler()
    )

    if (!access) {
      return false
    }

    const req: Request = context.switchToHttp().getRequest()

    const { user, entitySlug }: { user: AdminEntity; entitySlug: string } =
      (await this.authService.getUserFromRequest(req)) as {
        user: AdminEntity
        entitySlug: string
      }

    return !!user && entitySlug === ADMIN_ENTITY_MANIFEST.slug && user[access]
  }
}

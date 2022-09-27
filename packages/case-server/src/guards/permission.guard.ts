import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthService } from '../auth/auth.service'
import { CaseUser } from '../resources/interfaces/case-user.interface'

// We are using BREAD (Browse, Read, Edit, Add, Delete) style for Permissions inspired by Laravel Voyager
// https://voyager-docs.devdojo.com/core-concepts/roles-and-permissions
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    @Inject('REFLECTOR') private reflector: Reflector,
    private authService: AuthService
  ) {}

  // Checks if Request User has Permission. If array passed as param, User only needs to have one of those Permissions.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    let permissions: string | string[] = this.reflector.get<string | string[]>(
      'permission',
      context.getHandler()
    )

    if (!permissions) {
      return true
    }

    if (typeof permissions === 'string') {
      permissions = [permissions]
    }

    const req = context.switchToHttp().getRequest()
    const user: CaseUser = await this.authService.getUserFromToken(req)

    const hasPermission = () =>
      (permissions as string[]).some((permission: string) =>
        user.role.permissions.some(
          (userPermission) => userPermission.name === permission
        )
      )

    return user && user.role && hasPermission()
  }
}

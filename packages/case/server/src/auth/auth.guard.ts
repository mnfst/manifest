import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { User } from '../_contribution-root/entities/user.entity'
import { AuthService } from '../auth/auth.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()

    // TODO: User or Admin ?
    const user: User = await this.authService.getUserFromToken(
      req.headers?.authorization
    )

    return !!user
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import { User } from '../core-entities/user.entity'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const user: User = await this.authService.getUserFromToken(
      req.headers?.authorization
    )

    console.log('user', user, req.headers?.authorization)

    return !!user
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import { CaseUser } from '../resources/interfaces/case-user.interface'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const user: CaseUser = await this.authService.getUserFromToken(req)

    // Return true is user is authenticated.
    return !!user
  }
}

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { AuthService } from '../auth/auth.service'
import { User } from '../core-entities/user.entity'

/**
 * Guard for handling authentication
 * @class AuthGuard
 * @implements {CanActivate}
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /**
  * Constructor for the AuthGuard class
  * @param {AuthService} authService - Service for handling authentication
  */
  constructor(private readonly authService: AuthService) { }


  /**
   * Determines whether a user can activate a route
   * @param {ExecutionContext} context - The execution context
   * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether the user can activate the route
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const user: User = await this.authService.getUserFromToken(
      req.headers?.authorization
    )

    return !!user
  }
}

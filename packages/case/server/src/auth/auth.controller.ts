import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { Request } from 'express'

import { User } from '../core-entities/user.entity'
import { AuthService } from './auth.service'

/**
 * Controller for handling authentication
 * @class AuthController
 */
@Controller('auth')
export class AuthController {
  /**
   * Constructor for the AuthController class
   * @param {AuthService} authService - Service for handling authentication
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint to get a token for a user
   * @param {string} email - The email of the user
   * @param {string} password - The password of the user
   * @returns {Promise<{ token: string }>} A promise that resolves to an object containing the token
   */
  @Post('login')
  public async getToken(
    @Body('email') email: string,
    @Body('password') password: string
  ): Promise<{
    token: string
  }> {
    return this.authService.createToken(email, password)
  }

  /**
   * Endpoint to get the current user
   * @param {Request} req - The request object
   * @returns {Promise<User>} A promise that resolves to the current user
   */
  @Get('me')
  public async getCurrentUser(@Req() req: Request): Promise<User> {
    return this.authService.getUserFromToken(req.headers?.authorization)
  }
}

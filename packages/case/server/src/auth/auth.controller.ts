import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { Request } from 'express'

import { User } from '../core-entities/user.entity'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  public async getToken(
    @Body('email') email: string,
    @Body('password') password: string
  ): Promise<{
    token: string
  }> {
    return this.authService.createToken(email, password)
  }

  @Get('me')
  public async getCurrentUser(@Req() req: Request): Promise<User> {
    return this.authService.getUserFromToken(req.headers?.authorization)
  }
}

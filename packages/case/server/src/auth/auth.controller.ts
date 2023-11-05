import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { Request } from 'express'

import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { User } from '../_contribution-root/entities/user.entity'
import { AuthService } from './auth.service'

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login',
    description: 'Get a JWT token to connect to the API.'
  })
  @ApiQuery({
    name: 'email',
    description: 'User email',
    example: 'admin@case.app'
  })
  @ApiQuery({
    name: 'password',
    description: 'User password',
    example: 'case'
  })
  public async getToken(
    @Body('email') email: string,
    @Body('password') password: string
  ): Promise<{
    token: string
  }> {
    return this.authService.createToken(email, password)
  }

  @Get('me')
  @ApiOperation({
    summary: 'Get the current user'
  })
  @ApiBearerAuth('JWT')
  public async getCurrentUser(@Req() req: Request): Promise<User> {
    return this.authService.getAdminFromToken(req.headers?.authorization)
  }
}

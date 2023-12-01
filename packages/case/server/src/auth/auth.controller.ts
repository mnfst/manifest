import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common'
import { Request } from 'express'

import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'

import { AuthenticableEntity } from '../core-entities/authenticable-entity'
import { AuthService } from './auth.service'
import { SignupUserDto } from './dto/signup-user.dto'

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(':authenticableEntity/login')
  @ApiOperation({
    summary: 'Login',
    description: 'Get a JWT token to connect to the API.'
  })
  @ApiBody({
    type: SignupUserDto,
    description: 'User credentials'
  })
  public async getToken(
    @Param('authenticableEntity') authenticableEntity: string,
    @Body() signupUserDto: SignupUserDto
  ): Promise<{
    token: string
  }> {
    return this.authService.createToken(authenticableEntity, signupUserDto)
  }

  @Post(':authenticableEntity/signup')
  @ApiOperation({
    summary: 'Sign up',
    description: 'Create a new user.'
  })
  @ApiBody({
    type: SignupUserDto,
    description: 'User credentials'
  })
  public async signUp(
    @Param('authenticableEntity') authenticableEntity: string,
    @Body() signupUserDto: SignupUserDto
  ): Promise<{
    token: string
  }> {
    return this.authService.signUp(authenticableEntity, signupUserDto)
  }

  @Get(':authenticableEntity/me')
  @ApiOperation({
    summary: 'Get the current user'
  })
  @ApiBearerAuth('JWT')
  public async getCurrentUser(
    @Param('authenticableEntity') authenticableEntity: string,
    @Req() req: Request
  ): Promise<AuthenticableEntity> {
    return this.authService.getUserFromToken(
      req.headers?.authorization,
      authenticableEntity
    )
  }
}

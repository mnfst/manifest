import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common'

import { AuthenticableEntity } from '@mnfst/types'
import { Request } from 'express'
import { AuthService } from './auth.service'
import { SignupAuthenticableEntityDto } from './dtos/signup-authenticable-entity.dto'
import { Rule } from './decorators/rule.decorator'
import { AuthorizationGuard } from './guards/authorization/authorization.guard'

@Controller('auth')
@UseGuards(AuthorizationGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(':authenticableEntity/login')
  public async getToken(
    @Param('authenticableEntity') authenticableEntity: string,
    @Body() signupUserDto: SignupAuthenticableEntityDto
  ): Promise<{
    token: string
  }> {
    return this.authService.createToken(authenticableEntity, signupUserDto)
  }

  @Rule('signup')
  @Post(':authenticableEntity/signup')
  public async signup(
    @Param('authenticableEntity') authenticableEntity: string,
    @Body() signupUserDto: SignupAuthenticableEntityDto
  ): Promise<{
    token: string
  }> {
    return this.authService.signup(authenticableEntity, signupUserDto)
  }

  @Rule('read')
  @Get(':authenticableEntity/me')
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

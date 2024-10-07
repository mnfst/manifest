import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common'

import { AuthenticableEntity } from '@repo/types'
import { Request } from 'express'
import { AuthService } from './auth.service'
import { SignupAuthenticableEntityDto } from './dtos/signup-authenticable-entity.dto'
import { Rule } from './decorators/rule.decorator'
import { AuthorizationGuard } from './guards/authorization.guard'

@Controller('auth')
@UseGuards(AuthorizationGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(':entity/login')
  public async getToken(
    @Param('entity') entity: string,
    @Body() signupUserDto: SignupAuthenticableEntityDto
  ): Promise<{
    token: string
  }> {
    return this.authService.createToken(entity, signupUserDto)
  }

  @Post(':entity/signup')
  @Rule('signup')
  public async signup(
    @Param('entity') entity: string,
    @Body() signupUserDto: SignupAuthenticableEntityDto
  ): Promise<{
    token: string
  }> {
    return this.authService.signup(entity, signupUserDto)
  }

  @Get(':entity/me')
  @Rule('read')
  public async getCurrentUser(
    @Param('entity') _entity: string,
    @Req() req: Request
  ): Promise<AuthenticableEntity> {
    return (await this.authService.getUserFromRequest(req)).user
  }

  @Get('admins/default-exists')
  public async isDefaultAdminExists(): Promise<{
    exists: boolean
  }> {
    return this.authService.isDefaultAdminExists()
  }
}

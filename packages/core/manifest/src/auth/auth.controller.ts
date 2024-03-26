import { Body, Controller, Param, Post } from '@nestjs/common'

import { AuthService } from './auth.service'
import { SignupAuthenticableEntityDto } from './dtos/signup-authenticable-entity.dto'

@Controller('auth')
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

  // @Post(':authenticableEntity/signup')
  // public async signUp(
  //   @Param('authenticableEntity') authenticableEntity: string,
  //   @Body() signupUserDto: SignupUserDto
  // ): Promise<{
  //   token: string
  // }> {
  //   return this.authService.signUp(authenticableEntity, signupUserDto)
  // }

  // @Get(':authenticableEntity/me')
  // public async getCurrentUser(
  //   @Param('authenticableEntity') authenticableEntity: string,
  //   @Req() req: Request
  // ): Promise<AuthenticableEntity> {
  //   return this.authService.getUserFromToken(
  //     req.headers?.authorization,
  //     authenticableEntity
  //   )
  // }
}

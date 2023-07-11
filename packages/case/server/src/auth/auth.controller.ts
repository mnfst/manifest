import { Body, Controller, Post } from '@nestjs/common'

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
}

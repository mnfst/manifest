import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Query,
  Req,
  Res
} from '@nestjs/common'
import { Request, Response } from 'express'

import { CaseUser } from '../resources/interfaces/case-user.interface'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  public async getToken(
    @Body('email') email,
    @Body('password') password,
    @Res() res: Response
  ): Promise<
    | {
        accessToken: string
        permissions: string[]
        roleName: string
        homepagePath: string
      }
    | Response<HttpException>
  > {
    return this.authService.createToken(email, password, res)
  }

  @Get('me')
  public async getCurrentUser(@Req() req: Request): Promise<CaseUser> {
    return this.authService.getUserFromToken(req)
  }

  @Get('forgot-password')
  public async forgotPassword(
    @Query('email') email: string,
    @Res() res: Response
  ): Promise<any> {
    return this.authService.sendResetPasswordEmail(email, res)
  }

  @Post('reset-password')
  public async resetPassword(
    @Body('newPassword') newPassword: string,
    @Body('token') token: string,
    @Res() res: Response
  ) {
    return this.authService.resetPassword(newPassword, token, res)
  }
}

import { HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SHA3 } from 'crypto-js'
import { StatusCodes } from 'http-status-codes'
import * as jwt from 'jsonwebtoken'
import { DataSource } from 'typeorm'

import { User } from '../_contribution-root/entities/user.entity'

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService
  ) {}

  async createToken(
    email: string,
    password: string
  ): Promise<{
    token: string
  }> {
    if (!email || !password) {
      throw new HttpException(
        'Email and password are required',
        StatusCodes.UNPROCESSABLE_ENTITY
      )
    }

    const user = await this.dataSource.getRepository(User).findOne({
      where: {
        email,
        password: SHA3(password).toString()
      }
    })

    if (!user) {
      throw new HttpException(
        'Invalid email or password',
        StatusCodes.UNAUTHORIZED
      )
    }

    return {
      token: jwt.sign({ email }, this.configService.get('JWT_SECRET'))
    }
  }

  async getUserFromToken(token: string): Promise<any> {
    return jwt.verify(
      token?.replace('Bearer ', ''),
      this.configService.get('JWT_SECRET'),
      async (_err, decoded: jwt.JwtPayload) => {
        if (decoded) {
          return this.dataSource.getRepository(User).findOne({
            where: {
              email: decoded.email
            }
          })
        }
        return null
      }
    )
  }
}

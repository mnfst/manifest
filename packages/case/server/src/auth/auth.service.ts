import { HttpException, Injectable } from '@nestjs/common'
import * as CryptoJs from 'crypto-js'
import { StatusCodes } from 'http-status-codes'
import * as jwt from 'jsonwebtoken'
import { DataSource } from 'typeorm'

import { User } from '../core-entities/user.entity'

@Injectable()
export class AuthService {
  constructor(private dataSource: DataSource) {}

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
        password: CryptoJs.SHA3(password).toString()
      }
    })
    if (!user) {
      throw new HttpException(
        'Invalid email or password',
        StatusCodes.UNAUTHORIZED
      )
    }

    return {
      token: jwt.sign({ email }, process.env.TOKEN_SECRET_KEY)
    }
  }
}

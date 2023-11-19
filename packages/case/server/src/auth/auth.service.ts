import { HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SHA3 } from 'crypto-js'
import { StatusCodes } from 'http-status-codes'
import * as jwt from 'jsonwebtoken'
import { DataSource } from 'typeorm'

import { User } from '../core-entities/user.entity'

/**
 * AuthService is a service that handles authentication related operations.
 * @class AuthService
 * @property {DataSource} dataSource - The data source to interact with the database.
 * @property {ConfigService} configService - The service to access the application configuration.
 * @method createToken - Creates a JWT token for a user.
 * @method getUserFromToken - Retrieves a user from a JWT token.
 */
@Injectable()
export class AuthService {
  /**
 * Constructs an instance of AuthService.
 * @param dataSource - The data source to interact with the database.
 * @param configService - The service to access the application configuration.
 */
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService
  ) { }
  /**
   * Creates a JWT token for a user.
   * @param email - The email of the user.
   * @param password - The password of the user.
   * @returns A promise that resolves to an object containing the JWT token.
   */
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
  /**
   * Retrieves a user from a JWT token.
   * @param token - The JWT token.
   * @returns A promise that resolves to the user object if the token is valid, null otherwise.
   */
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

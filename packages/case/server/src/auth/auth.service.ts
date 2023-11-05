import { HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SHA3 } from 'crypto-js'
import { StatusCodes } from 'http-status-codes'
import * as jwt from 'jsonwebtoken'
import { DataSource } from 'typeorm'

import { User } from '../_contribution-root/entities/user.entity'
import { Admin } from '../core-entities/admin.entity'
import { AuthenticableEntity } from '../core-entities/authenticable-entity'
import { EntityMetaService } from '../crud/services/entity-meta.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly entityMetaService: EntityMetaService
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

  getUserFromToken(
    token: string,
    entity?: typeof AuthenticableEntity
  ): Promise<any> {
    const authenticableEntities =
      this.entityMetaService.getAuthenticableEntities()

    // TODO: if no entity provided, search into all authenticable entities.

    console.log(
      'authenticableEntities',
      authenticableEntities.map((e) => e.name)
    )

    if (!token) {
      return null
    }

    const decoded: jwt.JwtPayload = jwt.verify(
      token?.replace('Bearer ', ''),
      this.configService.get('JWT_SECRET')
    ) as jwt.JwtPayload

    console.log('decoded', decoded)

    if (!decoded) {
      return null
    }

    return this.dataSource.getRepository(Admin).findOne({
      where: {
        email: decoded.email
      }
    })
  }

  async getAdminFromToken(token: string): Promise<Admin> {
    return this.getUserFromToken(token, Admin) as Promise<Admin>
  }
}

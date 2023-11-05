import { HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SHA3 } from 'crypto-js'
import { StatusCodes } from 'http-status-codes'
import * as jwt from 'jsonwebtoken'
import { DataSource, EntityMetadata, Repository } from 'typeorm'

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
    entitySlug: string,
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

    const entityRepository: Repository<AuthenticableEntity> =
      this.entityMetaService.getRepository(entitySlug)

    const user = await entityRepository.findOne({
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
   * Returns the user from a JWT token. This user can be of any entity that extends AuthenticableEntity.
   *
   * @param token JWT token
   * @param entitySlug Entity slug. If provided, the user will be searched only in this entity. If not provided, the user will be searched in all entities that extend AuthenticableEntity.
   *
   * @returns The user item from the JWT token
   *
   */
  async getUserFromToken(token: string, entitySlug?: string): Promise<any> {
    let decoded: jwt.JwtPayload

    try {
      decoded = jwt.verify(
        token?.replace('Bearer ', ''),
        this.configService.get('JWT_SECRET')
      ) as jwt.JwtPayload
    } catch (e) {
      return null
    }

    if (!decoded) {
      return null
    }

    if (entitySlug) {
      const entityRepository: Repository<AuthenticableEntity> =
        this.entityMetaService.getRepository(entitySlug)

      return entityRepository.findOne({
        where: {
          email: decoded.email
        }
      })
    } else {
      const authenticableEntities: EntityMetadata[] =
        this.entityMetaService.getAuthenticableEntities()

      for (const entity of authenticableEntities) {
        const user: AuthenticableEntity = await this.entityMetaService
          .getRepository(entity.targetName)
          .findOne({
            where: {
              email: decoded.email
            }
          })

        if (user) {
          return Promise.resolve(user)
        }
      }
    }
  }
}

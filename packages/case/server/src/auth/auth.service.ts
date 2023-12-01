import { HttpException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SHA3 } from 'crypto-js'
import { StatusCodes } from 'http-status-codes'
import * as jwt from 'jsonwebtoken'
import { EntityMetadata, Repository } from 'typeorm'

import { AuthenticableEntity } from '../core-entities/authenticable-entity'
import { EntityMetaService } from '../crud/services/entity-meta.service'
import { SignupUserDto } from './dto/signup-user.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly entityMetaService: EntityMetaService
  ) {}

  /**
   * Creates a JWT token for a user. This user can be of any entity that extends AuthenticableEntity.
   *
   * @param entitySlug The slug of the AuthenticableEntity where the user is going to be searched
   * @param email The email of the user
   * @param password The password of the user
   *
   * @returns A JWT token
   */
  async createToken(
    entitySlug: string,
    signupUserDto: SignupUserDto
  ): Promise<{
    token: string
  }> {
    const entityRepository: Repository<AuthenticableEntity> =
      this.entityMetaService.getRepository(entitySlug)

    const user = await entityRepository.findOne({
      where: {
        email: signupUserDto.email,
        password: SHA3(signupUserDto.password).toString()
      }
    })

    if (!user) {
      throw new HttpException(
        'Invalid email or password',
        StatusCodes.UNAUTHORIZED
      )
    }

    return {
      token: jwt.sign(
        { email: signupUserDto.email },
        this.configService.get('JWT_SECRET')
      )
    }
  }

  /**
   *
   * Sign up a user. This user can be of any entity that extends AuthenticableEntity but Admin.
   *
   * @param entitySlug The slug of the AuthenticableEntity where the user is going to be created
   * @param email The email of the user
   * @param password The password of the user
   *
   * @returns A JWT token of the created user
   *
   */
  async signUp(
    entitySlug: string,
    signupUserDto: SignupUserDto
  ): Promise<{ token: string }> {
    const repository: Repository<AuthenticableEntity> =
      this.entityMetaService.getRepository(entitySlug)

    if (
      !this.entityMetaService
        .getAuthenticableEntities()
        .filter((entity) => entity.targetName !== 'Admin')
        .find(
          (entity) =>
            entity.targetName ===
            this.entityMetaService.getEntityMetadata(entitySlug).targetName
        )
    ) {
      throw new HttpException(
        'You cannot sign up in this entity',
        StatusCodes.UNAUTHORIZED
      )
    }

    const user: AuthenticableEntity = await repository.save(
      repository.create(signupUserDto)
    )

    return this.createToken(entitySlug, {
      email: user.email,
      password: signupUserDto.password
    })
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

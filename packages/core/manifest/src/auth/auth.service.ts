import { AuthenticableEntity } from '@manifest-yml/types'
import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SHA3 } from 'crypto-js'
import { Request } from 'express'
import * as jwt from 'jsonwebtoken'
import { Repository } from 'typeorm'
import { EntityService } from '../entity/services/entity/entity.service'
import { SignupAuthenticableEntityDto } from './dtos/signup-authenticable-entity.dto'

// import { EntityMetaService } from '../crud/services/entity-meta.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly entityService: EntityService
  ) {}
  /**
   * Creates a JWT token for a user. This user can be of any entity that extends AuthenticableEntity.
   *
   * @param entitySlug The slug of the entity where the user is going to be searched
   * @param signupUserDto The DTO with the email and password of the user
   * @param email The email of the user
   * @param password The password of the user
   *
   * @returns A JWT token
   */
  async createToken(
    entitySlug: string,
    signupUserDto: SignupAuthenticableEntityDto
  ): Promise<{
    token: string
  }> {
    const entityRepository: Repository<AuthenticableEntity> =
      this.entityService.getEntityRepository({
        entitySlug
      }) as Repository<AuthenticableEntity>

    const user = await entityRepository.findOne({
      where: {
        email: signupUserDto.email,
        password: SHA3(signupUserDto.password).toString()
      }
    })
    if (!user) {
      throw new HttpException(
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED
      )
    }
    return {
      token: jwt.sign(
        { email: signupUserDto.email },
        this.configService.get('TOKEN_SECRET_KEY')
      )
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
  getUserFromToken(
    token: string,
    entitySlug?: string
  ): Promise<AuthenticableEntity> {
    let decoded: jwt.JwtPayload
    try {
      decoded = jwt.verify(
        token?.replace('Bearer ', ''),
        this.configService.get('TOKEN_SECRET_KEY')
      ) as jwt.JwtPayload
    } catch (e) {
      return null
    }
    if (!decoded) {
      return null
    }

    const entityRepository: Repository<AuthenticableEntity> =
      this.entityService.getEntityRepository({
        entitySlug
      }) as Repository<AuthenticableEntity>

    return entityRepository.findOne({
      where: {
        email: decoded.email
      }
    })
  }

  /**
   * Returns the user from a request. This user can be of any entity that extends AuthenticableEntity.
   *
   * @param req Request object
   *
   * @returns The user item from the request
   **/
  getUserFromRequest(
    req: Request,
    entitySlug: string
  ): Promise<AuthenticableEntity> {
    return this.getUserFromToken(req.headers?.['authorization'], entitySlug)
  }
}

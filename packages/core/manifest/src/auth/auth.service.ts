import { AuthenticableEntity, EntityManifest } from '@mnfst/types'
import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SHA3 } from 'crypto-js'
import { Request } from 'express'
import * as jwt from 'jsonwebtoken'
import { Repository } from 'typeorm'
import { EntityService } from '../entity/services/entity.service'
import { SignupAuthenticableEntityDto } from './dtos/signup-authenticable-entity.dto'
import { ADMIN_ENTITY_MANIFEST } from '../constants'
import { ManifestService } from '../manifest/services/manifest.service'
import { validate } from 'class-validator'

// import { EntityMetaService } from '../crud/services/entity-meta.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly entityService: EntityService,
    private readonly manifestService: ManifestService
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
    const entityManifest: EntityManifest =
      this.manifestService.getEntityManifest({
        slug: entitySlug
      })

    if (!entityManifest.authenticable) {
      throw new HttpException(
        'Entity is not authenticable',
        HttpStatus.BAD_REQUEST
      )
    }

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
  async signup(
    entitySlug: string,
    signupUserDto: SignupAuthenticableEntityDto
  ): Promise<{ token: string }> {
    if (entitySlug === ADMIN_ENTITY_MANIFEST.slug) {
      throw new HttpException(
        'Admins cannot be created with this method.',
        HttpStatus.BAD_REQUEST
      )
    }

    const entityManifest: EntityManifest =
      this.manifestService.getEntityManifest({
        slug: entitySlug
      })

    if (!entityManifest.authenticable) {
      throw new HttpException(
        'Entity is not authenticable',
        HttpStatus.BAD_REQUEST
      )
    }

    const entityRepository: Repository<any> =
      this.entityService.getEntityRepository({ entitySlug })

    const newUser: AuthenticableEntity = entityRepository.create(signupUserDto)
    newUser.password = SHA3(newUser.password).toString()

    const errors = await validate(newUser)
    if (errors.length) {
      throw new HttpException(errors, HttpStatus.BAD_REQUEST)
    }

    const savedUser = await entityRepository.save(newUser)

    return this.createToken(entitySlug, {
      email: savedUser.email,
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
      return Promise.resolve(null)
    }
    if (!decoded) {
      return Promise.resolve(null)
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

  /**
   * Returns whether the user from a request is an admin.
   *
   * @param req Request object
   *
   * @returns A promise that resolves to true if the user is an admin, and false otherwise.
   */
  async isReqUserAdmin(req: Request): Promise<boolean> {
    return this.getUserFromRequest(req, ADMIN_ENTITY_MANIFEST.slug).then(
      (user: AuthenticableEntity) => !!user
    )
  }
}

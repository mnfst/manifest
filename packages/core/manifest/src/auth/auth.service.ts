import { AuthenticableEntity, EntityManifest } from '@repo/types'
import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import bcrypt from 'bcrypt'
import { Request } from 'express'
import * as jwt from 'jsonwebtoken'
import { Repository } from 'typeorm'
import { EntityService } from '../entity/services/entity.service'
import { SignupAuthenticableEntityDto } from './dtos/signup-authenticable-entity.dto'
import {
  ADMIN_ENTITY_MANIFEST,
  DEFAULT_ADMIN_CREDENTIALS,
  SALT_ROUNDS
} from '../constants'
import { validate } from 'class-validator'
import { EntityManifestService } from '../manifest/services/entity-manifest.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly entityService: EntityService,
    private readonly entityManifestService: EntityManifestService
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
      this.entityManifestService.getEntityManifest({
        slug: entitySlug
      })

    if (!entityManifest.authenticable) {
      throw new HttpException(
        'Entity is not authenticable',
        HttpStatus.BAD_REQUEST
      )
    }

    const user = await this.findUserFromCredentials(
      entitySlug,
      signupUserDto.email,
      signupUserDto.password
    )

    if (!user) {
      throw new HttpException(
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED
      )
    }
    return {
      token: jwt.sign(
        { email: signupUserDto.email, entitySlug },
        this.configService.get('tokenSecretKey')
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
   * @param byPassAdminCheck If true, the method will not check if the entity is an admin
   *
   * @returns A JWT token of the created user
   *
   */
  async signup(
    entitySlug: string,
    signupUserDto: SignupAuthenticableEntityDto,
    byPassAdminCheck = false
  ): Promise<{ token: string }> {
    if (entitySlug === ADMIN_ENTITY_MANIFEST.slug && !byPassAdminCheck) {
      throw new HttpException(
        'Admins cannot be created with this method.',
        HttpStatus.BAD_REQUEST
      )
    }

    const entityManifest: EntityManifest =
      this.entityManifestService.getEntityManifest({
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

    const newUser: AuthenticableEntity = entityRepository.create({
      email: signupUserDto.email
    })
    newUser.password = bcrypt.hashSync(signupUserDto.password, SALT_ROUNDS)

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
   * @returns The user item from the JWT token and the entity slug of the user.
   *
   */
  async getUserFromToken(
    token: string
  ): Promise<{ user: AuthenticableEntity; entitySlug: string }> {
    let decoded: jwt.JwtPayload<{ email: string; entitySlug: string }>
    try {
      decoded = jwt.verify(
        token?.replace('Bearer ', ''),
        this.configService.get('tokenSecretKey')
      ) as jwt.JwtPayload
    } catch {
      return Promise.resolve({ user: null, entitySlug: null })
    }
    if (!decoded) {
      return Promise.resolve({ user: null, entitySlug: null })
    }

    const entityRepository: Repository<AuthenticableEntity> =
      this.entityService.getEntityRepository({
        entitySlug: decoded.entitySlug
      }) as Repository<AuthenticableEntity>

    const user = await entityRepository.findOne({
      where: {
        email: decoded.email
      }
    })

    return { user, entitySlug: decoded.entitySlug }
  }

  /**
   * Returns the user from a request. This user can be of any entity that extends AuthenticableEntity.
   *
   * @param req Request object
   *
   * @returns The user item from the request
   **/
  getUserFromRequest(
    req: Request
  ): Promise<{ user: AuthenticableEntity; entitySlug: string }> {
    const token = req.headers?.['authorization']

    if (!token) {
      return Promise.resolve({ user: null, entitySlug: null })
    }

    return this.getUserFromToken(token)
  }

  /**
   * Returns whether the user from a request is an admin.
   *
   * @param req Request object
   *
   * @returns A promise that resolves to true if the user is an admin, and false otherwise.
   */
  async isReqUserAdmin(req: Request): Promise<boolean> {
    return this.getUserFromRequest(req).then(
      (res: { user: AuthenticableEntity; entitySlug: string }) =>
        !!res?.user && res?.entitySlug === ADMIN_ENTITY_MANIFEST.slug
    )
  }

  /**
   * Returns whether the default admin exists.
   *
   * @returns A promise that resolves to an object with the key 'exists' that is true if the default admin exists, and false otherwise.
   * */
  async isDefaultAdminExists(): Promise<{ exists: boolean }> {
    const admin: AuthenticableEntity = await this.findUserFromCredentials(
      ADMIN_ENTITY_MANIFEST.slug,
      DEFAULT_ADMIN_CREDENTIALS.email,
      DEFAULT_ADMIN_CREDENTIALS.password
    )

    return { exists: !!admin }
  }

  /**
   * Find user from credentials.
   *
   * @param entitySlug The slug of the entity where the user is going to be searched
   * @param email The email of the user
   * @param password The password of the user
   *
   * @returns The user found from the credentials, or null if the user is not found.
   */
  async findUserFromCredentials(
    entitySlug: string,
    email: string,
    password: string
  ): Promise<AuthenticableEntity> {
    const entityRepository: Repository<AuthenticableEntity> =
      this.entityService.getEntityRepository({
        entitySlug
      }) as Repository<AuthenticableEntity>

    const user: AuthenticableEntity = await entityRepository.findOne({
      where: {
        email
      }
    })

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return null
    }

    return user
  }
}

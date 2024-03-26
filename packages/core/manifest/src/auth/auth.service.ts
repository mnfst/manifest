import { AuthenticableEntity } from '@casejs/types'
import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SHA3 } from 'crypto-js'
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

  // /**
  //  *
  //  * Sign up a user. This user can be of any entity that extends AuthenticableEntity but Admin.
  //  *
  //  * @param entitySlug The slug of the AuthenticableEntity where the user is going to be created
  //  * @param email The email of the user
  //  * @param password The password of the user
  //  *
  //  * @returns A JWT token of the created user
  //  *
  //  */
  // async signUp(
  //   entitySlug: string,
  //   signupUserDto: SignupUserDto
  // ): Promise<{ token: string }> {
  //   const repository: Repository<AuthenticableEntity> =
  //     this.entityMetaService.getRepository(entitySlug)
  //   if (
  //     !this.entityMetaService
  //       .getAuthenticableEntities()
  //       .filter((entity) => entity.targetName !== 'Admin')
  //       .find(
  //         (entity) =>
  //           entity.targetName ===
  //           this.entityMetaService.getEntityMetadata(entitySlug).targetName
  //       )
  //   ) {
  //     throw new HttpException(
  //       'You cannot sign up in this entity',
  //       HttpStatus.UNAUTHORIZED
  //     )
  //   }
  //   const user: AuthenticableEntity = await repository.save(
  //     repository.create(signupUserDto)
  //   )
  //   return this.createToken(entitySlug, {
  //     email: user.email,
  //     password: signupUserDto.password
  //   })
  // }

  /**
   * Returns the user from a JWT token. This user can be of any entity that extends AuthenticableEntity.
   *
   * @param token JWT token
   * @param entitySlug Entity slug. If provided, the user will be searched only in this entity. If not provided, the user will be searched in all entities that extend AuthenticableEntity.
   *
   * @returns The user item from the JWT token
   *
   */
  async getUserFromToken(
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

    console.log('decoded.email', decoded.email)

    return entityRepository.findOne({
      where: {
        email: decoded.email
      }
    })
  }
}

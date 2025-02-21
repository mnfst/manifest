import { HttpException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import * as jwt from 'jsonwebtoken'
import { AuthService } from '../auth.service'
import { EntityService } from '../../entity/services/entity.service'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'

describe('AuthService', () => {
  let authService: AuthService
  let configService: ConfigService
  let entityService: EntityService
  let entityManifestService: EntityManifestService

  const mockUser: any = {
    email: 'testEmail',
    password: 'testHashedPassword'
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-jwt-secret')
          }
        },
        {
          provide: EntityService,
          useValue: {
            getEntityRepository: jest.fn().mockReturnValue({
              findOne: jest.fn().mockReturnValue(Promise.resolve(mockUser))
            })
          }
        },
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn().mockReturnValue(ADMIN_ENTITY_MANIFEST)
          }
        }
      ]
    }).compile()

    authService = module.get<AuthService>(AuthService)
    configService = module.get<ConfigService>(ConfigService)
    entityService = module.get<EntityService>(EntityService)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
  })

  describe('createToken', () => {
    it('should return a valid JWT token if a user is found', async () => {
      const result = await authService.createToken(
        ADMIN_ENTITY_MANIFEST.slug,
        mockUser
      )
      expect(result).toHaveProperty('token')

      const decodedPayload = jwt.decode(result.token)
      expect(decodedPayload).toHaveProperty('email', 'testEmail')
    })

    it('should throw an exception when no user is found', async () => {
      // No user found.
      entityService.getEntityRepository = jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValue(Promise.resolve(null))
      })

      expect(async () => {
        await authService.createToken(ADMIN_ENTITY_MANIFEST.slug, {
          email: 'unknownUserEmail',
          password: 'testPlainPassword'
        })
      }).rejects.toThrow(HttpException)
    })
  })

  describe('signup', () => {
    it('should throw an exception when the entity is not authenticable', async () => {
      entityManifestService.getEntityManifest = jest.fn().mockReturnValue({
        authenticable: false
      })

      expect(async () => {
        await authService.signup(ADMIN_ENTITY_MANIFEST.slug, mockUser)
      }).rejects.toThrow(HttpException)
    })

    it('should throw an exception if the entity is admin', async () => {
      entityManifestService.getEntityManifest = jest.fn().mockReturnValue({
        authenticable: true
      })

      expect(async () => {
        await authService.signup(ADMIN_ENTITY_MANIFEST.slug, mockUser)
      }).rejects.toThrow(HttpException)
    })

    it('should save a user and return a token if the entity is authenticable', async () => {
      entityService.getEntityRepository = jest.fn().mockReturnValue({
        create: jest.fn().mockReturnValue(mockUser),
        save: jest.fn().mockReturnValue(Promise.resolve(mockUser)),
        findOne: jest.fn().mockReturnValue(Promise.resolve(mockUser))
      })

      const result = await authService.signup('users', mockUser)

      expect(result).toHaveProperty('token')
    })
  })

  describe('getUserFromToken', () => {
    it('should return a user when the token decodes to a valid email', async () => {
      entityService.getEntityRepository = jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValue(Promise.resolve(mockUser))
      })

      const { token } = await authService.createToken(
        ADMIN_ENTITY_MANIFEST.slug,
        mockUser
      )

      const response = await authService.getUserFromToken(token)

      expect(response.user).toHaveProperty('email', mockUser.email)
      expect(response.entitySlug).toBe(ADMIN_ENTITY_MANIFEST.slug)
    })

    it('should return an object with null user and entity slug when the token does not decode to a valid email', async () => {
      entityService.getEntityRepository = jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValue(Promise.resolve(null))
      })

      const { jwtToken } = jwt.sign(
        'nonexistent@email.com',
        configService.get('tokenSecretKey')
      )

      expect(await authService.getUserFromToken(jwtToken)).toMatchObject({
        user: null,
        entitySlug: null
      })
    })
  })

  describe('getUserFromRequest', () => {
    it('should extract the token from the request and return the user', async () => {
      jest.spyOn(authService, 'getUserFromToken')

      const { token } = await authService.createToken(
        ADMIN_ENTITY_MANIFEST.slug,
        mockUser
      )

      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      }

      await authService.getUserFromRequest(req as any)

      expect(authService.getUserFromToken).toHaveBeenCalledWith(
        `Bearer ${token}`
      )
    })

    it('should return null user and entity slug when no token is found in the request', async () => {
      const req = {
        headers: {}
      }

      const response = await authService.getUserFromRequest(req as any)

      expect(response).toMatchObject({ user: null, entitySlug: null })
    })
  })

  describe('isReqUserAdmin', () => {
    it('should return true if the user is an admin', async () => {
      jest.spyOn(authService, 'getUserFromRequest').mockResolvedValue(
        Promise.resolve({
          user: mockUser,
          entitySlug: ADMIN_ENTITY_MANIFEST.slug
        })
      )

      const result = await authService.isReqUserAdmin({} as any)
      expect(result).toBe(true)
    })

    it('should return false if the user is not an admin', async () => {
      jest.spyOn(authService, 'getUserFromRequest').mockResolvedValue(
        Promise.resolve({
          user: mockUser,
          entitySlug: 'nonAdminEntitySlug'
        })
      )

      const result = await authService.isReqUserAdmin({} as any)
      expect(result).toBe(false)
    })
  })

  describe('isDefaultAdminExists', () => {
    it('should return true if the default admin exists', async () => {
      entityService.getEntityRepository = jest.fn().mockReturnValue({
        exists: jest.fn().mockReturnValue(Promise.resolve(true))
      })

      const result = await authService.isDefaultAdminExists()
      expect(result.exists).toBe(true)
    })

    it('should return false if the default admin does not exist', async () => {
      entityService.getEntityRepository = jest.fn().mockReturnValue({
        exists: jest.fn().mockReturnValue(Promise.resolve(false))
      })

      const result = await authService.isDefaultAdminExists()
      expect(result.exists).toBe(false)
    })
  })
})

import { HttpException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import * as jwt from 'jsonwebtoken'
import { AuthService } from './auth.service'
import { EntityService } from '../entity/services/entity.service'

describe('AuthService', () => {
  let authService: AuthService
  let configService: ConfigService
  let entityService: EntityService

  const mockUser = {
    email: 'testEmail',
    password: 'testHashedPassword'
  }

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-jwt-secret')
  }

  const mockEntityService = {
    getEntityRepository: jest.fn().mockReturnValue({
      findOne: jest.fn().mockReturnValue(Promise.resolve(mockUser))
    })
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,

        {
          provide: ConfigService,
          useValue: mockConfigService
        },
        {
          provide: EntityService,
          useValue: mockEntityService
        }
      ]
    }).compile()

    authService = module.get<AuthService>(AuthService)
    configService = module.get<ConfigService>(ConfigService)
    entityService = module.get<EntityService>(EntityService)
  })

  describe('createToken', () => {
    it('should return a valid JWT token if a user is found', async () => {
      const result = await authService.createToken('admins', mockUser)
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
        await authService.createToken('admins', {
          email: 'unknownUserEmail',
          password: 'testPlainPassword'
        })
      }).rejects.toThrow(HttpException)
    })
  })

  describe('getUserFromToken', () => {
    it('should return a user when the token decodes to a valid email', async () => {
      entityService.getEntityRepository = jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValue(Promise.resolve(mockUser))
      })

      const jwtToken = jwt.sign(
        mockUser.email,
        configService.get('TOKEN_SECRET_KEY')
      )

      expect(await authService.getUserFromToken(jwtToken)).toHaveProperty(
        'email',
        mockUser.email
      )
    })

    it('should return null when the token does not decode to a valid email', async () => {
      entityService.getEntityRepository = jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValue(Promise.resolve(null))
      })

      const jwtToken = jwt.sign(
        'nonexistent@email.com',
        configService.get('TOKEN_SECRET_KEY')
      )

      expect(await authService.getUserFromToken(jwtToken)).toBe(null)
    })
  })
})

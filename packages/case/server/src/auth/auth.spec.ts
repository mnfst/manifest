import { Test } from '@nestjs/testing'
import { AuthService } from './auth.service'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import * as jwt from 'jsonwebtoken'
import { HttpException } from '@nestjs/common'

describe('AuthService', () => {
  let authService: AuthService
  let configService: ConfigService

  const mockUser = {
    email: 'testEmail',
    password: 'testHashedPassword'
  }
  
  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn()
    })
  }

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-jwt-secret')
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DataSource,
          useValue: mockDataSource
        },
        ConfigService,
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ]
    }).compile()

    authService = module.get<AuthService>(AuthService)
    configService = module.get<ConfigService>(ConfigService)
  })

  describe('createToken', () => {

    it('should return a valid jwt token if a user is found', async () => {
      mockDataSource.getRepository().findOne.mockReturnValue(mockUser)

      const result = await authService.createToken(
        'testEmail',
        'testPlainPassword'
      )
      expect(result).toHaveProperty('token')

      const decodedPayload = jwt.decode(result.token)
      expect(decodedPayload).toHaveProperty('email', 'testEmail')
    })

    it('should throw an exception when no user is found', async () => {
      mockDataSource.getRepository().findOne.mockReturnValue(null)

      expect(async () => {
        await authService.createToken('testEmail', 'testPlainPassword')
      }).rejects.toThrow(HttpException)
    })
  })

  describe('getUserFromToken', () => {

    it('should return a user when the token decodes to a valid email', async () => {
      const jwtToken = jwt.sign(mockUser.email, configService.get('JWT_SECRET') )
      mockDataSource.getRepository().findOne.mockReturnValue(mockUser)

      const result = await authService.getUserFromToken(jwtToken)
      expect(result).toHaveProperty('email', mockUser.email)
    })

    it('should return null when the token does not decode to a valid email', async () => {
      const jwtToken = jwt.sign('nonexistent@email.com', configService.get('JWT_SECRET') )
      mockDataSource.getRepository().findOne.mockReturnValue(null)

      const result = await authService.getUserFromToken(jwtToken)
      expect(result).toBe(null)
    })
  })
})

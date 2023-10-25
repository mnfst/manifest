import { Test } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { DataSource } from 'typeorm'
import { ConfigService } from '@nestjs/config'
import * as jwt from 'jsonwebtoken'

describe('AuthService', () => {
    let authService: AuthService;
    let configService: ConfigService;

    const mockDataSource = {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn()
        })
    }

    const mockConfigService = {
        get: jest.fn().mockReturnValue('test-jwt-secret')
    }

    const mockUser = {
        email: "testEmail",
        password: "testHashedPassword"
    }

    beforeEach( async () => {
        const module = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: DataSource,
                    useValue: mockDataSource,
                },
                ConfigService, 
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                }
            ]
        }).compile();
        
        authService = module.get<AuthService>(AuthService);
        configService = module.get<ConfigService>(ConfigService);
    })

    describe('getUserFromToken', () => {

        it('should return a valid jwt token if a user is found', async () => {
            mockDataSource.getRepository().findOne.mockReturnValue(mockUser)
    
            const result = await authService.createToken('testEmail', 'testPlainPassword')
            expect(result).toHaveProperty('token')
    
            const decodedPayload: any = jwt.decode(result.token);
            expect(decodedPayload).toHaveProperty('email', 'testEmail');
        })
        
    })
    
})
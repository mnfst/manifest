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
})
import { Test } from '@nestjs/testing'
import { DynamicEntityController } from './dynamic-entity.controller'
import { DynamicEntityService } from './dynamic-entity.service'
import { AuthGuard } from '../auth/auth.guard'
import { AuthService } from '../auth/auth.service'
import { DataSource } from 'typeorm'

describe('DynamicEntityController', () => {
    let dynamicEntityController: DynamicEntityController;
    let dynamicEntityService: DynamicEntityService;

    const mockDataSource = {
        entityMetadatas: {
            find: jest.fn(),
        }
    }

    const mockAuthService = []

    beforeEach(async () =>  {
        const module = await Test.createTestingModule({
            controllers: [DynamicEntityController],
            providers: [
                DynamicEntityService,
                {
                    provide: DataSource,
                    useValue: mockDataSource,
                },
                AuthGuard,
                {
                    provide: AuthService,
                    useValue: mockAuthService,
                },
            ]
        }).compile()

        dynamicEntityController = module.get<DynamicEntityController>(DynamicEntityController);
        dynamicEntityService = module.get<DynamicEntityService>(DynamicEntityService);
    })

    it('placeholder', () => {
        expect(true);
    })
})

describe('DynamicEntityService', () => {
    let dynamicEntityService: DynamicEntityService;
    
    const mockDataSource = {
        entityMetadatas: {
            find: jest.fn(),
        }
    }

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                DynamicEntityService,
                {
                    provide: DataSource,
                    useValue: mockDataSource,
                }
            ]
        }).compile()
        
        dynamicEntityService = module.get<DynamicEntityService>(DynamicEntityService);
    })

    it('placeholder', () => {
        expect(true);
    })
})
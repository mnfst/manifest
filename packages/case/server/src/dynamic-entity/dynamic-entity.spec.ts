import { Test } from '@nestjs/testing'
import { DynamicEntityController } from './dynamic-entity.controller'
import { DynamicEntityService } from './dynamic-entity.service'
import { AuthGuard } from '../auth/auth.guard'
import { AuthService } from '../auth/auth.service'
import { DataSource, EntityMetadata } from 'typeorm'

describe('DynamicEntityController', () => {
  let dynamicEntityController: DynamicEntityController
  let dynamicEntityService: DynamicEntityService

  const mockDataSource = {
    entityMetadatas: {
      find: jest.fn()
    }
  }

  const mockAuthService = {}

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DynamicEntityController],
      providers: [
        DynamicEntityService,
        {
          provide: DataSource,
          useValue: mockDataSource
        },
        AuthGuard,
        {
          provide: AuthService,
          useValue: mockAuthService
        }
      ]
    }).compile()

    dynamicEntityController = module.get<DynamicEntityController>(
      DynamicEntityController
    )
    dynamicEntityService =
      module.get<DynamicEntityService>(DynamicEntityService)
  })

  it('placeholder', () => {
    expect(true)
  })
})

describe('DynamicEntityService', () => {
  let dynamicEntityService: DynamicEntityService

  const mockRepository = {
    find: jest.fn()
  }

  const mockDataSource = {
    getRepository: jest.fn(() => mockRepository),
    entityMetadatas: {
      find: jest.fn()
    }
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DynamicEntityService,
        {
          provide: DataSource,
          useValue: mockDataSource
        }
      ]
    }).compile()

    dynamicEntityService =
      module.get<DynamicEntityService>(DynamicEntityService)
  })

  describe('findAll', () => {
    it('should be able to return non-paginated results from the repository when options.paginated == false', async () => {
      mockRepository.find.mockReturnValue({
        entity: 'testEntity',
        data: 'testData'
      })

      mockDataSource.entityMetadatas.find.mockResolvedValue({
        relations: [{ propertyName: 'mock' }]
      })

      const result = await dynamicEntityService.findAll({
        entitySlug: 'mockSlug',
        queryParams: {},
        options: { paginated: false }
      })

      expect(result).toHaveProperty('entity', 'testEntity')
    })
  })
})

import { Test } from '@nestjs/testing'

import { DataSource } from 'typeorm'
import { AuthService } from '../auth/auth.service'
import { CrudController } from './controllers/crud.controller'
import { CrudService } from './services/crud.service'

describe('CrudController', () => {
  let crudController: CrudController
  let crudService: CrudService

  const mockDataSource = {
    entityMetadatas: {
      find: jest.fn()
    }
  }

  const mockAuthService = {}

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CrudController],
      providers: [
        CrudService,
        {
          provide: DataSource,
          useValue: mockDataSource
        },
        {
          provide: AuthService,
          useValue: mockAuthService
        }
      ]
    }).compile()

    crudController = module.get<CrudController>(CrudController)
    crudService = module.get<CrudService>(CrudService)
  })

  it('placeholder', () => {
    expect(true)
  })
})

describe('CrudService', () => {
  let crudService: CrudService

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
        CrudService,
        {
          provide: DataSource,
          useValue: mockDataSource
        }
      ]
    }).compile()

    crudService = module.get<CrudService>(CrudService)
  })

  describe('findAll', () => {
    it('should be able to return non-paginated results from the repository when options.paginated == false', async () => {
      mockRepository.find.mockReturnValue({
        entity: 'testEntity',
        data: 'testData'
      })

      mockDataSource.entityMetadatas.find.mockReturnValue({
        relations: [{ propertyName: 'mock' }]
      })

      const result = await crudService.findAll({
        entitySlug: 'mockSlug',
        queryParams: {},
        options: { paginated: false }
      })

      expect(result).toHaveProperty('entity', 'testEntity')
    })
  })
})

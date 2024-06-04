import { Test, TestingModule } from '@nestjs/testing'
import { EntityService } from './entity.service'
import { ManifestService } from '../../../manifest/services/manifest/manifest.service'
import { DataSource } from 'typeorm'

describe('EntityService', () => {
  let service: EntityService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityService,
        {
          provide: ManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        },
        {
          provide: DataSource,
          useValue: {
            entityMetadatas: [],
            getRepository: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<EntityService>(EntityService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

import { Test, TestingModule } from '@nestjs/testing'
import { EntityLoaderService } from '../services/entity-loader.service'
import { ManifestService } from '../../manifest/services/manifest.service'

describe('EntityLoaderService', () => {
  let service: EntityLoaderService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityLoaderService,
        {
          provide: ManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<EntityLoaderService>(EntityLoaderService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

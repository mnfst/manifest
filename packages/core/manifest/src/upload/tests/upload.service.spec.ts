import { Test, TestingModule } from '@nestjs/testing'
import { UploadService } from '../services/upload.service'
import { StorageService } from '../../storage/services/storage/storage.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'

describe('UploadService', () => {
  let service: UploadService
  let storageService: StorageService
  let entityManifestService: EntityManifestService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: StorageService,
          useValue: {
            store: jest.fn()
          }
        },
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<UploadService>(UploadService)
    storageService = module.get<StorageService>(StorageService)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

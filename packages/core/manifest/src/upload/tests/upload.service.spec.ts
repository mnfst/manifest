import { Test, TestingModule } from '@nestjs/testing'
import { UploadService } from '../services/upload.service'
import { StorageService } from '../../storage/services/storage/storage.service'
import { ManifestService } from '../../manifest/services/manifest.service'

describe('UploadService', () => {
  let service: UploadService
  let storageService: StorageService
  let manifestService: ManifestService

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
          provide: ManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<UploadService>(UploadService)
    storageService = module.get<StorageService>(StorageService)
    manifestService = module.get<ManifestService>(ManifestService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

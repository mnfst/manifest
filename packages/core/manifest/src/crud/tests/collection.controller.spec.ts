import { Test, TestingModule } from '@nestjs/testing'
import { CollectionController } from '../controllers/collection.controller'
import { AuthService } from '../../auth/auth.service'
import { CrudService } from '../services/crud.service'
import { IsCollectionGuard } from '../guards/is-collection.guard'
import { ManifestService } from '../../manifest/services/manifest.service'

describe('CollectionController', () => {
  let controller: CollectionController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            isReqUserAdmin: jest.fn()
          }
        },
        {
          provide: CrudService,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn()
          }
        },
        {
          provide: IsCollectionGuard,
          useValue: {
            canActivate: jest.fn()
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

    controller = module.get<CollectionController>(CollectionController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})

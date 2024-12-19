import { Test, TestingModule } from '@nestjs/testing'
import { ManifestController } from '../controllers/manifest.controller'
import { AppManifestService } from '../services/manifest.service'
import { AuthService } from '../../auth/auth.service'

describe('ManifestController', () => {
  let controller: ManifestController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManifestController],
      providers: [
        {
          provide: AppManifestService,
          useValue: {
            getAppManifest: jest.fn(),
            getEntityManifest: jest.fn()
          }
        },
        {
          provide: AuthService,
          useValue: {
            getUserFromRequest: jest.fn()
          }
        }
      ]
    }).compile()

    controller = module.get<ManifestController>(ManifestController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('should get the app manifest', () => {
    controller.getAppManifest()
      
      expect(controller.manifestService.getAppManifest).toHaveBeenCalled()
    })
  })

  it('should get the entity manifest', () => {
  })

})

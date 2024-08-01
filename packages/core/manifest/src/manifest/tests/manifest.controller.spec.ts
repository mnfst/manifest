import { Test, TestingModule } from '@nestjs/testing'
import { ManifestController } from '../controllers/manifest.controller'
import { ManifestService } from '../services/manifest.service'
import { AuthService } from '../../auth/auth.service'

describe('ManifestController', () => {
  let controller: ManifestController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManifestController],
      providers: [
        {
          provide: ManifestService,
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
})

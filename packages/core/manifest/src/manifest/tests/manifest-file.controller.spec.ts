import { Test, TestingModule } from '@nestjs/testing'
import { ManifestFileController } from '../controllers/manifest-file.controller'
import { YamlService } from '../services/yaml.service'
import { ConfigService } from '@nestjs/config'
import { AuthService } from '../../auth/auth.service'

describe('ManifestFileController', () => {
  let controller: ManifestFileController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManifestFileController],
      providers: [
        {
          provide: YamlService,
          useValue: {}
        },
        {
          provide: ConfigService,
          useValue: {}
        },
        {
          provide: AuthService,
          useValue: {
            isReqUserAdmin: jest.fn()
          }
        }
      ]
    }).compile()

    controller = module.get<ManifestFileController>(ManifestFileController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})

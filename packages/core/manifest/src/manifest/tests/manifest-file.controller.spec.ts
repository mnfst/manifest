import { Test, TestingModule } from '@nestjs/testing'
import { ManifestFileController } from '../controllers/manifest-file.controller'
import { YamlService } from '../services/yaml.service'
import { ConfigService } from '@nestjs/config'
import { AuthService } from '../../auth/auth.service'
import { SchemaService } from '../services/schema.service'

describe('ManifestFileController', () => {
  let controller: ManifestFileController

  const mockedContent = 'mocked content'

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManifestFileController],
      providers: [
        {
          provide: YamlService,
          useValue: {
            loadFileContent: jest.fn(() => Promise.resolve(mockedContent)),
            saveFileContent: jest.fn(() => Promise.resolve({ success: true }))
          }
        },
        {
          provide: ConfigService,
          useValue: {
            get: () => ({ manifestFile: 'path-to-manifest.yml' })
          }
        },
        {
          provide: AuthService,
          useValue: {
            isReqUserAdmin: jest.fn()
          }
        },
        {
          provide: SchemaService,
          useValue: {}
        }
      ]
    }).compile()

    controller = module.get<ManifestFileController>(ManifestFileController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('should get the manifest file content', async () => {
    const result = await controller.getManifestFileContent()

    expect(result).toBeDefined()
    expect(result).toHaveProperty('content')
    expect(result.content).toBe(mockedContent)
  })

  it('should save the manifest file content', async () => {
    const result = await controller.saveManifestFileContent({
      content: mockedContent
    })

    expect(result).toBeDefined()
    expect(result).toHaveProperty('success')
    expect(result.success).toBe(true)
  })
})

import { Test, TestingModule } from '@nestjs/testing'
import { ManifestService } from './manifest.service'
import { YamlService } from '../yaml/yaml.service'
import { SchemaService } from '../schema/schema.service'

describe('ManifestService', () => {
  let service: ManifestService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManifestService,
        {
          provide: YamlService,
          useValue: {
            load: jest.fn()
          }
        },
        {
          provide: SchemaService,
          useValue: {
            validate: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<ManifestService>(ManifestService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

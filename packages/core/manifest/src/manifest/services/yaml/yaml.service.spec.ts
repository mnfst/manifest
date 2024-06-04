import { Test, TestingModule } from '@nestjs/testing'
import { YamlService } from './yaml.service'

describe('YamlService', () => {
  let service: YamlService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YamlService]
    }).compile()

    service = module.get<YamlService>(YamlService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should load the manifest from the YAML file and transform it into a AppManifest object', () => {
    const manifest = service.load()

    expect(manifest).toBeDefined()
  })
})

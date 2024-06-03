import { Test, TestingModule } from '@nestjs/testing'
import { YamlService } from './yaml.service'
import { ConfigService } from '@nestjs/config'

describe('YamlService', () => {
  let service: YamlService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YamlService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<YamlService>(YamlService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

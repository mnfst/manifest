import { Test, TestingModule } from '@nestjs/testing'
import { YamlService } from './yaml.service'
import * as fs from 'fs'
import { ConfigService } from '@nestjs/config'

jest.mock('fs')

describe('YamlService', () => {
  let service: YamlService

  beforeAll(() => {
    ;(fs.readFileSync as jest.Mock).mockImplementation(
      () => 'mocked file content'
    )
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YamlService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => ({
              database: 'mocked database path'
            }))
          }
        }
      ]
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

import { Test, TestingModule } from '@nestjs/testing'
import { YamlService } from '../services/yaml.service'
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

  describe('ignore emojis', () => {
    it('should remove emojis from the file content', () => {
      const result = service.ignoreEmojis('test😊')

      expect(result).toBe('test')
    })

    it('should remove emojis from the file content with surrounding spaces', () => {
      const result = service.ignoreEmojis('test 😊')
      const result2 = service.ignoreEmojis('😊 test')
      const result3 = service.ignoreEmojis('😊 test 😊')

      expect(result).toBe('test')
      expect(result2).toBe('test')
      expect(result3).toBe('test')
    })
  })
})

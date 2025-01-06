import { Test, TestingModule } from '@nestjs/testing'
import { YamlService } from '../services/yaml.service'
import * as fs from 'fs'
import { Manifest } from '../../../../types/src'

jest.mock('fs')
global.fetch = jest.fn()

describe('YamlService', () => {
  let service: YamlService

  const dummyAppSchema: Manifest = {
    name: 'mocked manifest',
    entities: {}
  }

  const dummyRemoteAppSchema: Manifest = {
    name: 'mocked remote manifest',
    entities: {}
  }

  beforeAll(() => {
    ;(fs.readFileSync as jest.Mock).mockImplementation(
      jest.fn().mockReturnValue(JSON.stringify(dummyAppSchema))
    )
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        text: () => Promise.resolve(JSON.stringify(dummyRemoteAppSchema))
      })
    )
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [YamlService]
    }).compile()

    service = module.get<YamlService>(YamlService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('load', () => {
    it('should load the manifest  file from the file path', async () => {
      const appSchema: Manifest = await service.load('mocked manifest path')

      expect(appSchema).toEqual(dummyAppSchema)
    })

    it('should load the manifest file from a URL', async () => {
      const dummyUrl: string = 'http://mocked-manifest-url.com'

      const remoteAppSchema: Manifest = await service.load(dummyUrl)

      expect(remoteAppSchema).toEqual(dummyRemoteAppSchema)
    })
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

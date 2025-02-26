import { Test, TestingModule } from '@nestjs/testing'
import { HookService } from '../hook.service'
import { HookManifest } from '../../../../types/src'

describe('HookService', () => {
  let service: HookService
  let originalConsoleLog: typeof console.log

  const hookManifest: HookManifest = {
    event: 'beforeCreate',
    type: 'webhook',
    url: 'http://example.com/webhook',
    method: 'POST',
    headers: {
      'test-header': 'test-value'
    }
  }

  beforeAll(() => {
    originalConsoleLog = console.log
    console.log = jest.fn()
  })

  afterAll(() => {
    console.log = originalConsoleLog
  })

  beforeAll(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ test: 100 })
      })
    ) as jest.Mock
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HookService]
    }).compile()

    service = module.get<HookService>(HookService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('transformHookSchemaIntoHookManifest', () => {
    // TODO: implement tests.
  })

  describe('triggerWebhook', () => {
    it('should make an HTTP request with the correct URL', async () => {
      await service.triggerWebhook(hookManifest, 'cats', {
        name: 'Tom',
        age: 10
      })

      expect(fetch).toHaveBeenCalledWith(hookManifest.url, expect.any(Object))
    })

    it('should make an HTTP request with the correct headers', async () => {
      await service.triggerWebhook(hookManifest, 'cats', {
        name: 'Tom',
        age: 10
      })

      expect(fetch).toHaveBeenCalledWith(
        hookManifest.url,
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'test-header': 'test-value'
          }
        })
      )
    })

    it('should make an HTTP request with the correct method', async () => {
      await service.triggerWebhook(hookManifest, 'cats', {
        name: 'Tom',
        age: 10
      })

      expect(fetch).toHaveBeenCalledWith(
        hookManifest.url,
        expect.objectContaining({
          method: hookManifest.method
        })
      )
    })

    it('should make an HTTP request with the correct body', async () => {
      await service.triggerWebhook(hookManifest, 'cats', {
        name: 'Tom',
        age: 10
      })

      expect(fetch).toHaveBeenCalledWith(
        hookManifest.url,
        expect.objectContaining({
          body: expect.stringContaining('record') // Hard to test the exact body as it has a date in it.
        })
      )
    })

    it('should ignore if the request fails', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Failed request')))

      await expect(
        service.triggerWebhook(hookManifest, 'cats', {
          name: 'Tom',
          age: 10
        })
      ).resolves.toBeUndefined()
    })
  })
})

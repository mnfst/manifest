import { Test, TestingModule } from '@nestjs/testing'
import { HandlerService } from './handler.service'
import { ConfigService } from '@nestjs/config'
import { BackendSDK } from '../sdk/backend-sdk'

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true)
}))
global.fetch = jest.fn()

describe('HandlerService', () => {
  let service: HandlerService

  const dummySdk = {}

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandlerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => ({
              handlersFolder: './'
            }))
          }
        },
        {
          provide: BackendSDK,
          useValue: dummySdk
        }
      ]
    }).compile()

    service = module.get<HandlerService>(HandlerService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('trigger', () => {
    it('should trigger the handler function', async () => {
      jest.spyOn(service, 'importHandler').mockResolvedValue(
        jest.fn(() => ({
          status: 200
        }))
      )

      const result = await service.trigger('handler', {} as any, {} as any)

      expect(result).toEqual({ status: 200 })
    })

    it('should pass the request and response objects to the handler function', async () => {
      const handler = jest.fn(() => ({
        status: 200
      }))

      jest.spyOn(service, 'importHandler').mockResolvedValue(handler)

      const req = { test: 'req' } as any
      const res = { test: 'res' } as any

      await service.trigger('handler', req, res)

      expect(handler).toHaveBeenCalledWith(req, res, dummySdk)
    })
  })

  describe('importHandler', () => {
    it('should throw an exception if the handler file does not exist', async () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)

      await expect(service.importHandler('handler')).rejects.toThrow(
        'Handler not found'
      )
    })

    it('should throw an exception if the handler default export is not a function', async () => {
      jest.spyOn(service, 'dynamicImport').mockResolvedValue(
        Promise.resolve({
          default: 'not a function'
        })
      )

      await expect(service.importHandler('handler')).rejects.toThrow(
        'Handler not found'
      )
    })

    it('should return the default export of the handler file', async () => {
      const handler = jest.fn()

      jest.spyOn(service, 'dynamicImport').mockResolvedValue(
        Promise.resolve({
          default: handler
        })
      )
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)

      const result = await service.importHandler('handler')

      expect(result).toEqual(handler)
    })
  })
})

import { Test, TestingModule } from '@nestjs/testing'
import { HandlerService } from './handler.service'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'

jest.mock('fs')
global.fetch = jest.fn()

describe('HandlerService', () => {
  let service: HandlerService

  beforeAll(() => {
    ;(fs.existsSync as jest.Mock).mockReturnValue(true)
  })

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

      expect(handler).toHaveBeenCalledWith(req, res)
    })
  })

  describe('importHandler', () => {
    // TODO: Find out how to implement this test (dynamic "import") in Jest.
  })
})

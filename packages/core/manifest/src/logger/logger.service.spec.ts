import { Test, TestingModule } from '@nestjs/testing'
import { LoggerService } from './logger.service'
import { ConfigService } from '@nestjs/config'

describe('LoggerService', () => {
  let service: LoggerService
  let originalConsoleLog

  const port = 3000

  beforeAll(() => {
    originalConsoleLog = console.log
    console.log = jest.fn()
  })

  afterAll(() => {
    console.log = originalConsoleLog
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(port)
          }
        }
      ]
    }).compile()

    service = module.get<LoggerService>(LoggerService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should console log the URL of the admin panel', () => {
    const consoleLogSpy = jest.spyOn(console, 'log')

    service.initMessage()

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining(`http://localhost:${port}`)
    )
  })
})

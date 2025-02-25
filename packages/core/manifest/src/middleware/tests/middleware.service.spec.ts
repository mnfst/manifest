import { Test, TestingModule } from '@nestjs/testing'
import { MiddlewareService } from '../middleware.service'

describe('MiddlewareService', () => {
  let service: MiddlewareService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MiddlewareService]
    }).compile()

    service = module.get<MiddlewareService>(MiddlewareService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

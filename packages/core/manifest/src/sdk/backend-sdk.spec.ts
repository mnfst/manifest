import { Test, TestingModule } from '@nestjs/testing'
import { SdkService } from './backend-sdk'

describe('SdkService', () => {
  let service: SdkService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SdkService]
    }).compile()

    service = module.get<SdkService>(SdkService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

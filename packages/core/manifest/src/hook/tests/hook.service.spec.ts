import { Test, TestingModule } from '@nestjs/testing'
import { HookService } from './hook.service'

describe('HookService', () => {
  let service: HookService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HookService]
    }).compile()

    service = module.get<HookService>(HookService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should make an HTTP request', () => {})

  it('should ')
})

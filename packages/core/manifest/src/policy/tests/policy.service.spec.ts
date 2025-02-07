import { Test, TestingModule } from '@nestjs/testing'
import { PolicyService } from '../policy.service'

describe('PolicyService', () => {
  let service: PolicyService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile()

    service = module.get<PolicyService>(PolicyService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

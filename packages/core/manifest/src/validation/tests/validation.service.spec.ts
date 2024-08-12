import { Test, TestingModule } from '@nestjs/testing'
import { ValidationService } from '../services/validation.service'

describe('ValidationService', () => {
  let service: ValidationService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationService]
    }).compile()

    service = module.get<ValidationService>(ValidationService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

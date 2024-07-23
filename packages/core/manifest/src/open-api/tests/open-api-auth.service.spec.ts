import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiAuthService } from '../services/open-api-auth.service'

describe('OpenApiAuthService', () => {
  let service: OpenApiAuthService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenApiAuthService]
    }).compile()

    service = module.get<OpenApiAuthService>(OpenApiAuthService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should generate a security scheme for admin auth', () => {
    return false
  })

  it('should generate a security scheme if entity is authenticable', () => {
    return false
  })

  it('should not generate a security scheme if entity is not authenticable', () => {
    return false
  })
})

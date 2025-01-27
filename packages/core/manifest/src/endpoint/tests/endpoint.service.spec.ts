import { Test, TestingModule } from '@nestjs/testing'
import { EndpointService } from '../endpoint.service'

describe('EndpointService', () => {
  let service: EndpointService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EndpointService]
    }).compile()

    service = module.get<EndpointService>(EndpointService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

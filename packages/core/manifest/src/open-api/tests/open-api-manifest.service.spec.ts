import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiManifestService } from '../services/open-api-manifest.service'

describe('OpenApiManifestService', () => {
  let service: OpenApiManifestService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenApiManifestService]
    }).compile()

    service = module.get<OpenApiManifestService>(OpenApiManifestService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

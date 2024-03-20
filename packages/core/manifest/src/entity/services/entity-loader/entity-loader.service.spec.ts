import { Test, TestingModule } from '@nestjs/testing'
import { EntityLoaderService } from './entity-loader.service'

describe('EntityLoaderService', () => {
  let service: EntityLoaderService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntityLoaderService]
    }).compile()

    service = module.get<EntityLoaderService>(EntityLoaderService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

import { Test, TestingModule } from '@nestjs/testing'
import { EntityService } from './entity.service'

describe('EntityService', () => {
  let service: EntityService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntityService]
    }).compile()

    service = module.get<EntityService>(EntityService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

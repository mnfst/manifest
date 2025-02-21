import { Test, TestingModule } from '@nestjs/testing'
import { SchemaService } from '../services/schema.service'

describe('SchemaService', () => {
  let service: SchemaService

  const manifest: any = {
    name: 'test app',
    entities: {}
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaService]
    }).compile()

    service = module.get<SchemaService>(SchemaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should validate a manifest', () => {
    expect(service.validate(manifest)).toBe(true)
  })
})

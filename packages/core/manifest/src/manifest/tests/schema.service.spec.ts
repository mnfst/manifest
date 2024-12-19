import { Test, TestingModule } from '@nestjs/testing'
import { SchemaService } from '../services/schema.service'

describe('SchemaService', () => {
  let service: SchemaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaService]
    }).compile()

    service = module.get<SchemaService>(SchemaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should validate the schema', () => {})

  it('should throw an error if the schema is invalid', () => {})

  describe('custom logic validation', () => {
    it('should check that all entities in relationships are valid', () => {})

    it('should check that all entities in policies are valid', () => {})
  })
})

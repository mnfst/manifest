import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiSchemaService } from '../services/open-api-schema.service'

describe('OpenApiSchemaService', () => {
  let service: OpenApiSchemaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenApiSchemaService]
    }).compile()

    service = module.get<OpenApiSchemaService>(OpenApiSchemaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getGeneralSchemas', () => {
    it('should return general schemas', () => {
      return false // TODO: Implement this test
    })
  })

  describe('generateEntitySchemas', () => {
    it('should generate schemas for entities with properties', () => {
      return false // TODO: Implement this test
    })

    it('should generate schemas for entities with relationships', () => {
      return false // TODO: Implement this test
    })

    it('should include values in the property type is Choice (enum)', () => {
      return false // TODO: Implement this test
    })

    it('should include sizes in the property type is Image', () => {
      return false // TODO: Implement this test
    })

    it('should add authenticable properties if the entity is authenticable', () => {
      return false // TODO: Implement this test
    })

    it('should include type, example and description for each property', () => {
      return false // TODO: Implement this test
    })

    it('should throw an error if the TS type is not found', () => {
      return false // TODO: Implement this test
    })

    it('should create DTO types for entities with properties', () => {
      return false // TODO: Implement this test
    })

    it('should create DTO types for entities with relationships', () => {
      return false // TODO: Implement this test
    })
  })
})

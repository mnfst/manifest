import { Test, TestingModule } from '@nestjs/testing'
import { EntityTypeService } from '../services/entity-type.service'

describe('EntityTypeService', () => {
  let service: EntityTypeService

  const entityMetadatas = [
    {
      targetName: 'Entity',
      columns: []
    }
  ]

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntityTypeService]
    }).compile()

    service = module.get<EntityTypeService>(EntityTypeService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('generateEntityTypeInfos', () => {
    it('should generate type infos for entities with properties', () => {
      return false // TODO: Implement this test
    })

    it('should generate type infos for entities with relationships', () => {
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

    it('should create DTO types for entities with properties', () => {
      return false // TODO: Implement this test
    })

    it('should create DTO types for entities with relationships', () => {
      return false // TODO: Implement this test
    })
  })

  describe('generateTSInterfaceFromEntityTypeInfo', () => {
    it('should generate a string representation of the TypeScript interface', () => {
      return false // TODO: Implement this test
    })
  })
})

import { Test, TestingModule } from '@nestjs/testing'
import { RelationshipManifestService } from '../services/relationship-manifest.service'

describe('RelationshipManifestService', () => {
  let service: RelationshipManifestService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RelationshipManifestService]
    }).compile()

    service = module.get<RelationshipManifestService>(
      RelationshipManifestService
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should transform the relationship schema into a relationship manifest', () => {})

  it('should generate one-to-many relationships based on opposite relationships', () => {})

  it('should generate many-to-many relationships based on opposite relationships', () => {})
})

import { Test, TestingModule } from '@nestjs/testing'
import { RelationshipService } from '../services/relationship.service'
import { ManifestService } from '../../manifest/services/manifest.service'

describe('RelationshipService', () => {
  let service: RelationshipService

  const mockSeedCount = 50
  const dummyRelationManifest = {
    name: 'owner',
    entity: 'User'
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipService,
        {
          provide: ManifestService,
          useValue: {
            getEntityManifest: jest.fn().mockReturnValue({
              seedCount: mockSeedCount
            })
          }
        }
      ]
    }).compile()

    service = module.get<RelationshipService>(RelationshipService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return a seed value between 1 and the seed count', () => {
    const seedValue = service.getSeedValue(dummyRelationManifest)

    expect(seedValue).toBeGreaterThanOrEqual(1)
    expect(seedValue).toBeLessThanOrEqual(mockSeedCount)
  })
})

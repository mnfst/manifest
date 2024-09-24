import { Test, TestingModule } from '@nestjs/testing'
import { RelationshipService } from '../services/relationship.service'
import { ManifestService } from '../../manifest/services/manifest.service'
import { RelationshipManifest } from '@repo/types'
import { EntityService } from '../services/entity.service'
import { DEFAULT_MAX_MANY_TO_MANY_RELATIONS } from '../../constants'

describe('RelationshipService', () => {
  let service: RelationshipService

  const mockSeedCount = 50
  const dummyRelationManifest: RelationshipManifest = {
    name: 'owner',
    entity: 'User',
    type: 'many-to-one'
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
        },
        {
          provide: EntityService,
          useValue: {
            getEntityRepository: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<RelationshipService>(RelationshipService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getSeedValue', () => {
    it('should return a seed value between 1 and the seed count', () => {
      const seedValue = service.getSeedValue(dummyRelationManifest)

      expect(seedValue).toBeGreaterThanOrEqual(1)
      expect(seedValue).toBeLessThanOrEqual(mockSeedCount)
    })

    it('should return a set items with a count between 0 and the default max many-to-many relations', () => {
      const manyToManyRelationManifest: RelationshipManifest = {
        name: 'users',
        entity: 'User',
        type: 'many-to-many',
        owningSide: true
      }

      const seedValue: { id: number }[] = service.getSeedValue(
        manyToManyRelationManifest
      ) as { id: number }[]

      expect(seedValue.length).toBeGreaterThanOrEqual(0)
      expect(seedValue.length).toBeLessThanOrEqual(
        DEFAULT_MAX_MANY_TO_MANY_RELATIONS
      )
      seedValue.forEach((relation) => {
        expect(relation.id).toBeGreaterThanOrEqual(1)
        expect(relation.id).toBeLessThanOrEqual(mockSeedCount)
      })
    })
  })
})

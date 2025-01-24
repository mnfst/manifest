import { Test, TestingModule } from '@nestjs/testing'
import { RelationshipService } from '../services/relationship.service'
import { RelationshipManifest } from '@repo/types'
import { EntityService } from '../services/entity.service'
import { DEFAULT_MAX_MANY_TO_MANY_RELATIONS } from '../../constants'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'

describe('RelationshipService', () => {
  let service: RelationshipService

  const mockSeedCount = 50
  const dummyRelationManifest: RelationshipManifest = {
    name: 'owner',
    entity: 'User',
    type: 'many-to-one'
  }
  const dummyUserIds: number[] = [1, 2, 3]

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipService,
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn().mockReturnValue({
              seedCount: mockSeedCount
            })
          }
        },
        {
          provide: EntityService,
          useValue: {
            getEntityRepository: jest.fn(() => ({
              findOneBy: jest.fn(({ id }) => Promise.resolve({ id })),
              findBy: jest.fn(() => dummyUserIds.map((id) => ({ id })))
            })),
            getEntityMetadata: jest.fn(() => ({ target: 'Owner' }))
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

  describe('fetchRelationItemsFromDto', () => {
    it('should return an object with the relation items', async () => {
      const itemDto = {
        ownerId: 1
      }

      const relationItems = await service.fetchRelationItemsFromDto({
        itemDto,
        relationships: [dummyRelationManifest]
      })

      expect(relationItems.owner['id']).toBe(itemDto.ownerId)
    })

    it('should retrun an object with the relation items for many-to-many relationships', async () => {
      const manyToManyRelationManifest: RelationshipManifest = {
        name: 'users',
        entity: 'User',
        type: 'many-to-many',
        owningSide: true
      }

      const itemDto = {
        userIds: dummyUserIds
      }

      const relationItems = (await service.fetchRelationItemsFromDto({
        itemDto,
        relationships: [manyToManyRelationManifest]
      })) as any

      expect(relationItems.users.length).toBe(3)

      relationItems.users.forEach((user, index) => {
        expect(user['id']).toBe(itemDto.userIds[index])
      })
    })
  })

  it('should empty missing relationships if emptyMissing is true', async () => {
    const itemDto = {}

    const relationItems = await service.fetchRelationItemsFromDto({
      itemDto,
      relationships: [dummyRelationManifest],
      emptyMissing: true
    })

    expect(relationItems.owner).toBeNull()
  })

  it('should not empty missing relationships by default', async () => {
    const itemDto = {}

    const relationItems = await service.fetchRelationItemsFromDto({
      itemDto,
      relationships: [dummyRelationManifest]
    })

    expect(relationItems.owner).toBeUndefined()
  })
})

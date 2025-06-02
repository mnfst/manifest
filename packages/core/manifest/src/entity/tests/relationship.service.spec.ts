import { Test, TestingModule } from '@nestjs/testing'
import { RelationshipService } from '../services/relationship.service'
import { RelationshipManifest } from '@repo/types'
import { EntityService } from '../services/entity.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'

describe('RelationshipService', () => {
  let service: RelationshipService

  const mockSeedCount = 50
  const dummyRelationManifest: RelationshipManifest = {
    name: 'owner',
    entity: 'User',
    type: 'many-to-one'
  }
  const dummyUserIds: string[] = [
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  ]

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

  describe('fetchRelationItemsFromDto', () => {
    it('should return an object with the many-to-one relations', async () => {
      const itemDto = {
        ownerId: 'b47ac10b-58cc-4372-a567-0e02b2c3d479'
      }

      const relationItems = await service.fetchRelationItemsFromDto({
        itemDto,
        relationships: [dummyRelationManifest]
      })

      expect(relationItems.owner['id']).toBe(itemDto.ownerId)
    })

    it('should return an object with the relation items for many-to-many relationships', async () => {
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

      expect(relationItems.users.length).toBe(dummyUserIds.length)

      relationItems.users.forEach((user, index) => {
        expect(user['id']).toBe(itemDto.userIds[index])
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
})

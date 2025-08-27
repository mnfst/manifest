import { Test, TestingModule } from '@nestjs/testing'
import { RelationshipService } from '../services/relationship.service'
import { EntityManifest, PropType, RelationshipManifest } from '@repo/types'
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
  const dummyEntityManifest: EntityManifest = {
    className: 'Test',
    nameSingular: 'Test',
    namePlural: 'Tests',
    mainProp: 'name',
    slug: 'test',
    authenticable: true,
    relationships: [dummyRelationManifest],
    properties: [
      {
        name: 'name',
        label: 'Name',
        type: PropType.String
      },
      {
        name: 'age',
        label: 'Age',
        type: PropType.Number,
        default: 18
      },
      {
        name: 'color',
        label: 'Color',
        type: PropType.String
      },
      {
        name: 'secretProperty',
        label: 'Secret Property',
        type: PropType.String,
        hidden: true
      },
      {
        name: 'password',
        label: 'Password',
        type: PropType.Password
      },
      {
        name: 'secondPassword',
        label: 'Second Password',
        type: PropType.Password
      }
    ],
    policies: {
      create: [],
      read: [],
      update: [],
      delete: [],
      signup: []
    }
  }

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

  describe('getEntitySchemaRelationOptions', () => {
    it('should return the many-to-one relationship options', () => {
      const relationOptions =
        service.getEntitySchemaRelationOptions(dummyEntityManifest)

      expect(relationOptions.owner).toEqual(
        expect.objectContaining({
          target: 'User',
          type: 'many-to-one',
          eager: false
        })
      )
    })

    it('should return the many-to-many relationship options', () => {
      const manyToManyRelationManifest: RelationshipManifest = {
        name: 'users',
        entity: 'User',
        type: 'many-to-many',
        owningSide: true,
        inverseSide: 'relatedUsers'
      }
      const entityManifest = Object.assign({}, dummyEntityManifest, {
        relationships: [manyToManyRelationManifest]
      })
      const relationOptions =
        service.getEntitySchemaRelationOptions(entityManifest)
      expect(relationOptions.users).toEqual({
        target: 'User',
        type: 'many-to-many',
        eager: false,
        inverseSide: 'relatedUsers',
        joinTable: {
          name: 'test_user'
        }
      })
    })

    it('should return the one-to-many relationship options', () => {
      const oneToManyRelationManifest: RelationshipManifest = {
        name: 'relatedUsers',
        entity: 'User',
        type: 'one-to-many',
        inverseSide: 'users'
      }
      const entityManifest = Object.assign({}, dummyEntityManifest, {
        relationships: [oneToManyRelationManifest]
      })
      const relationOptions =
        service.getEntitySchemaRelationOptions(entityManifest)

      expect(relationOptions.relatedUsers).toEqual({
        target: 'User',
        type: 'one-to-many',
        eager: false,
        inverseSide: 'users'
      })
    })

    it('should return the one-to-one relationship options', () => {
      const oneToOneRelationManifest: RelationshipManifest = {
        name: 'profile',
        entity: 'UserProfile',
        type: 'one-to-one',
        owningSide: true
      }
      const entityManifest = Object.assign({}, dummyEntityManifest, {
        relationships: [oneToOneRelationManifest]
      })
      const relationOptions =
        service.getEntitySchemaRelationOptions(entityManifest)

      expect(relationOptions.profile).toEqual(
        expect.objectContaining({
          target: 'UserProfile',
          type: 'one-to-one',
          eager: false,
          joinColumn: false
        })
      )
    })

    it('should set onDelete to SET NULL for non-nested entities', () => {
      const relationOptions =
        service.getEntitySchemaRelationOptions(dummyEntityManifest)

      expect(relationOptions.owner.onDelete).toBe('SET NULL')
    })

    it('should set onDelete to CASCADE for nested entities', () => {
      const nestedEntityManifest = Object.assign({}, dummyEntityManifest, {
        nested: true
      })
      const relationOptions =
        service.getEntitySchemaRelationOptions(nestedEntityManifest)

      expect(relationOptions.owner.onDelete).toBe('CASCADE')
    })
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

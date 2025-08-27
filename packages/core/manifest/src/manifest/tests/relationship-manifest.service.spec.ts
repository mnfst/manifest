import { Test, TestingModule } from '@nestjs/testing'
import { RelationshipManifestService } from '../services/relationship-manifest.service'
import {
  AppManifest,
  EntityManifest,
  PropType,
  RelationshipManifest
} from '../../../../types/src'

// Mock the camelize function
jest.mock('@repo/common', () => ({
  camelize: jest.fn((str: string) => str.toLowerCase())
}))

import { camelize } from '@repo/common'

// Mock instance to control the mock behavior in tests
const mockCamelize = camelize as jest.MockedFunction<typeof camelize>

describe('RelationshipManifestService', () => {
  let service: RelationshipManifestService

  beforeEach(async () => {
    // Reset the mock before each test
    mockCamelize.mockClear()

    const module: TestingModule = await Test.createTestingModule({
      providers: [RelationshipManifestService]
    }).compile()

    service = module.get<RelationshipManifestService>(
      RelationshipManifestService
    )
  })

  const dummyManifest: AppManifest = {
    name: 'my app',
    entities: {
      Cat: {
        className: 'Cat',
        nameSingular: 'Cat',
        namePlural: 'Cats',
        slug: 'cats',
        seedCount: 10,
        mainProp: 'name',
        properties: [
          {
            name: 'name',
            label: 'Name',
            type: PropType.String
          }
        ],
        relationships: [
          {
            name: 'owner',
            entity: 'Owner',
            type: 'many-to-one'
          },
          {
            name: 'friends',
            entity: 'Dog',
            type: 'many-to-many',
            owningSide: true
          }
        ],
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        }
      },
      Owner: {
        className: 'Owner',
        nameSingular: 'Owner',
        namePlural: 'Owners',
        slug: 'owners',
        seedCount: 10,
        mainProp: 'name',
        properties: [
          {
            name: 'name',
            label: 'Name',
            type: PropType.String
          }
        ],
        relationships: [
          {
            name: 'profile',
            entity: 'UserProfile',
            type: 'one-to-one',
            owningSide: true,
            eager: false
          }
        ],
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        }
      },
      Dog: {
        className: 'Dog',
        nameSingular: 'Dog',
        namePlural: 'Dogs',
        mainProp: 'name',
        slug: 'dogs',
        seedCount: 10,
        properties: [
          {
            name: 'name',
            label: 'Name',
            type: PropType.String
          }
        ],
        relationships: [],
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        }
      },
      UserProfile: {
        className: 'UserProfile',
        nameSingular: 'UserProfile',
        namePlural: 'UserProfiles',
        mainProp: 'name',
        slug: 'user-profiles',
        seedCount: 10,
        properties: [
          {
            name: 'name',
            label: 'Name',
            type: PropType.String
          }
        ],
        relationships: [],
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [],
          signup: []
        }
      }
    }
  }

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

  describe('transformRelationship', () => {
    it('should transform short-syntax many-to-one relationshipSchema into a relationshipManifest', () => {
      const relationship = 'User'
      const type = 'many-to-one'
      const entityClassName = 'Role'

      const result = service.transformRelationship(
        relationship,
        type,
        entityClassName
      )

      expect(result).toEqual({
        name: 'user',
        entity: 'User',
        eager: false,
        type: 'many-to-one'
      })
    })

    it('should transform long-syntax many-to-one relationshipSchema into a relationshipManifest', () => {
      const relationship = {
        name: 'user',
        entity: 'User',
        eager: true,
        helpText: 'this is the help text',
        type: 'many-to-one'
      }
      const entityClassName = 'Role'
      const result = service.transformRelationship(
        relationship,
        'many-to-one',
        entityClassName
      )
      expect(result).toEqual({
        name: 'user',
        entity: 'User',
        helpText: 'this is the help text',
        eager: true,
        type: 'many-to-one'
      })
    })

    it('should transform short-syntax many-to-many relationshipSchema into a relationshipManifest', () => {
      const relationship = 'User'
      const type = 'many-to-many'
      const entityClassName = 'Role'
      const result = service.transformRelationship(
        relationship,
        type,
        entityClassName
      )
      expect(result).toEqual({
        name: 'users',
        entity: 'User',
        eager: false,
        inverseSide: 'roles',
        type: 'many-to-many',
        owningSide: true
      })
    })

    it('should transform long-syntax many-to-many relationshipSchema into a relationshipManifest', () => {
      const relationship = {
        name: 'user',
        entity: 'User',
        eager: true,
        type: 'many-to-many',
        helpText: 'this is the help text'
      }
      const entityClassName = 'Role'
      const result = service.transformRelationship(
        relationship,
        'many-to-many',
        entityClassName
      )
      expect(result).toEqual({
        name: 'users',
        entity: 'User',
        eager: true,
        inverseSide: 'roles',
        type: 'many-to-many',
        helpText: 'this is the help text',
        owningSide: true
      })
    })
  })

  describe('opposite relationships', () => {
    it('should generate one-to-many relationships based on opposite relationships', () => {
      const relationshipManifests: RelationshipManifest[] =
        service.getOppositeOneToManyRelationships(
          [dummyManifest.entities.Cat, dummyManifest.entities.Owner],
          dummyManifest.entities.Owner
        )

      expect(relationshipManifests).toEqual([
        expect.objectContaining({
          name: 'cats',
          entity: 'Cat',
          type: 'one-to-many',
          inverseSide: 'owner'
        })
      ])
    })

    it('should generate many-to-many relationships based on opposite relationships', () => {
      const relationshipManifests: RelationshipManifest[] =
        service.getOppositeManyToManyRelationships(
          [dummyManifest.entities.Cat, dummyManifest.entities.Dog],
          dummyManifest.entities.Dog
        )

      expect(relationshipManifests).toEqual([
        {
          name: 'cats',
          entity: 'Cat',
          eager: false,
          type: 'many-to-many',
          owningSide: false,
          inverseSide: 'friends'
        }
      ])
    })

    it('should generate one-to-one relationships based on opposite relationships', () => {
      const relationshipManifests: RelationshipManifest[] =
        service.getOppositeOneToOneRelationships(
          [dummyManifest.entities.UserProfile, dummyManifest.entities.Owner],
          dummyManifest.entities.UserProfile
        )

      expect(relationshipManifests[0]).toEqual(
        expect.objectContaining({
          name: 'owner',
          entity: 'Owner',
          type: 'one-to-one',
          inverseSide: 'profile',
          owningSide: false
        })
      )
    })
  })

  describe('getRelationshipManifestsFromNestedProperties', () => {
    it('should generate relationships from nested properties', () => {
      const allEntityManifests: EntityManifest[] = [
        {
          className: 'Parent',
          nameSingular: 'Parent',
          properties: [
            {
              name: 'name',
              type: PropType.String
            },
            {
              name: 'children',
              type: PropType.Nested,
              options: {
                group: 'Child'
              },
              helpText: 'this is the help text'
            }
          ]
        },
        {
          className: 'Child',
          properties: []
        }
      ] as any

      const relationships: RelationshipManifest[] =
        service.getRelationshipManifestsFromNestedProperties(
          allEntityManifests[1],
          allEntityManifests
        )

      expect(relationships).toEqual([
        expect.objectContaining({
          name: 'parent',
          entity: 'Parent',
          type: 'many-to-one',
          inverseSide: 'children',
          owningSide: true,
          eager: false,
          helpText: 'this is the help text'
        })
      ])
    })
  })
})

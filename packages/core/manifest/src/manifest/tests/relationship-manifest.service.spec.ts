import { Test, TestingModule } from '@nestjs/testing'
import { RelationshipManifestService } from '../services/relationship-manifest.service'
import {
  AppManifest,
  PropType,
  RelationshipManifest
} from '../../../../types/src'

describe('RelationshipManifestService', () => {
  let service: RelationshipManifestService

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

  it('should transform the relationship schema into a relationship manifest', () => {
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

  it('should generate one-to-many relationships based on opposite relationships', () => {
    const relationshipManifests: RelationshipManifest[] =
      service.getOneToManyRelationships(
        [dummyManifest.entities.Cat, dummyManifest.entities.Owner],
        dummyManifest.entities.Owner
      )

    expect(relationshipManifests).toEqual([
      {
        name: 'cats',
        entity: 'Cat',
        eager: false,
        type: 'one-to-many',
        inverseSide: 'owner'
      }
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
})

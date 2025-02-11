import { Test, TestingModule } from '@nestjs/testing'
import { EntityLoaderService } from '../services/entity-loader.service'
import { RelationshipService } from '../services/relationship.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { EntitySchema } from 'typeorm'
import { EntityManifest, PropType } from '../../../../types/src'

describe('EntityLoaderService', () => {
  let service: EntityLoaderService

  const dummyEntityManifest: EntityManifest = {
    className: 'Cat',
    nameSingular: 'cat',
    namePlural: 'cats',
    slug: 'cats',
    mainProp: 'name',
    seedCount: 50,
    belongsTo: [],
    relationships: [],
    hooks: {
      beforeCreate: [],
      afterCreate: [],
      beforeUpdate: [],
      afterUpdate: [],
      beforeDelete: [],
      afterDelete: []
    },
    properties: [
      {
        name: 'name',
        type: PropType.String
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
        EntityLoaderService,
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn(),
            getEntityManifests: jest.fn(() => [dummyEntityManifest])
          }
        },
        {
          provide: RelationshipService,
          useValue: {
            getEntitySchemaRelationOptions: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<EntityLoaderService>(EntityLoaderService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should load entities', () => {
    const result: EntitySchema[] = service.loadEntities(false)

    expect(result).toBeDefined()
    expect(result.length).toBe(1)
  })
})

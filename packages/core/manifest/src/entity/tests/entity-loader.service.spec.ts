import { Test, TestingModule } from '@nestjs/testing'
import { EntityLoaderService } from '../services/entity-loader.service'
import { RelationshipService } from '../services/relationship.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { EntitySchema, ValueTransformer } from 'typeorm'
import { EntityManifest, PropType } from '../../../../types/src'

describe('EntityLoaderService', () => {
  let service: EntityLoaderService
  let relationshipService: RelationshipService

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
        name: 'string-prop',
        type: PropType.String
      },
      {
        name: 'number-prop',
        type: PropType.Number
      },
      {
        name: 'money-prop',
        type: PropType.Money
      },
      {
        name: 'timestamp-prop',
        type: PropType.Timestamp
      },
      {
        name: 'choice-prop',
        type: PropType.Choice
      },
      {
        name: 'location-prop',
        type: PropType.Location
      },
      {
        name: 'image-prop',
        type: PropType.Image
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
            getEntitySchemaRelationOptions: jest.fn(() => [])
          }
        }
      ]
    }).compile()

    service = module.get<EntityLoaderService>(EntityLoaderService)
    relationshipService = module.get<RelationshipService>(RelationshipService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should load entities', () => {
    const result: EntitySchema[] = service.loadEntities(false)

    expect(result).toBeDefined()
    expect(result.length).toBe(1)
  })

  it('should set postgres and sqlite specific column types', () => {
    const postgresResult: EntitySchema[] = service.loadEntities(true)
    const sqliteResult: EntitySchema[] = service.loadEntities(false)

    expect(postgresResult[0].options.columns['string-prop'].type).toBe(
      'varchar'
    )
    expect(postgresResult[0].options.columns['number-prop'].type).toBe(
      'numeric'
    )
    expect(postgresResult[0].options.columns['money-prop'].type).toBe('numeric')
    expect(postgresResult[0].options.columns['timestamp-prop'].type).toBe(
      'timestamp'
    )
    expect(postgresResult[0].options.columns['choice-prop'].type).toBe('text')
    expect(postgresResult[0].options.columns['location-prop'].type).toBe(
      'jsonb'
    )
    expect(postgresResult[0].options.columns['image-prop'].type).toBe('jsonb')

    expect(sqliteResult[0].options.columns['string-prop'].type).toBe('varchar')
    expect(sqliteResult[0].options.columns['number-prop'].type).toBe('decimal')
    expect(sqliteResult[0].options.columns['money-prop'].type).toBe('decimal')
    expect(sqliteResult[0].options.columns['timestamp-prop'].type).toBe(
      'datetime'
    )
    expect(sqliteResult[0].options.columns['choice-prop'].type).toBe(
      'simple-enum'
    )
    expect(sqliteResult[0].options.columns['location-prop'].type).toBe('json')
    expect(sqliteResult[0].options.columns['image-prop'].type).toBe('json')
  })

  it('should add transformer that forces number type return for number properties', () => {
    const result: EntitySchema[] = service.loadEntities(false)

    expect(result[0].options.columns['number-prop'].transformer).toBeDefined()
    expect(result[0].options.columns['money-prop'].transformer).toBeDefined()

    expect(
      (
        result[0].options.columns['number-prop'].transformer as ValueTransformer
      ).from('1')
    ).toBe(1)
    expect(
      (
        result[0].options.columns['number-prop'].transformer as ValueTransformer
      ).to(1)
    ).toBe(1)
  })

  it('should add a transformer that forces string type return for timestamp properties', () => {
    const result: EntitySchema[] = service.loadEntities(false)

    expect(
      result[0].options.columns['timestamp-prop'].transformer
    ).toBeDefined()

    expect(
      (
        result[0].options.columns['timestamp-prop']
          .transformer as ValueTransformer
      ).from(new Date('2021-01-01T00:00:00.000Z'))
    ).toBe('2021-01-01T00:00:00.000Z')
  })

  it('should add relations', () => {
    const result: EntitySchema[] = service.loadEntities(false)

    expect(
      relationshipService.getEntitySchemaRelationOptions
    ).toHaveBeenCalled()

    expect(result[0].options.relations).toBeDefined()
  })
})

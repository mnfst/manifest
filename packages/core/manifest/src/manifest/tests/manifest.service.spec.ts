import { Test, TestingModule } from '@nestjs/testing'
import { ManifestService } from '../services/manifest.service'
import { YamlService } from '../services/yaml.service'
import { SchemaService } from '../services/schema.service'
import { EntityManifest, EntitySchema, PropType } from '@repo/types'

describe('ManifestService', () => {
  let service: ManifestService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManifestService,
        {
          provide: YamlService,
          useValue: {
            load: jest.fn()
          }
        },
        {
          provide: SchemaService,
          useValue: {
            validate: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<ManifestService>(ManifestService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('TransformEntityManifests', () => {
    it('should transform entity schemas into entity manifests', () => {
      const entitySchemaObject: { [keyof: string]: EntitySchema } = {
        Cat: {
          seedCount: 10,
          properties: [
            {
              name: 'name'
            }
          ]
        }
      }

      const entityManifests: EntityManifest[] =
        service.transformEntityManifests(entitySchemaObject)

      expect(entityManifests.length).toBe(1)
      expect(entityManifests[0].seedCount).toBe(10)
      expect(entityManifests[0].properties.length).toBe(1)
      expect(entityManifests[0].single).toBe(false)
    })
  })

  it('should transform single entity schemas into entity manifests', () => {
    const entitySchemaObject: { [keyof: string]: EntitySchema } = {
      HomeContent: {
        single: true,
        properties: [
          {
            name: 'title'
          },
          {
            name: 'coverImage',
            type: 'image'
          }
        ]
      }
    }

    const entityManifests: EntityManifest[] =
      service.transformEntityManifests(entitySchemaObject)

    expect(entityManifests.length).toBe(1)
    expect(entityManifests[0].properties.length).toBe(2)
    expect(entityManifests[0].single).toBe(true)
    expect(entityManifests[0].relationships.length).toBe(0)
    expect(entityManifests[0]).not.toHaveProperty('seedCount')
    expect(entityManifests[0]).not.toHaveProperty('mainProp')
    expect(entityManifests[0]).not.toHaveProperty('authenticable')
    expect(entityManifests[0]).not.toHaveProperty('belongsTo')
    expect(entityManifests[0]).not.toHaveProperty('belongsToMany')
  })

  describe('hideEntitySensitiveInformation', () => {
    it('should remove hidden properties', () => {
      const dummyEntityManifest: EntityManifest = {
        nameSingular: 'Cat',
        namePlural: 'Cats',
        slug: 'cats',
        seedCount: 10,
        properties: [
          {
            name: 'name',
            type: PropType.String
          },
          {
            name: 'password',
            type: PropType.Password,
            hidden: true
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

      const hiddenEntityManifest: EntityManifest =
        service.hideEntitySensitiveInformation(dummyEntityManifest)

      expect(hiddenEntityManifest.properties.length).toBe(1)
      expect(hiddenEntityManifest.properties[0].name).toBe('name')
    })
  })
})

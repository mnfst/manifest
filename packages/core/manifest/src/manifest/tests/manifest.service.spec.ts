import { Test, TestingModule } from '@nestjs/testing'
import { ManifestService } from '../services/manifest.service'
import { YamlService } from '../services/yaml.service'
import { SchemaService } from '../services/schema.service'
import { AppManifest, PropType } from '@repo/types'
import { EntityManifestService } from '../services/entity-manifest.service'
import { ADMIN_ENTITY_MANIFEST } from '../../constants'

describe('ManifestService', () => {
  let service: ManifestService
  let schemaService: SchemaService
  let entityManifestService: EntityManifestService

  const dummyManifest: AppManifest = {
    name: 'my app',
    entities: {
      Cat: {
        nameSingular: 'Cat',
        namePlural: 'Cats',
        slug: 'cats',
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
      providers: [
        ManifestService,
        {
          provide: YamlService,
          useValue: {
            load: jest.fn(() => Promise.resolve(dummyManifest))
          }
        },
        {
          provide: SchemaService,
          useValue: {
            validate: jest.fn()
          }
        },
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn(),
            hideEntitySensitiveInformation: jest.fn(),
            transformEntityManifests: jest.fn(() => [
              dummyManifest.entities.Cat
            ])
          }
        }
      ]
    }).compile()

    service = module.get<ManifestService>(ManifestService)
    schemaService = module.get<SchemaService>(SchemaService)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )

    // Set private property.
    ;(service as any).appManifest = dummyManifest
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('get app manifest', () => {
    it('should get the manifest', () => {
      const manifest = service.getAppManifest()

      expect(manifest).toBeDefined()
    })

    it('should get the full version only if the parameter is passed', () => {
      const fullManifest: AppManifest = service.getAppManifest({
        fullVersion: true
      })
      const publicManifest: AppManifest = service.getAppManifest()

      expect(fullManifest).toEqual(dummyManifest)
      expect(publicManifest).not.toEqual(dummyManifest)

      expect(publicManifest.entities).not.toHaveProperty('Admin')
      expect(publicManifest.entities).toHaveProperty('Cat')
      expect(
        entityManifestService.hideEntitySensitiveInformation
      ).toHaveBeenCalled()
    })

    it('should throw an error if the manifest is not loaded', () => {
      // Set private property.
      ;(service as any).appManifest = undefined

      expect(() => {
        service.getAppManifest()
      }).toThrow()
    })
  })

  describe('load manifest', () => {
    it('should load the manifest and store it in the service', async () => {
      ;(service as any).appManifest = undefined

      await service.loadManifest('mocked manifest path')

      expect((service as any).appManifest).toBeDefined()
      expect((service as any).appManifest.name).toBe(dummyManifest.name)
    })

    it('should add the admin entity o the manifest', async () => {
      ;(service as any).appManifest = undefined

      await service.loadManifest('mocked manifest path')

      expect((service as any).appManifest.entities).toHaveProperty(
        ADMIN_ENTITY_MANIFEST.className
      )
    })

    it('should transform the entity schemas into entity manifests', async () => {
      ;(service as any).appManifest = undefined

      await service.loadManifest('mocked manifest path')

      expect(
        entityManifestService.transformEntityManifests
      ).toHaveBeenCalledTimes(Object.keys(dummyManifest.entities).length)
    })

    it('should throw an error if the manifest is not valid', () => {
      jest.spyOn(schemaService, 'validate').mockImplementation(() => {
        throw new Error('Invalid schema')
      })

      service.loadManifest('mocked manifest path').catch((error) => {
        expect(error.message).toBe('Invalid schema')
      })
    })
  })
})

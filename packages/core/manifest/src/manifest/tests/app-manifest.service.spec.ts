import { Test, TestingModule } from '@nestjs/testing'
import { AppManifestService } from '../services/manifest.service'
import { YamlService } from '../services/yaml.service'
import { SchemaService } from '../services/schema.service'
import { EntityManifest, PropType } from '@repo/types'

describe('AppManifestService', () => {
  let service: AppManifestService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppManifestService,
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

    service = module.get<AppManifestService>(AppManifestService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('get manifest', () => {
    it('should get the manifest', () => {
      const manifest = service.getManifest()

      expect(manifest).toBeDefined()
    })

    it('should get the full version only if the parameter is passed', () => {
      // TODO: Implement this test
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

    it('should throw an error if the manifest is not loaded', () => {
      return false
    })
  })

  describe('load manifest', () => {
    it('should load the manifest', () => {
      return false
    })

    it('should store the manifest in the service', () => {})

    it('should add the admin entity o the manifest', () => {})

    it('should transform the entity schemas into entity manifests', () => {})

    it('should throw an error if the manifest is not valid', () => {
      return false
    })
  })
})

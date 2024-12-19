import { Test, TestingModule } from '@nestjs/testing'
import { EntityManifestService } from '../services/entity-manifest.service'

describe('EntityManifestService', () => {
  let service: EntityManifestService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntityManifestService]
    }).compile()

    service = module.get<EntityManifestService>(EntityManifestService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('Get', () => {
    it('should get the entity manifests from the manifest service', () => {})

    it('should not get the entity manifests full version unless the parameter is passed', () => {})

    it('should get the entity manifest by name', () => {})

    it('should get the entity manifest by slug', () => {})

    it('should not get the entity manifest full version unless the parameter is passed', () => {})

    it('should fail if no className and no slug is provided', () => {})

    it('should fail if no entity manifest is found', () => {})
  })

  describe('Transform', () => {
    it('should transform collection entity schemas into entity manifests', () => {
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
    expect(entityManifests[0]).not.toHaveProperty('namePlural')
    expect(entityManifests[0]).not.toHaveProperty('authenticable')
    expect(entityManifests[0]).not.toHaveProperty('belongsTo')
    expect(entityManifests[0]).not.toHaveProperty('belongsToMany')
  })
})

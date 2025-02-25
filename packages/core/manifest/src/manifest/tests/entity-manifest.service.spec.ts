import { Test, TestingModule } from '@nestjs/testing'
import { EntityManifestService } from '../services/entity-manifest.service'
import {
  AppManifest,
  EntityManifest,
  EntitySchema,
  HookManifest,
  HooksSchema,
  MiddlewareManifest,
  MiddlewaresSchema,
  PropType
} from '../../../../types/src'
import { RelationshipManifestService } from '../services/relationship-manifest.service'
import { ManifestService } from '../services/manifest.service'
import { HookService } from '../../hook/hook.service'
import { PolicyService } from '../../policy/policy.service'

describe('EntityManifestService', () => {
  let service: EntityManifestService
  let manifestService: ManifestService
  let hookService: HookService

  const dummyManifest: AppManifest = {
    name: 'my app',
    entities: {
      Cat: {
        className: 'Cat',
        nameSingular: 'Cat',
        namePlural: 'Cats',
        mainProp: 'name',
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
    }
  }

  const dummyHookManifest: HookManifest = {
    event: 'beforeCreate',
    type: 'webhook',
    url: 'https://test.com',
    method: 'POST',
    headers: {}
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityManifestService,
        {
          provide: RelationshipManifestService,
          useValue: {
            getRelationshipManifests: jest.fn(),
            transformRelationship: jest.fn(),
            getOneToManyRelationships: jest.fn(() => []),
            getOppositeManyToManyRelationships: jest.fn(() => [])
          }
        },
        {
          provide: ManifestService,
          useValue: {
            getAppManifest: jest.fn(() => dummyManifest)
          }
        },
        {
          provide: HookService,
          useValue: {
            transformHookSchemaIntoHookManifest: jest.fn(
              () => dummyHookManifest
            )
          }
        },
        {
          provide: PolicyService,
          useValue: {
            transformPolicies: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<EntityManifestService>(EntityManifestService)
    manifestService = module.get<ManifestService>(ManifestService)
    hookService = module.get<HookService>(HookService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('Get', () => {
    it('should get the entity manifests from the manifest service', () => {
      service.getEntityManifests()
      expect(manifestService.getAppManifest).toHaveBeenCalled()
    })

    it('should not get the entity manifests full version unless the parameter is passed', () => {
      const entityManifests: EntityManifest[] = service.getEntityManifests()
      const fullVersionEntityManifests: EntityManifest[] =
        service.getEntityManifests({ fullVersion: true })

      expect(
        entityManifests[0].properties.find((prop) => prop.hidden)
      ).toBeUndefined()
      expect(
        fullVersionEntityManifests[0].properties.find((prop) => prop.hidden)
      ).toBeDefined()
    })

    it('should get the entity manifest by class name', () => {
      const entityManifest: EntityManifest = service.getEntityManifest({
        className: 'Cat'
      })

      expect(entityManifest.nameSingular).toBe('Cat')
    })

    it('should get the entity manifest by slug', () => {
      const entityManifest: EntityManifest = service.getEntityManifest({
        slug: 'cats'
      })

      expect(entityManifest.nameSingular).toBe('Cat')
    })

    it('should not get the entity manifest full version unless the parameter is passed', () => {
      const entityManifest: EntityManifest = service.getEntityManifest({
        slug: 'cats'
      })
      const fullVersionEntityManifest: EntityManifest =
        service.getEntityManifest({
          slug: 'cats',
          fullVersion: true
        })

      expect(
        entityManifest.properties.find((prop) => prop.hidden)
      ).toBeUndefined()
      expect(
        fullVersionEntityManifest.properties.find((prop) => prop.hidden)
      ).toBeDefined()
    })

    it('should fail if no className and no slug is provided', () => {
      expect(() => service.getEntityManifest({})).toThrow()
    })

    it('should fail if no entity manifest is found', () => {
      expect(() =>
        service.getEntityManifest({
          className: 'NonExistent'
        })
      ).toThrow()
    })
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
    expect(entityManifests[0].mainProp).toBe(null) // No main prop for single entities.
    expect(entityManifests[0].namePlural).toBe('homecontent')
    expect(entityManifests[0].authenticable).toBe(false)
    expect(entityManifests[0]).not.toHaveProperty('seedCount')
    expect(entityManifests[0]).not.toHaveProperty('belongsTo')
    expect(entityManifests[0]).not.toHaveProperty('belongsToMany')
  })

  describe('TransformHookObject', () => {
    it('should transform the hook object into a record of hooks', () => {
      const hookObject: HooksSchema = {
        beforeCreate: [
          {
            url: 'https://test.com',
            method: 'POST'
          }
        ]
      }

      const hooks: Record<string, HookManifest[]> =
        service.transformHookObject(hookObject)

      expect(
        hookService.transformHookSchemaIntoHookManifest
      ).toHaveBeenCalledWith(hookObject.beforeCreate[0], 'beforeCreate')

      expect(hooks.beforeCreate).toBeDefined()
      expect(hooks.beforeCreate[0]).toMatchObject(dummyHookManifest)
    })
  })

  describe('TransformMiddlewareObject', () => {
    it('should transform the middleware object into a record of middlewares', () => {
      const middlewareObject: MiddlewaresSchema = {
        beforeCreate: [{ handler: 'test' }]
      }

      const middlewares: Record<string, MiddlewareManifest[]> =
        service.transformMiddlewareObject(middlewareObject)

      expect(middlewares.beforeCreate).toBeDefined()
      expect(middlewares.beforeCreate[0]).toMatchObject({
        handler: 'test'
      })
    })
  })
})

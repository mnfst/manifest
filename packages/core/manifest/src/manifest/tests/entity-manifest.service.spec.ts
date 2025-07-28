import { Test, TestingModule } from '@nestjs/testing'
import { EntityManifestService } from '../services/entity-manifest.service'
import {
  AppManifest,
  EntityManifest,
  EntitySchema,
  GroupSchema,
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
import { PropertyManifestService } from '../services/property-manifest.service'

describe('EntityManifestService', () => {
  let service: EntityManifestService
  let manifestService: ManifestService
  let relationshipManifestService: RelationshipManifestService
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
          },
          {
            name: 'nestedProp',
            type: PropType.Nested,
            options: { group: 'NestedEntity  ' }
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
      NestedEntity: {
        className: 'NestedEntity',
        nameSingular: 'NestedEntity',
        namePlural: 'NestedEntities',
        mainProp: 'name',
        slug: 'nested-entities',
        nested: true,
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
            getOppositeManyToManyRelationships: jest.fn(() => []),
            getOppositeOneToManyRelationships: jest.fn(() => []),
            getOppositeOneToOneRelationships: jest.fn(() => []),
            getRelationshipManifestsFromNestedProperties: jest.fn(() => [])
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
        },
        {
          provide: PropertyManifestService,
          useValue: {
            transformPropertyManifest: jest.fn((prop) => ({
              name: prop.name,
              type: (prop.type as PropType) || PropType.String,
              hidden: prop.hidden || false,
              helpText: prop.helpText || '',
              default: prop.default
            }))
          }
        }
      ]
    }).compile()

    service = module.get<EntityManifestService>(EntityManifestService)
    manifestService = module.get<ManifestService>(ManifestService)
    relationshipManifestService = module.get<RelationshipManifestService>(
      RelationshipManifestService
    )
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

    it('should fail if entity is nested unless includeNested is true', () => {
      expect(() =>
        service.getEntityManifest({
          className: 'NestedEntity'
        })
      ).toThrow()

      expect(() =>
        service.getEntityManifest({
          className: 'NestedEntity',
          includeNested: true
        })
      ).not.toThrow()
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
        service.transformEntityManifests({ entities: entitySchemaObject })

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

    const entityManifests: EntityManifest[] = service.transformEntityManifests({
      entities: entitySchemaObject
    })

    expect(entityManifests.length).toBe(1)
    expect(entityManifests[0].properties.length).toBe(2)
    expect(entityManifests[0].single).toBe(true)
    expect(entityManifests[0].relationships.length).toBe(0)
    expect(entityManifests[0].mainProp).toBe(null) // No main prop for single entities.
    expect(entityManifests[0].namePlural).toBe('homeContent')
    expect(entityManifests[0].authenticable).toBe(false)
    expect(entityManifests[0].seedCount).toBe(1)
    expect(entityManifests[0]).not.toHaveProperty('belongsTo')
    expect(entityManifests[0]).not.toHaveProperty('belongsToMany')
  })

  it('should transform group objects into nested entity manifests', () => {
    const groupSchemaObject: { [keyof: string]: GroupSchema } = {
      Testimonial: {
        properties: [
          {
            name: 'content',
            type: PropType.String
          },
          {
            name: 'author',
            type: PropType.String
          }
        ]
      }
    }

    const entityManifests: EntityManifest[] = service.transformEntityManifests({
      entities: {},
      groups: groupSchemaObject
    })

    expect(entityManifests.length).toBe(1)
    expect(entityManifests[0].className).toBe('Testimonial')
    expect(entityManifests[0].nameSingular).toBe('testimonial')
    expect(entityManifests[0].namePlural).toBe('testimonials')
    expect(entityManifests[0].mainProp).toBe('content')
    expect(entityManifests[0].slug).toBe('testimonials')
    expect(entityManifests[0].nested).toBe(true)
  })

  it('should delete the initial "group" property from the entity manifest', () => {
    const entityManifests: EntityManifest[] = service.transformEntityManifests({
      entities: dummyManifest.entities
    })

    expect(
      entityManifests[0].properties.find((prop) => prop.name === 'group')
    ).toBeUndefined()
  })

  it('should set seedCount to 1 for nested entities with one-to-one relationships', () => {
    const entitySchemaObject: { [keyof: string]: EntitySchema } = {
      HomeContent: {
        single: true,
        properties: [
          {
            name: 'title',
            type: PropType.String
          },
          {
            name: 'cta',
            type: PropType.Nested,
            options: { group: 'CallToAction' }
          }
        ]
      }
    }

    const groupSchemaObject: { [keyof: string]: GroupSchema } = {
      CallToAction: {
        properties: [
          {
            name: 'text',
            type: PropType.String
          }
        ]
      }
    }

    jest
      .spyOn(
        relationshipManifestService,
        'getRelationshipManifestsFromNestedProperties'
      )
      .mockReturnValue([
        {
          name: 'homeContent',
          entity: 'HomeContent',
          type: 'one-to-one'
        }
      ])

    const entityManifests: EntityManifest[] = service.transformEntityManifests({
      entities: entitySchemaObject,
      groups: groupSchemaObject
    })

    const callToActionEntityManifest: EntityManifest = entityManifests.find(
      (entity) => entity.className === 'CallToAction'
    )

    expect(callToActionEntityManifest).toBeDefined()
    expect(callToActionEntityManifest.seedCount).toBe(1)
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

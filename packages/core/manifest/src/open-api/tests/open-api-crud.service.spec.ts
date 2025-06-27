import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiCrudService } from '../services/open-api-crud.service'
import {
  EntityManifest,
  PolicyManifest,
  PropType,
  WhereOperator,
  whereOperatorKeySuffix
} from '@repo/types'
import { OpenApiUtilsService } from '../services/open-api-utils.service'
import { QUERY_PARAMS_RESERVED_WORDS } from '../../constants'
import { getValidWhereOperators } from '../../crud/records/prop-type-valid-where-operators'

describe('OpenApiCrudService', () => {
  let service: OpenApiCrudService

  const dummyEntityManifest: EntityManifest = {
    className: 'Cat',
    nameSingular: 'cat',
    namePlural: 'cats',
    slug: 'cats',
    mainProp: 'name',
    seedCount: 50,
    properties: [
      {
        name: 'name',
        type: PropType.String
      },
      {
        name: 'isActive',
        type: PropType.Boolean
      }
    ],
    relationships: [
      {
        name: 'owner',
        type: 'many-to-one',
        entity: 'User'
      },
      {
        name: 'friends',
        type: 'many-to-many',
        entity: 'Cat'
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

  const dummySingleEntityManifest: EntityManifest = {
    className: 'Settings',
    nameSingular: 'settings',
    namePlural: 'settings',
    slug: 'settings',
    mainProp: 'name',
    single: true,
    properties: [
      {
        name: 'projectName',
        type: PropType.String
      },
      {
        name: 'projectValue',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenApiCrudService,
        {
          provide: OpenApiUtilsService,
          useValue: {
            getSecurityRequirements: jest.fn(() => [])
          }
        }
      ]
    }).compile()

    service = module.get<OpenApiCrudService>(OpenApiCrudService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('generateEntityPaths', () => {
    it('should generate all 7 entity paths', () => {
      jest.spyOn(service, 'generateListPath').mockReturnValue({})
      jest.spyOn(service, 'generateListSelectOptionsPath').mockReturnValue({})
      jest.spyOn(service, 'generateCreatePath').mockReturnValue({})
      jest.spyOn(service, 'generateDetailPath').mockReturnValue({})
      jest.spyOn(service, 'generateUpdatePath').mockReturnValue({})
      jest.spyOn(service, 'generatePatchPath').mockReturnValue({})
      jest.spyOn(service, 'generateDeletePath').mockReturnValue({})

      const paths = service.generateEntityPaths([dummyEntityManifest])

      expect(paths).toBeDefined()
      expect(Object.keys(paths).length).toBe(3)

      expect(service.generateListPath).toHaveBeenCalled()
      expect(service.generateListSelectOptionsPath).toHaveBeenCalled()
      expect(service.generateCreatePath).toHaveBeenCalled()
      expect(service.generateDetailPath).toHaveBeenCalled()
      expect(service.generateUpdatePath).toHaveBeenCalled()
      expect(service.generatePatchPath).toHaveBeenCalled()
      expect(service.generateDeletePath).toHaveBeenCalled()
    })

    it('should not generate create path if create policy is forbidden', () => {
      jest.spyOn(service, 'generateCreatePath').mockReturnValue({})
      const forbiddenEntityManifest = {
        ...dummyEntityManifest,
        policies: {
          create: [{ access: 'forbidden' }],
          read: [],
          update: [],
          delete: [],
          signup: []
        }
      } as EntityManifest
      const paths = service.generateEntityPaths([forbiddenEntityManifest])

      expect(paths).toBeDefined()
      expect(service.generateCreatePath).not.toHaveBeenCalled()
    })

    it('should not generate list, list select options and detail path if read policy is forbidden', () => {
      jest.spyOn(service, 'generateListPath').mockReturnValue({})
      jest.spyOn(service, 'generateListSelectOptionsPath').mockReturnValue({})
      jest.spyOn(service, 'generateDetailPath').mockReturnValue({})

      const forbiddenEntityManifest = {
        ...dummyEntityManifest,
        policies: {
          create: [],
          read: [{ access: 'forbidden' }],
          update: [],
          delete: [],
          signup: []
        }
      } as EntityManifest
      const paths = service.generateEntityPaths([forbiddenEntityManifest])

      expect(paths).toBeDefined()
      expect(service.generateListPath).not.toHaveBeenCalled()
      expect(service.generateListSelectOptionsPath).not.toHaveBeenCalled()
      expect(service.generateDetailPath).not.toHaveBeenCalled()
    })

    it('should not generate update and patch paths if update policy is forbidden', () => {
      jest.spyOn(service, 'generateUpdatePath').mockReturnValue({})
      jest.spyOn(service, 'generatePatchPath').mockReturnValue({})

      const forbiddenEntityManifest = {
        ...dummyEntityManifest,
        policies: {
          create: [],
          read: [],
          update: [{ access: 'forbidden' }],
          delete: [],
          signup: []
        }
      } as EntityManifest
      const paths = service.generateEntityPaths([forbiddenEntityManifest])

      expect(paths).toBeDefined()
      expect(service.generateUpdatePath).not.toHaveBeenCalled()
      expect(service.generatePatchPath).not.toHaveBeenCalled()
    })

    it('should not generate delete path if delete policy is forbidden', () => {
      jest.spyOn(service, 'generateDeletePath').mockReturnValue({})

      const forbiddenEntityManifest = {
        ...dummyEntityManifest,
        policies: {
          create: [],
          read: [],
          update: [],
          delete: [{ access: 'forbidden' }],
          signup: []
        }
      } as EntityManifest
      const paths = service.generateEntityPaths([forbiddenEntityManifest])

      expect(paths).toBeDefined()
      expect(service.generateDeletePath).not.toHaveBeenCalled()
    })
  })

  describe('generateListPath', () => {
    it('should generate list path with a success response', () => {
      const path = service.generateListPath(dummyEntityManifest)

      expect(path).toBeDefined()
      expect(path).toMatchObject({
        get: {
          summary: expect.any(String),
          description: expect.any(String),
          tags: [expect.any(String)],
          parameters: expect.any(Array),
          security: expect.any(Array),
          responses: {
            '200': expect.any(Object)
          }
        }
      })
    })

    it('should generate general parameters (pagination and sorting)', () => {
      const path = service.generateListPath(dummyEntityManifest)
      expect(path.get.parameters).toBeDefined()
      Array.from(QUERY_PARAMS_RESERVED_WORDS).forEach((param) => {
        const paramObj = path.get.parameters.find((p) => p['name'] === param)
        expect(paramObj).toBeDefined()
        expect(paramObj).toEqual(
          expect.objectContaining({
            name: param,
            in: 'query',
            required: false
          })
        )
      })
    })

    it('should generate all available filters (for each property with valid suffixes)', () => {
      const path = service.generateListPath(dummyEntityManifest)
      expect(path.get.parameters).toBeDefined()
      expect(path.get.parameters.length).toBeGreaterThan(0)
      dummyEntityManifest.properties.forEach((prop) => {
        getValidWhereOperators(prop.type).forEach((operator: WhereOperator) => {
          const filterName = `${prop.name}${whereOperatorKeySuffix[operator]}`
          const filterParam = path.get.parameters.find(
            (p) => p['name'] === filterName
          )
          expect(filterParam).toBeDefined()
          expect(filterParam['in']).toBe('query')
          expect(filterParam['required']).toBe(false)
          expect(filterParam['description']).toEqual(expect.any(String))
          expect(filterParam['schema']).toEqual(
            expect.objectContaining({
              type: expect.any(String)
            })
          )
        })
      })
    })

    it('should generate a success response with a $ref to the Paginator schema and the entity schema', () => {
      const path = service.generateListPath(dummyEntityManifest)
      expect(path.get.responses['200']).toBeDefined()
      expect(
        path.get.responses['200']['content']['application/json']
      ).toBeDefined()
      expect(
        path.get.responses['200']['content']['application/json'].schema
      ).toBeDefined()
      expect(
        path.get.responses['200']['content']['application/json'].schema.allOf
      ).toEqual(
        expect.arrayContaining([
          {
            $ref: '#/components/schemas/Paginator'
          },
          {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  $ref: `#/components/schemas/${dummyEntityManifest.className}`
                }
              }
            }
          }
        ])
      )
    })
  })

  describe('generateListSelectOptionsPath', () => {
    it('should generate list select options path with a success response', () => {
      const path = service.generateListSelectOptionsPath(dummyEntityManifest)

      expect(path).toBeDefined()
      expect(path).toMatchObject({
        get: {
          summary: expect.any(String),
          description: expect.any(String),
          tags: [expect.any(String)],
          security: expect.any(Array),
          responses: {
            '200': expect.any(Object)
          }
        }
      })
    })
  })

  describe('generateCreatePath', () => {
    it('should generate create path with a success response', () => {
      const path = service.generateCreatePath(dummyEntityManifest)

      expect(path).toBeDefined()
      expect(path).toMatchObject({
        post: {
          summary: expect.any(String),
          description: expect.any(String),
          tags: [expect.any(String)],
          requestBody: expect.any(Object),
          security: expect.any(Array),
          responses: {
            '201': expect.any(Object)
          }
        }
      })
    })

    it('should generate request body with a reference to the DTO schema', () => {
      const path = service.generateCreatePath(dummyEntityManifest)
      expect(path.post.requestBody).toBeDefined()
      expect(path.post.requestBody['content']).toBeDefined()
      expect(path.post.requestBody['content']['application/json']).toBeDefined()
      expect(
        path.post.requestBody['content']['application/json'].schema
      ).toEqual({
        $ref: `#/components/schemas/CreateUpdate${dummyEntityManifest.className}Dto`
      })
    })

    it('should generate a success response with a $ref to the entity schema', () => {
      const path = service.generateCreatePath(dummyEntityManifest)
      expect(path.post.responses['201']).toBeDefined()
      expect(
        path.post.responses['201']['content']['application/json']
      ).toBeDefined()
      expect(
        path.post.responses['201']['content']['application/json'].schema
      ).toEqual({
        $ref: `#/components/schemas/${dummyEntityManifest.className}`
      })
    })
  })

  describe('generateDetailPath', () => {
    it('should generate detail path with a success response', () => {
      const path = service.generateDetailPath(dummyEntityManifest)

      expect(path).toBeDefined()
      expect(path).toMatchObject({
        get: {
          summary: expect.any(String),
          description: expect.any(String),
          tags: [expect.any(String)],
          parameters: expect.any(Array),
          security: expect.any(Array),
          responses: {
            '200': expect.any(Object)
          }
        }
      })
    })

    it('should generate parameters for the entity ID', () => {
      const path = service.generateDetailPath(dummyEntityManifest)

      expect(path.get.parameters).toBeDefined()

      const idParam = path.get.parameters.find(
        (param) => param['name'] === 'id'
      )
      expect(idParam).toBeDefined()

      expect(idParam['name']).toBe('id')
      expect(idParam['in']).toBe('path')
      expect(idParam['required']).toBe(true)
      expect(idParam['description']).toEqual(expect.any(String))
      expect(idParam['schema']).toEqual(
        expect.objectContaining({
          type: 'string',
          format: 'uuid',
          example: expect.any(String)
        })
      )
    })

    it('should generate parameter for the relationships', () => {
      const path = service.generateDetailPath(dummyEntityManifest)

      expect(path.get.parameters).toBeDefined()

      const relationshipParam = path.get.parameters.find(
        (param) => param['name'] === 'relations'
      )
      expect(relationshipParam).toBeDefined()

      expect(relationshipParam['name']).toBe('relations')
      expect(relationshipParam['in']).toBe('query')
      expect(relationshipParam['required']).toBe(false)
      expect(relationshipParam['description']).toEqual(expect.any(String))
      expect(relationshipParam['style']).toBe('form')
      expect(relationshipParam['explode']).toBe(false)
      expect(relationshipParam['schema']).toEqual(
        expect.objectContaining({
          type: 'array',
          items: {
            type: 'string',
            enum: dummyEntityManifest.relationships.map((r) => r.name)
          }
        })
      )
    })

    it('should generate a success response with a $ref to the entity schema', () => {
      const path = service.generateDetailPath(dummyEntityManifest)
      expect(path.get.responses['200']).toBeDefined()
      expect(
        path.get.responses['200']['content']['application/json']
      ).toBeDefined()
      expect(
        path.get.responses['200']['content']['application/json'].schema
      ).toEqual({
        $ref: `#/components/schemas/${dummyEntityManifest.className}`
      })
    })
  })

  describe('generateUpdatePath', () => {
    it('should generate update path with a success response', () => {
      const path = service.generateUpdatePath(dummyEntityManifest)

      expect(path).toBeDefined()
      expect(path).toMatchObject({
        put: {
          summary: expect.any(String),
          description: expect.any(String),
          tags: [expect.any(String)],
          parameters: expect.any(Array),
          requestBody: expect.any(Object),
          security: expect.any(Array),
          responses: {
            '200': expect.any(Object)
          }
        }
      })
    })

    it('should generate parameters for the entity ID only if entity not single', () => {
      const path = service.generateUpdatePath(dummyEntityManifest)
      const singlePath = service.generateUpdatePath(
        dummySingleEntityManifest,
        true
      )

      expect(path.put.parameters).toBeDefined()

      const idParam = path.put.parameters.find(
        (param) => param['name'] === 'id'
      )
      expect(idParam).toBeDefined()

      expect(idParam['name']).toBe('id')
      expect(idParam['in']).toBe('path')
      expect(idParam['required']).toBe(true)
      expect(idParam['description']).toEqual(expect.any(String))
      expect(idParam['schema']).toEqual(
        expect.objectContaining({
          type: 'string',
          format: 'uuid',
          example: expect.any(String)
        })
      )

      expect(singlePath.put.parameters).toEqual([]) // Single entity should not have ID parameter
    })

    it('should generate request body with a reference to the DTO schema', () => {
      const path = service.generateUpdatePath(dummyEntityManifest)
      expect(path.put.requestBody).toBeDefined()
      expect(path.put.requestBody['content']).toBeDefined()
      expect(path.put.requestBody['content']['application/json']).toBeDefined()
      expect(
        path.put.requestBody['content']['application/json'].schema
      ).toEqual({
        $ref: `#/components/schemas/CreateUpdate${dummyEntityManifest.className}Dto`
      })
    })

    it('should generate a success response with a $ref to the entity schema', () => {
      const path = service.generateUpdatePath(dummyEntityManifest)
      expect(path.put.responses['200']).toBeDefined()
      expect(
        path.put.responses['200']['content']['application/json']
      ).toBeDefined()
      expect(
        path.put.responses['200']['content']['application/json'].schema
      ).toEqual({
        $ref: `#/components/schemas/${dummyEntityManifest.className}`
      })
    })
  })

  describe('generatePatchPath', () => {
    it('should generate patch path with a success response', () => {
      const path = service.generatePatchPath(dummyEntityManifest)

      expect(path).toBeDefined()
      expect(path).toMatchObject({
        patch: {
          summary: expect.any(String),
          description: expect.any(String),
          tags: [expect.any(String)],
          parameters: expect.any(Array),
          requestBody: expect.any(Object),
          security: expect.any(Array),
          responses: {
            '200': expect.any(Object)
          }
        }
      })
    })

    it('should generate parameters for the entity ID', () => {
      const path = service.generatePatchPath(dummyEntityManifest)
      expect(path.patch.parameters).toBeDefined()
      const idParam = path.patch.parameters.find(
        (param) => param['name'] === 'id'
      )
      expect(idParam).toBeDefined()
      expect(idParam['name']).toBe('id')
      expect(idParam['in']).toBe('path')
      expect(idParam['required']).toBe(true)
      expect(idParam['description']).toEqual(expect.any(String))
      expect(idParam['schema']).toEqual(
        expect.objectContaining({
          type: 'string',
          format: 'uuid',
          example: expect.any(String)
        })
      )
    })

    it('should generate request body with a reference to the DTO schema', () => {
      const path = service.generatePatchPath(dummyEntityManifest)
      expect(path.patch.requestBody).toBeDefined()
      expect(path.patch.requestBody['content']).toBeDefined()
      expect(
        path.patch.requestBody['content']['application/json']
      ).toBeDefined()
      expect(
        path.patch.requestBody['content']['application/json'].schema
      ).toEqual({
        $ref: `#/components/schemas/CreateUpdate${dummyEntityManifest.className}Dto`
      })
    })

    it('should generate a success response with a $ref to the entity schema', () => {
      const path = service.generatePatchPath(dummyEntityManifest)
      expect(path.patch.responses['200']).toBeDefined()
      expect(
        path.patch.responses['200']['content']['application/json']
      ).toBeDefined()
      expect(
        path.patch.responses['200']['content']['application/json'].schema
      ).toEqual({
        $ref: `#/components/schemas/${dummyEntityManifest.className}`
      })
    })
  })

  describe('generateDeletePath', () => {
    it('should generate delete path with a success response', () => {
      const path = service.generateDeletePath(dummyEntityManifest)

      expect(path).toBeDefined()
      expect(path).toMatchObject({
        delete: {
          summary: expect.any(String),
          description: expect.any(String),
          tags: [expect.any(String)],
          parameters: expect.any(Array),
          security: expect.any(Array),
          responses: {
            '200': expect.any(Object)
          }
        }
      })
    })

    it('should generate parameters for the entity ID', () => {
      const path = service.generateDeletePath(dummyEntityManifest)
      expect(path.delete.parameters).toBeDefined()
      expect(path.delete.parameters.length).toBe(1)
      const idParam = path.delete.parameters.find(
        (param) => param['name'] === 'id'
      )
      expect(idParam).toBeDefined()
      expect(idParam['name']).toBe('id')
      expect(idParam['in']).toBe('path')
      expect(idParam['required']).toBe(true)
      expect(idParam['description']).toEqual(expect.any(String))
      expect(idParam['schema']).toEqual(
        expect.objectContaining({
          type: 'string',
          format: 'uuid',
          example: expect.any(String)
        })
      )
    })

    it('should generate a success response with a $ref to the entity schema', () => {
      const path = service.generateDeletePath(dummyEntityManifest)
      expect(path.delete.responses['200']).toBeDefined()
      expect(
        path.delete.responses['200']['content']['application/json']
      ).toBeDefined()
      expect(
        path.delete.responses['200']['content']['application/json'].schema
      ).toEqual({
        $ref: `#/components/schemas/${dummyEntityManifest.className}`
      })
    })
  })

  describe('isNotForbidden', () => {
    it('should return true if all policies are not forbidden', () => {
      const policies: PolicyManifest[] = [
        { access: 'public' },
        { access: 'restricted', allow: ['User'] }
      ]
      const result = service.isNotForbidden(policies)
      expect(result).toBe(true)
    })

    it('should return false if any policy is forbidden', () => {
      const policies: PolicyManifest[] = [
        { access: 'public' },
        { access: 'forbidden' }
      ]
      const result = service.isNotForbidden(policies)
      expect(result).toBe(false)
    })

    it('should return true if no policies are present', () => {
      const policies: PolicyManifest[] = []
      const result = service.isNotForbidden(policies)
      expect(result).toBe(true)
    })
  })
})

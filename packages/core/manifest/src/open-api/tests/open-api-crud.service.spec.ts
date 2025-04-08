import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiCrudService } from '../services/open-api-crud.service'
import { EntityManifest, PolicyManifest, PropType } from '@repo/types'
import { OpenApiUtilsService } from '../services/open-api-utils.service'

describe('OpenApiCrudService', () => {
  let service: OpenApiCrudService

  const dummyEntityManifest: EntityManifest = {
    className: 'Cat',
    nameSingular: 'cat',
    namePlural: 'cats',
    slug: 'cats',
    mainProp: 'name',
    seedCount: 50,
    relationships: [],
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

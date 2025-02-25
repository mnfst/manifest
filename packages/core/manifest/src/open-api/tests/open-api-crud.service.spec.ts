import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiCrudService } from '../services/open-api-crud.service'
import { EntityManifest, PropType } from '@repo/types'

describe('OpenApiCrudService', () => {
  let service: OpenApiCrudService

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
      providers: [OpenApiCrudService]
    }).compile()

    service = module.get<OpenApiCrudService>(OpenApiCrudService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

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

  it('should generate list path with a success response', () => {
    const path = service.generateListPath(dummyEntityManifest)

    expect(path).toBeDefined()
    expect(path).toMatchObject({
      get: {
        summary: expect.any(String),
        description: expect.any(String),
        tags: [expect.any(String)],
        parameters: expect.any(Array),
        responses: {
          '200': expect.any(Object)
        }
      }
    })
  })

  it('should generate list select options path with a success response', () => {
    const path = service.generateListSelectOptionsPath(dummyEntityManifest)

    expect(path).toBeDefined()
    expect(path).toMatchObject({
      get: {
        summary: expect.any(String),
        description: expect.any(String),
        tags: [expect.any(String)],
        responses: {
          '200': expect.any(Object)
        }
      }
    })
  })

  it('should generate create path with a success response', () => {
    const path = service.generateCreatePath(dummyEntityManifest)

    expect(path).toBeDefined()
    expect(path).toMatchObject({
      post: {
        summary: expect.any(String),
        description: expect.any(String),
        tags: [expect.any(String)],
        requestBody: expect.any(Object),
        responses: {
          '201': expect.any(Object)
        }
      }
    })
  })

  it('should generate detail path with a success response', () => {
    const path = service.generateDetailPath(dummyEntityManifest)

    expect(path).toBeDefined()
    expect(path).toMatchObject({
      get: {
        summary: expect.any(String),
        description: expect.any(String),
        tags: [expect.any(String)],
        parameters: expect.any(Array),
        responses: {
          '200': expect.any(Object)
        }
      }
    })
  })

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
        responses: {
          '200': expect.any(Object)
        }
      }
    })
  })

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
        responses: {
          '200': expect.any(Object)
        }
      }
    })
  })

  it('should generate delete path with a success response', () => {
    const path = service.generateDeletePath(dummyEntityManifest)

    expect(path).toBeDefined()
    expect(path).toMatchObject({
      delete: {
        summary: expect.any(String),
        description: expect.any(String),
        tags: [expect.any(String)],
        parameters: expect.any(Array),
        responses: {
          '200': expect.any(Object)
        }
      }
    })
  })
})

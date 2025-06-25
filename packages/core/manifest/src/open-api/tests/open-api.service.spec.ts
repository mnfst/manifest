import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiService } from '../services/open-api.service'
import { AppManifest, PropType } from '@repo/types'
import { OpenAPIObject } from '@nestjs/swagger'
import { OpenApiCrudService } from '../services/open-api-crud.service'
import { ManifestService } from '../../manifest/services/manifest.service'
import { OpenApiManifestService } from '../services/open-api-manifest.service'
import { OpenApiAuthService } from '../services/open-api-auth.service'
import { OpenApiEndpointService } from '../services/open-api.endpoint.service'

describe('OpenApiService', () => {
  let service: OpenApiService
  let openApiCrudService: OpenApiCrudService
  let openApiManifestService: OpenApiManifestService
  let openApiEndpointService: OpenApiEndpointService

  const dummyAppManifest: AppManifest = {
    name: 'Test App',
    version: '2.0.0',
    entities: {
      Invoice: {
        className: 'Invoice',
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
      } as any
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenApiService,
        {
          provide: OpenApiCrudService,
          useValue: {
            generateEntityPaths: jest.fn(() => {})
          }
        },
        {
          provide: OpenApiManifestService,
          useValue: {
            generateManifestPaths: jest.fn(() => {})
          }
        },
        {
          provide: ManifestService,
          useValue: {
            getAppManifest: jest.fn(() => dummyAppManifest)
          }
        },
        {
          provide: OpenApiAuthService,
          useValue: {
            generateAuthPaths: jest.fn(() => {}),
            getSecuritySchemes: jest.fn(() => {})
          }
        },
        {
          provide: OpenApiEndpointService,
          useValue: {
            generateEndpointPaths: jest.fn(() => {})
          }
        }
      ]
    }).compile()

    service = module.get<OpenApiService>(OpenApiService)
    openApiCrudService = module.get<OpenApiCrudService>(OpenApiCrudService)
    openApiManifestService = module.get<OpenApiManifestService>(
      OpenApiManifestService
    )
    openApiEndpointService = module.get<OpenApiEndpointService>(
      OpenApiEndpointService
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return an OpenAPIObject', () => {
    const openApiObject: OpenAPIObject = service.generateOpenApiObject()

    expect(openApiObject.openapi).toBe('3.1.0')
    expect(openApiObject.info.title).toBe(dummyAppManifest.name)
    expect(openApiObject.info.version).toBe(dummyAppManifest.version)
  })

  it('should generate the server URL based on the config', () => {
    return false // TODO: Implement this test
  })

  it('should generate paths for each entity', () => {
    jest.spyOn(openApiCrudService, 'generateEntityPaths')

    service.generateOpenApiObject()

    expect(openApiCrudService.generateEntityPaths).toHaveBeenCalledTimes(
      Object.keys(dummyAppManifest.entities).length
    )
  })

  it('should generate the manifest paths', () => {
    jest.spyOn(openApiManifestService, 'generateManifestPaths')

    service.generateOpenApiObject()

    expect(openApiManifestService.generateManifestPaths).toHaveBeenCalledWith(
      dummyAppManifest
    )
  })

  it('should generate the auth paths', () => {
    return false // TODO: Implement this test
  })

  it('should generate the endpoint paths', () => {
    return false // TODO: Implement this test
  })

  it('should generate the schemas for entities', () => {
    return false // TODO: Implement this test
  })

  it('should generate the general schemas', () => {
    return false // TODO: Implement this test
  })

  it('should include security schemes in the components', () => {
    return false // TODO: Implement this test
  })
})

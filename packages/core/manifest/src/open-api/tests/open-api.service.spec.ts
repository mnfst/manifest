import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiService } from '../services/open-api.service'
import { AppManifest, PropType } from '@repo/types'
import { OpenAPIObject } from '@nestjs/swagger'
import { OpenApiCrudService } from '../services/open-api-crud.service'
import { ManifestService } from '../../manifest/services/manifest.service'
import { OpenApiManifestService } from '../services/open-api-manifest.service'
import { OpenApiAuthService } from '../services/open-api-auth.service'
import { OpenApiEndpointService } from '../services/open-api.endpoint.service'
import { ConfigService } from '@nestjs/config'
import { OpenApiSchemaService } from '../services/open-api-schema.service'

describe('OpenApiService', () => {
  let service: OpenApiService
  let openApiCrudService: OpenApiCrudService
  let openApiManifestService: OpenApiManifestService
  let openApiAuthService: OpenApiAuthService
  let openApiEndpointService: OpenApiEndpointService
  let openApiSchemaService: OpenApiSchemaService
  let configService: ConfigService

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
        },
        {
          provide: OpenApiSchemaService,
          useValue: {
            generateEntitySchemas: jest.fn(() => ({})),
            getGeneralSchemas: jest.fn(() => ({}))
          }
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((prop: string) => {
              if (prop === 'baseUrl') return `http://localhost:1111`
              if (prop === 'nodeEnv') return 'development'
              if (prop === 'showOpenApiDocs') return true
            })
          }
        }
      ]
    }).compile()

    service = module.get<OpenApiService>(OpenApiService)
    openApiCrudService = module.get<OpenApiCrudService>(OpenApiCrudService)
    openApiManifestService = module.get<OpenApiManifestService>(
      OpenApiManifestService
    )
    openApiAuthService = module.get<OpenApiAuthService>(OpenApiAuthService)
    openApiEndpointService = module.get<OpenApiEndpointService>(
      OpenApiEndpointService
    )
    openApiSchemaService =
      module.get<OpenApiSchemaService>(OpenApiSchemaService)
    configService = module.get<ConfigService>(ConfigService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return an OpenAPIObject', () => {
    const openApiObject: OpenAPIObject = service.generateOpenApiObject([])

    expect(openApiObject.openapi).toBe('3.1.0')
    expect(openApiObject.info.title).toBe(dummyAppManifest.name)
    expect(openApiObject.info.version).toBe(dummyAppManifest.version)
  })

  it('should generate the server URL based on the config', () => {
    // Default to development server URL.
    const openApiObject: OpenAPIObject = service.generateOpenApiObject([])

    expect(openApiObject.servers).toBeDefined()
    expect(openApiObject.servers.length).toBe(1)
    expect(openApiObject.servers[0].url).toContain('/api')
    expect(openApiObject.servers[0].description).toContain('Development server')

    // Verify that the description is correct on production.
    jest.spyOn(configService, 'get').mockImplementation((prop: string) => {
      if (prop === 'baseUrl') return `https://api.example.com`
      if (prop === 'nodeEnv') return 'production'
      if (prop === 'showOpenApiDocs') return true
    })

    const productionOpenApiObject: OpenAPIObject =
      service.generateOpenApiObject([])
    expect(openApiObject.servers.length).toBe(1)
    expect(productionOpenApiObject.servers[0].description).toContain(
      'Production server'
    )
  })

  it('should generate paths for each entity', () => {
    jest.spyOn(openApiCrudService, 'generateEntityPaths')

    service.generateOpenApiObject([])

    expect(openApiCrudService.generateEntityPaths).toHaveBeenCalledTimes(
      Object.keys(dummyAppManifest.entities).length
    )
  })

  it('should generate the manifest paths', () => {
    jest.spyOn(openApiManifestService, 'generateManifestPaths')

    service.generateOpenApiObject([])

    expect(openApiManifestService.generateManifestPaths).toHaveBeenCalledWith(
      dummyAppManifest
    )
  })

  it('should generate the auth paths', () => {
    jest.spyOn(openApiAuthService, 'generateAuthPaths')

    service.generateOpenApiObject([])

    expect(openApiAuthService.generateAuthPaths).toHaveBeenCalledWith(
      dummyAppManifest
    )
  })

  it('should generate the endpoint paths', () => {
    jest.spyOn(openApiEndpointService, 'generateEndpointPaths')
    service.generateOpenApiObject([])

    expect(openApiEndpointService.generateEndpointPaths).toHaveBeenCalledWith(
      dummyAppManifest.endpoints
    )
  })

  it('should generate the schemas for entities', () => {
    jest.spyOn(openApiSchemaService, 'generateEntitySchemas')

    service.generateOpenApiObject([])

    expect(openApiSchemaService.generateEntitySchemas).toHaveBeenCalledWith([])
  })

  it('should generate the general schemas', () => {
    jest.spyOn(openApiSchemaService, 'getGeneralSchemas')

    service.generateOpenApiObject([])

    expect(openApiSchemaService.getGeneralSchemas).toHaveBeenCalled()
  })

  it('should include security schemes in the components', () => {
    jest.spyOn(openApiAuthService, 'getSecuritySchemes')

    service.generateOpenApiObject([])

    expect(openApiAuthService.getSecuritySchemes).toHaveBeenCalledWith(
      dummyAppManifest
    )
  })
})

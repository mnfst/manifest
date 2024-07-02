import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiService } from '../services/open-api.service'
import { AppManifest, EntityManifest, PropType } from '@mnfst/types'
import { OpenAPIObject } from '@nestjs/swagger'
import { OpenApiCrudService } from '../services/open-api-crud.service'
import { ManifestService } from '../../manifest/services/manifest/manifest.service'
import { OpenApiManifestService } from '../services/open-api-manifest.service'

describe('OpenApiService', () => {
  let service: OpenApiService
  let openApiCrudService: OpenApiCrudService
  let openApiManifestService: OpenApiManifestService

  const dummyAppManifest: AppManifest = {
    name: 'Test App',
    entities: {
      Invoice: {
        className: 'Invoice',
        properties: [
          {
            name: 'name',
            type: PropType.String
          }
        ],
        belongsTo: []
      }
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenApiService,
        {
          provide: OpenApiCrudService,
          useValue: {
            generateEntityPaths: jest.fn((entityManifest: EntityManifest) => {})
          }
        },
        {
          provide: OpenApiManifestService,
          useValue: {
            generateManifestPaths: jest.fn((appManifest: AppManifest) => {})
          }
        },
        {
          provide: ManifestService,
          useValue: {
            getAppManifest: jest.fn(() => dummyAppManifest)
          }
        }
      ]
    }).compile()

    service = module.get<OpenApiService>(OpenApiService)
    openApiCrudService = module.get<OpenApiCrudService>(OpenApiCrudService)
    openApiManifestService = module.get<OpenApiManifestService>(
      OpenApiManifestService
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return an OpenAPIObject', () => {
    const openApiObject: OpenAPIObject = service.generateOpenApiObject()

    expect(openApiObject.openapi).toBe('3.1.0')
    expect(openApiObject.info.title).toBe('Test App')
    expect(openApiObject.info.version).toBe('')
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
})

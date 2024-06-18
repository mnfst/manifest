import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiService } from '../services/open-api.service'
import { AppManifest, EntityManifest, PropType } from '@mnfst/types'
import { OpenAPIObject } from '@nestjs/swagger'
import { OpenApiCrudService } from '../services/open-api-crud.service'
import { ManifestService } from '../../manifest/services/manifest/manifest.service'

describe('OpenApiService', () => {
  let service: OpenApiService
  let openApiCrudService: OpenApiCrudService

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
          provide: ManifestService,
          useValue: {
            getAppManifest: jest.fn(() => dummyAppManifest)
          }
        }
      ]
    }).compile()

    service = module.get<OpenApiService>(OpenApiService)
    openApiCrudService = module.get<OpenApiCrudService>(OpenApiCrudService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return an OpenAPIObject', () => {
    const openApiObject: OpenAPIObject = service.generateOpenApiObject()

    expect(openApiObject.openapi).toBe('3.0.0')
    expect(openApiObject.info.title).toBe('Test App')
    expect(openApiObject.info.version).toBe('1.0.0')
    expect(openApiObject.paths).toEqual([])
  })

  it('should generate paths for each entity', () => {
    jest.spyOn(openApiCrudService, 'generateEntityPaths')

    service.generateOpenApiObject()

    expect(openApiCrudService.generateEntityPaths).toHaveBeenCalledTimes(
      Object.keys(dummyAppManifest.entities).length
    )
  })
})

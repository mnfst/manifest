import { Test, TestingModule } from '@nestjs/testing'
import { OpenApiEndpointService } from '../services/open-api.endpoint.service'
import { EndpointManifest } from '../../../../types/src'
import { ENDPOINTS_PATH } from '../../constants'
import { OpenApiUtilsService } from '../services/open-api-utils.service'

describe('OpenApiEndpointService', () => {
  let service: OpenApiEndpointService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenApiEndpointService,
        {
          provide: OpenApiUtilsService,
          useValue: { getSecurityRequirements: jest.fn() }
        }
      ]
    }).compile()

    service = module.get<OpenApiEndpointService>(OpenApiEndpointService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should generate the custom endpoint path', () => {
    const dummyEndpoint: EndpointManifest = {
      name: 'test',
      description: 'test',
      path: '/test',
      method: 'GET',
      handler: 'handler',
      policies: []
    }

    const paths = service.generateEndpointPaths([dummyEndpoint])

    const generatedPath = `/${ENDPOINTS_PATH}/test`

    expect(paths[generatedPath]).toBeDefined()
    expect(paths[generatedPath].get).toBeDefined()
  })

  it('should convert route params to OpenAPI format', () => {
    const endpointWithRouteParams: EndpointManifest = {
      name: 'test',
      description: 'test',
      path: '/users/:userId/comments/:commentId',
      method: 'GET',
      handler: 'handler',
      policies: []
    }

    const paths = service.generateEndpointPaths([endpointWithRouteParams])

    const generatedPath = `/${ENDPOINTS_PATH}/users/{userId}/comments/{commentId}`

    expect(paths[generatedPath]).toBeDefined()
    expect(paths[generatedPath].get).toBeDefined()
    expect(paths[generatedPath].get.parameters).toHaveLength(2)
  })
})

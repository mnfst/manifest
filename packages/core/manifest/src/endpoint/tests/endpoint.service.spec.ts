import { Test, TestingModule } from '@nestjs/testing'
import { EndpointService } from '../endpoint.service'
import { EndpointManifest } from '../../../../types/src'
import { PolicyService } from '../../policy/policy.service'

describe('EndpointService', () => {
  let service: EndpointService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EndpointService,
        {
          provide: PolicyService,
          useValue: {
            transformPolicies: jest.fn(() => [])
          }
        }
      ]
    }).compile()

    service = module.get<EndpointService>(EndpointService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('transformEndpointsSchemaObject', () => {
    it('should transform the endpoint schema object', () => {
      const dummyEndpointSchemaObject = {
        testEndpoint: {
          path: '/test',
          method: 'GET',
          handler: 'handler',
          policies: []
        }
      } as any

      const endpoints = service.transformEndpointsSchemaObject(
        dummyEndpointSchemaObject
      )

      expect(endpoints).toHaveLength(1)
      expect(endpoints[0]).toMatchObject({
        name: 'testEndpoint',
        path: '/test',
        method: 'GET',
        handler: 'handler',
        policies: []
      })
    })
  })

  describe('matchRoutePath', () => {
    it('should match the route path', () => {
      const dummyEndpoint: EndpointManifest = {
        name: 'test',
        description: 'test',
        path: '/test',
        method: 'GET',
        handler: 'handler',
        policies: []
      }

      const { endpoint, params } = service.matchRoutePath({
        path: '/test',
        method: 'GET',
        endpoints: [dummyEndpoint]
      })

      expect(endpoint).toEqual(dummyEndpoint)
      expect(params).toMatchObject({})
    })
  })

  it('should extract parameters from the path', () => {
    const dummyEndpoint: EndpointManifest = {
      name: 'test',
      description: 'test',
      path: '/author/:authorId/book/:bookId',
      method: 'POST',
      handler: 'handler',
      policies: []
    }

    const { endpoint, params } = service.matchRoutePath({
      path: '/author/1/book/2',
      method: 'POST',
      endpoints: [dummyEndpoint]
    })

    expect(endpoint).toEqual(dummyEndpoint)
    expect(params).toMatchObject({ authorId: '1', bookId: '2' })
  })
})

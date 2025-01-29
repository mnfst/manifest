import { Test, TestingModule } from '@nestjs/testing'
import { MatchEndpointMiddleware } from '../middlewares/match-endpoint.middleware'
import { EndpointService } from '../endpoint.service'
import { ManifestService } from '../../manifest/services/manifest.service'

describe('MatchEndpointMiddleware', () => {
  let middleware: MatchEndpointMiddleware

  const dummyEndpoint = {
    path: '/test/:id',
    method: 'GET'
  }
  const dummyParams = { id: '1' }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchEndpointMiddleware,
        {
          provide: EndpointService,
          useValue: {
            matchRoutePath: jest.fn(() => ({
              endpoint: dummyEndpoint,
              params: dummyParams
            }))
          }
        },
        {
          provide: ManifestService,
          useValue: {
            getAppManifest: jest.fn(() => ({
              endpoints: []
            }))
          }
        }
      ]
    }).compile()

    middleware = module.get<MatchEndpointMiddleware>(MatchEndpointMiddleware)
  })

  it('should be defined', () => {
    expect(middleware).toBeDefined()
  })

  it('should attach the endpoint and params to the request object', () => {
    const req = { path: '/api/endpoints/test/1', method: 'GET' } as any

    middleware.use(req, {} as any, () => {})

    expect(req['endpoint']).toEqual(dummyEndpoint)
    expect(req['params']).toEqual(dummyParams)
  })
})

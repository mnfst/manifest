import { Test, TestingModule } from '@nestjs/testing'
import { EndpointController } from '../endpoint.controller'
import { PolicyGuard } from '../../policy/policy.guard'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { HandlerService } from '../../handler/handler.service'
import { AuthService } from '../../auth/auth.service'
import { Request } from 'express'

describe('EndpointController', () => {
  let controller: EndpointController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EndpointController],
      providers: [
        {
          provide: PolicyGuard,
          useValue: {
            canActivate: jest.fn(() => true)
          }
        },
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn(() => ({}))
          }
        },
        {
          provide: AuthService,
          useValue: {
            getUserFromRequest: jest.fn(() => ({}))
          }
        },
        {
          provide: HandlerService,
          useValue: {
            trigger: jest.fn(() => ({
              status: 200
            }))
          }
        }
      ]
    }).compile()

    controller = module.get<EndpointController>(EndpointController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('should trigger the endpoint on GET, POST, PUT, PATCH and DELETE methods', async () => {
    const req = {
      endpoint: {
        handler: 'test'
      }
    } as any

    const res = {} as any

    const getResult = await controller.triggerGetEndpoint(req, res)
    const postResult = await controller.triggerPostEndpoint(req, res)
    const putResult = await controller.triggerPutEndpoint(req, res)
    const patchResult = await controller.triggerPatchEndpoint(req, res)
    const deleteResult = await controller.triggerDeleteEndpoint(req, res)

    expect(getResult).toEqual({ status: 200 })
    expect(postResult).toEqual({ status: 200 })
    expect(putResult).toEqual({ status: 200 })
    expect(patchResult).toEqual({ status: 200 })
    expect(deleteResult).toEqual({ status: 200 })
  })

  it('should throw an error if no endpoint is found', () => {
    const req = {} as Partial<Request>

    expect(() =>
      controller.triggerGetEndpoint(req as Request, {} as any)
    ).toThrow()
  })
})

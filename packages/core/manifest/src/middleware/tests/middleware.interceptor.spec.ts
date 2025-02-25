import { Test, TestingModule } from '@nestjs/testing'
import { EventService } from '../../event/event.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { MiddlewareInterceptor } from '../middleware.interceptor'
import { HandlerService } from '../../handler/handler.service'
import { EntityManifest } from '../../../../types/src'

describe('MiddlewareInterceptor', () => {
  let interceptor: MiddlewareInterceptor
  let eventService: EventService
  let entityManifestService: EntityManifestService
  let handlerService: HandlerService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MiddlewareInterceptor,
        {
          provide: EventService,
          useValue: {
            getRelatedCrudEvent: jest.fn(() => 'beforeCreate')
          }
        },
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn(
              () =>
                ({
                  middlewares: {
                    beforeCreate: [
                      {
                        handler: 'my-handler'
                      }
                    ]
                  }
                }) as Partial<EntityManifest>
            )
          }
        },
        {
          provide: HandlerService,
          useValue: {
            trigger: jest.fn()
          }
        }
      ]
    }).compile()

    interceptor = module.get<MiddlewareInterceptor>(MiddlewareInterceptor)
    eventService = module.get<EventService>(EventService)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
    handlerService = module.get<HandlerService>(HandlerService)
  })

  it('should be defined', () => {
    expect(
      new MiddlewareInterceptor(
        eventService,
        entityManifestService,
        handlerService
      )
    ).toBeDefined()
  })

  it('should trigger handlers', () => {
    const context = {
      getHandler: jest.fn(() => ({ name: 'store' })),
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => {}),
        getResponse: jest.fn(() => {})
      })),
      getArgs: jest.fn(() => [
        {
          params: {
            entity: 'users'
          }
        }
      ])
    }

    interceptor.intercept(context as any, {
      handle: jest.fn(
        () =>
          ({
            pipe: jest.fn(() => ({
              toPromise: jest.fn()
            }))
          }) as any
      )
    })

    expect(handlerService.trigger).toHaveBeenCalledWith({
      path: 'my-handler',
      req: context.switchToHttp().getRequest(),
      res: context.switchToHttp().getResponse()
    })
  })
})

import { Test, TestingModule } from '@nestjs/testing'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { HookInterceptor } from '../hook.interceptor'
import { HookService } from '../hook.service'
import { EntityManifest } from '../../../../types/src'

describe('HookInterceptor', () => {
  let interceptor: HookInterceptor
  let entityManifestService: EntityManifestService
  let hookService: HookService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HookInterceptor,
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn(
              () =>
                ({
                  hooks: {
                    beforeCreate: [
                      {
                        url: 'http://web.hook'
                      }
                    ]
                  }
                }) as Partial<EntityManifest>
            )
          }
        },
        {
          provide: HookService,
          useValue: {
            triggerWebhook: jest.fn(() => Promise.resolve())
          }
        }
      ]
    }).compile()

    interceptor = module.get<HookInterceptor>(HookInterceptor)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
    hookService = module.get<HookService>(HookService)
  })

  it('should be defined', () => {
    expect(
      new HookInterceptor(entityManifestService, hookService)
    ).toBeDefined()
  })

  it('should trigger webhooks', () => {
    const context = {
      getHandler: jest.fn(() => ({ name: 'store' })),
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => ({
          params: {
            entity: 'users',
            id: '1'
          },
          body: {
            name: 'John Doe'
          }
        }))
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

    expect(hookService.triggerWebhook).toHaveBeenCalledWith(
      {
        url: 'http://web.hook'
      },
      'users',
      {
        name: 'John Doe'
      }
    )
  })
})

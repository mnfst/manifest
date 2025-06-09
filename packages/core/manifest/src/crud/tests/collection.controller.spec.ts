import { Test, TestingModule } from '@nestjs/testing'
import { CollectionController } from '../controllers/collection.controller'
import { AuthService } from '../../auth/auth.service'
import { CrudService } from '../services/crud.service'
import { IsCollectionGuard } from '../guards/is-collection.guard'
import { PolicyGuard } from '../../policy/policy.guard'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { HookInterceptor } from '../../hook/hook.interceptor'
import { HookService } from '../../hook/hook.service'
import { EventService } from '../../event/event.service'
import { HandlerService } from '../../handler/handler.service'

describe('CollectionController', () => {
  let controller: CollectionController
  let crudService: CrudService

  const randomUuid: string = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            isReqUserAdmin: jest.fn(() => Promise.resolve(false))
          }
        },
        {
          provide: CrudService,
          useValue: {
            findOne: jest.fn(),
            findAll: jest.fn(),
            findSelectOptions: jest.fn(),
            store: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
          }
        },
        {
          provide: IsCollectionGuard,
          useValue: {
            canActivate: jest.fn()
          }
        },
        {
          provide: PolicyGuard,
          useValue: {
            canActivate: jest.fn()
          }
        },
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        },
        {
          provide: HookInterceptor,
          useValue: {
            intercept: jest.fn()
          }
        },
        {
          provide: HookService,
          useValue: {
            triggerWebhook: jest.fn()
          }
        },
        {
          provide: EventService,
          useValue: {
            getRelatedCrudEvent: jest.fn()
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

    controller = module.get<CollectionController>(CollectionController)
    crudService = module.get<CrudService>(CrudService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('should call crudService.findAll', async () => {
    const entitySlug = 'cats'
    const queryParams = {}
    const req = {} as any

    await controller.findAll(entitySlug, queryParams, req)

    expect(crudService.findAll).toHaveBeenCalledWith({
      entitySlug,
      queryParams,
      fullVersion: false
    })
  })

  it('should call crudService.findSelectOptions', async () => {
    const entitySlug = 'cats'
    const queryParams = {}

    await controller.findSelectOptions(entitySlug, queryParams)

    expect(crudService.findSelectOptions).toHaveBeenCalledWith({
      entitySlug,
      queryParams
    })
  })

  it('should call crudService.findOne', async () => {
    const entitySlug = 'cats'

    const queryParams = {}
    const req = {} as any

    await controller.findOne(entitySlug, randomUuid, queryParams, req)

    expect(crudService.findOne).toHaveBeenCalledWith({
      entitySlug,
      id: randomUuid,
      queryParams,
      fullVersion: false
    })
  })

  it('should call crudService.store', async () => {
    const entity = 'cats'
    const itemDto = {}

    await controller.store(entity, itemDto)

    expect(crudService.store).toHaveBeenCalledWith(entity, itemDto)
  })

  it('should call crudService.update', async () => {
    const entitySlug = 'cats'

    const itemDto = {}

    await controller.put(entitySlug, randomUuid, itemDto)

    expect(crudService.update).toHaveBeenCalledWith({
      entitySlug,
      id: randomUuid,
      itemDto: itemDto
    })
  })

  it('should call crudService.update with partialReplacement', async () => {
    const entitySlug = 'cats'

    const itemDto = {}

    await controller.patch(entitySlug, randomUuid, itemDto)

    expect(crudService.update).toHaveBeenCalledWith({
      entitySlug,
      id: randomUuid,
      itemDto: itemDto,
      partialReplacement: true
    })
  })

  it('should call crudService.delete', async () => {
    const entitySlug = 'cats'

    await controller.delete(entitySlug, randomUuid)

    expect(crudService.delete).toHaveBeenCalledWith(entitySlug, randomUuid)
  })
})

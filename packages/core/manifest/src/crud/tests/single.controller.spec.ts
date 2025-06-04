import { Test, TestingModule } from '@nestjs/testing'
import { SingleController } from '../controllers/single.controller'
import { AuthService } from '../../auth/auth.service'
import { CrudService } from '../services/crud.service'
import { IsSingleGuard } from '../guards/is-single.guard'
import { PolicyGuard } from '../../policy/policy.guard'
import { NotFoundException } from '@nestjs/common'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { HookInterceptor } from '../../hook/hook.interceptor'
import { HookService } from '../../hook/hook.service'
import { EventService } from '../../event/event.service'
import { HandlerService } from '../../handler/handler.service'

describe('SingleController', () => {
  let controller: SingleController
  let crudService: CrudService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SingleController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            isReqUserAdmin: jest.fn()
          }
        },
        {
          provide: CrudService,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
            storeEmpty: jest.fn()
          }
        },
        {
          provide: IsSingleGuard,
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

    controller = module.get<SingleController>(SingleController)
    crudService = module.get<CrudService>(CrudService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('GET :entity', () => {
    it('should return the record as a JSON object', async () => {
      jest.spyOn(crudService, 'findOne').mockReturnValue(
        Promise.resolve({
          id: 1,
          name: 'test'
        } as any)
      )

      const res = await controller.findOne({ entity: 'test' } as any, {} as any)

      expect(res).toEqual({
        id: 1,
        name: 'test'
      })
    })

    it('should create a new blank record if the record is not found', async () => {
      const emptyRecord = {
        id: 1,
        name: ''
      } as any

      jest.spyOn(crudService, 'findOne').mockImplementation(() => {
        throw new NotFoundException('Record not found')
      })
      jest
        .spyOn(crudService, 'storeEmpty')
        .mockReturnValue(Promise.resolve(emptyRecord))

      const res = await controller.findOne('test', {} as any)

      expect(jest.spyOn(crudService, 'storeEmpty')).toHaveBeenCalledWith('test')
      expect(res).toEqual(emptyRecord)
    })
  })

  describe('PUT :entity', () => {
    it('should call crudService.update', async () => {
      const entitySlug = 'test'
      const itemDto = { name: 'test' }

      await controller.put(entitySlug, itemDto as any)

      expect(crudService.update).toHaveBeenCalledWith({
        entitySlug,
        itemDto
      })
    })
  })

  describe('PATCH :entity', () => {
    it('should call crudService.update and partialReplacement true', async () => {
      const entitySlug = 'test'
      const itemDto = { name: 'test' }

      await controller.patch(entitySlug, itemDto as any)

      expect(crudService.update).toHaveBeenCalledWith({
        entitySlug,
        itemDto,
        partialReplacement: true
      })
    })
  })
})

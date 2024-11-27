import { Test, TestingModule } from '@nestjs/testing'
import { SingleController } from '../controllers/single.controller'
import { AuthService } from '../../auth/auth.service'
import { CrudService } from '../services/crud.service'
import { IsSingleGuard } from '../guards/is-single.guard'
import { AuthorizationGuard } from '../../auth/guards/authorization.guard'
import { ManifestService } from '../../manifest/services/manifest.service'
import { NotFoundException } from '@nestjs/common'

describe('SingleController', () => {
  let controller: SingleController
  let crudService: CrudService
  let authService: AuthService

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
          provide: AuthorizationGuard,
          useValue: {
            canActivate: jest.fn()
          }
        },
        {
          provide: ManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        }
      ]
    }).compile()

    controller = module.get<SingleController>(SingleController)
    crudService = module.get<CrudService>(CrudService)
    authService = module.get<AuthService>(AuthService)
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
})

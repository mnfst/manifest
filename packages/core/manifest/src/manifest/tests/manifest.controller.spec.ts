import { Test, TestingModule } from '@nestjs/testing'
import { ManifestController } from '../controllers/manifest.controller'
import { ManifestService } from '../services/manifest.service'
import { AuthService } from '../../auth/auth.service'
import { EntityManifestService } from '../services/entity-manifest.service'
import { AppManifest, EntityManifest, Manifest } from '@repo/types'
import { Request } from 'express'
import { PUBLIC_ACCESS_POLICY } from '../../constants'

describe('ManifestController', () => {
  let controller: ManifestController
  let authService: AuthService
  let manifestService: ManifestService
  let entityManifestService: EntityManifestService

  const dummyManifest: AppManifest = {
    name: 'Test App'
  }

  const dummyEntityManifest: EntityManifest = {
    name: 'Test Entity',
    policies: [PUBLIC_ACCESS_POLICY]
  } as any

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManifestController],
      providers: [
        {
          provide: ManifestService,
          useValue: {
            getAppManifest: jest.fn(() => dummyManifest)
          }
        },
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn(() => dummyEntityManifest)
          }
        },
        {
          provide: AuthService,
          useValue: {
            isReqUserAdmin: jest.fn()
          }
        }
      ]
    }).compile()

    controller = module.get<ManifestController>(ManifestController)
    authService = module.get<AuthService>(AuthService)
    manifestService = module.get<ManifestService>(ManifestService)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('should get the app manifest', async () => {
    const manifest: Manifest = await controller.getAppManifest({} as Request)

    expect(manifest).toEqual(dummyManifest)
  })

  it('should get the full version of the app manifest if the user is an admin', async () => {
    jest.spyOn(authService, 'isReqUserAdmin').mockResolvedValue(true)

    const manifest: Manifest = await controller.getAppManifest({} as Request)

    expect(manifest).toEqual(dummyManifest)
    expect(manifestService.getAppManifest).toHaveBeenCalledWith({
      fullVersion: true
    })
  })

  it('should get the entity manifest', async () => {
    const entityManifest: EntityManifest = await controller.getEntityManifest(
      'dummy',
      {} as Request
    )

    expect(entityManifest).toEqual(dummyEntityManifest)
  })
})

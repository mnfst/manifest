import { Test } from '@nestjs/testing'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { IsSingleGuard } from '../guards/is-single.guard'
import { EntityManifest } from '@repo/types'
import { ExecutionContext } from '@nestjs/common'

describe('IsSingleGuard', () => {
  let entityManifestService: EntityManifestService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IsSingleGuard,
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        }
      ]
    }).compile()

    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
  })

  it('should be defined', () => {
    expect(new IsSingleGuard(entityManifestService)).toBeDefined()
  })

  it('should return true if the entity is a single', () => {
    jest.spyOn(entityManifestService, 'getEntityManifest').mockReturnValue({
      single: true
    } as EntityManifest)

    const isSingleGuard = new IsSingleGuard(entityManifestService)
    const res = isSingleGuard.canActivate({
      getArgs: () => [{ params: { entity: 'test' } }]
    } as ExecutionContext)

    expect(res).toBe(true)
  })

  it('should return false if the entity is not a single', () => {
    jest.spyOn(entityManifestService, 'getEntityManifest').mockReturnValue({
      single: false
    } as EntityManifest)

    const isSingleGuard = new IsSingleGuard(entityManifestService)
    const res = isSingleGuard.canActivate({
      getArgs: () => [{ params: { entity: 'test' } }]
    } as ExecutionContext)

    expect(res).toBe(false)
  })
})

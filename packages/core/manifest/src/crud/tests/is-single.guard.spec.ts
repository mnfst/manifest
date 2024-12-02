import { Test } from '@nestjs/testing'
import { ManifestService } from '../../manifest/services/manifest.service'
import { IsSingleGuard } from '../guards/is-single.guard'
import { EntityManifest } from '@repo/types'
import { ExecutionContext } from '@nestjs/common'

describe('IsSingleGuard', () => {
  let manifestService: ManifestService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IsSingleGuard,
        {
          provide: ManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        }
      ]
    }).compile()

    manifestService = module.get<ManifestService>(ManifestService)
  })

  it('should be defined', () => {
    expect(new IsSingleGuard(manifestService)).toBeDefined()
  })

  it('should return true if the entity is a single', () => {
    jest.spyOn(manifestService, 'getEntityManifest').mockReturnValue({
      single: true
    } as EntityManifest)

    const isSingleGuard = new IsSingleGuard(manifestService)
    const res = isSingleGuard.canActivate({
      getArgs: () => [{ params: { entity: 'test' } }]
    } as ExecutionContext)

    expect(res).toBe(true)
  })

  it('should return false if the entity is not a single', () => {
    jest.spyOn(manifestService, 'getEntityManifest').mockReturnValue({
      single: false
    } as EntityManifest)

    const isSingleGuard = new IsSingleGuard(manifestService)
    const res = isSingleGuard.canActivate({
      getArgs: () => [{ params: { entity: 'test' } }]
    } as ExecutionContext)

    expect(res).toBe(false)
  })
})

import { Test } from '@nestjs/testing'
import { ManifestService } from '../../manifest/services/manifest.service'
import { IsCollectionGuard } from '../guards/is-collection.guard'
import { EntityManifest } from '@repo/types'
import { ExecutionContext } from '@nestjs/common'

describe('IsCollectionGuard', () => {
  let manifestService: ManifestService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IsCollectionGuard,
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
    expect(new IsCollectionGuard(manifestService)).toBeDefined()
  })

  it('should return true if the entity is a collection', () => {
    jest.spyOn(manifestService, 'getEntityManifest').mockReturnValue({
      single: false
    } as EntityManifest)

    const isCollectionGuard = new IsCollectionGuard(manifestService)
    const res = isCollectionGuard.canActivate({
      getArgs: () => [{ params: { entity: 'test' } }]
    } as ExecutionContext)

    expect(res).toBe(true)
  })

  it('should return false if the entity is not a collection', () => {
    jest.spyOn(manifestService, 'getEntityManifest').mockReturnValue({
      single: true
    } as EntityManifest)

    const isCollectionGuard = new IsCollectionGuard(manifestService)
    const res = isCollectionGuard.canActivate({
      getArgs: () => [{ params: { entity: 'test' } }]
    } as ExecutionContext)

    expect(res).toBe(false)
  })
})

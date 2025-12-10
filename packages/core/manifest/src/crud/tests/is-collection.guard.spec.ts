import { Test } from '@nestjs/testing'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { IsCollectionGuard } from '../guards/is-collection.guard'
import { EntityManifest } from '@repo/types'
import { ExecutionContext } from '@nestjs/common'

describe('IsCollectionGuard', () => {
  let entityManifestService: EntityManifestService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IsCollectionGuard,
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
    expect(new IsCollectionGuard(entityManifestService)).toBeDefined()
  })

  it('should return true if the entity is a collection', () => {
    jest.spyOn(entityManifestService, 'getEntityManifest').mockReturnValue({
      single: false
    } as EntityManifest)

    const isCollectionGuard = new IsCollectionGuard(entityManifestService)
    const res = isCollectionGuard.canActivate({
      getArgs: () => [{ params: { entity: 'test' } }]
    } as ExecutionContext)

    expect(res).toBe(true)
  })

  it('should return false if the entity is not a collection', () => {
    jest.spyOn(entityManifestService, 'getEntityManifest').mockReturnValue({
      single: true
    } as EntityManifest)

    const isCollectionGuard = new IsCollectionGuard(entityManifestService)
    const res = isCollectionGuard.canActivate({
      getArgs: () => [{ params: { entity: 'test' } }]
    } as ExecutionContext)

    expect(res).toBe(false)
  })
})

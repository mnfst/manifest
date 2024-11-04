import { Test } from '@nestjs/testing'
import { IsDbEmptyGuard } from '../guards/is-db-empty.guard'
import { ManifestService } from '../../manifest/services/manifest.service'
import { EntityService } from '../../entity/services/entity.service'

describe('IsDbEmptyGuard', () => {
  let manifestService: ManifestService
  let entityService: EntityService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        IsDbEmptyGuard,
        {
          provide: ManifestService,
          useValue: {
            getAppManifest: jest.fn().mockReturnValue({
              entities: {}
            })
          }
        },
        {
          provide: EntityService,
          useValue: {
            getEntityRepository: jest.fn().mockReturnValue({
              createQueryBuilder: jest.fn().mockReturnValue({
                getCount: jest.fn().mockReturnValue(0)
              })
            })
          }
        }
      ]
    }).compile()

    manifestService = module.get<ManifestService>(ManifestService)
    entityService = module.get<EntityService>(EntityService)
  })

  it('should be defined', () => {
    expect(new IsDbEmptyGuard(manifestService, entityService)).toBeDefined()
  })

  it('should return true if the database is empty', async () => {
    const isDbEmptyGuard = new IsDbEmptyGuard(manifestService, entityService)
    const res = await isDbEmptyGuard.canActivate()

    expect(res).toBe(true)
  })

  it('should return false if the database is not empty', async () => {
    jest.spyOn(entityService, 'getEntityRepository').mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        getCount: jest.fn().mockReturnValue(1)
      })
    } as any)

    const isDbEmptyGuard = new IsDbEmptyGuard(manifestService, entityService)
    const res = await isDbEmptyGuard.canActivate()

    expect(res).toBe(false)
  })
})

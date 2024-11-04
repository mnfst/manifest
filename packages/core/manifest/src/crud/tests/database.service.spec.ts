import { Test } from '@nestjs/testing'
import { DatabaseService } from '../services/database.service'
import { ManifestService } from '../../manifest/services/manifest.service'
import { EntityService } from '../../entity/services/entity.service'

describe('DatabaseService', () => {
  let manifestService: ManifestService
  let entityService: EntityService
  let service: DatabaseService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DatabaseService,
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
    service = module.get<DatabaseService>(DatabaseService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should return true if the database is empty', async () => {
    const res = await service.isDbEmpty()

    expect(res).toBe(true)
  })

  it('should return false if the database is not empty', async () => {
    jest.spyOn(entityService, 'getEntityRepository').mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        getCount: jest.fn().mockReturnValue(1)
      })
    } as any)

    const res = await service.isDbEmpty()

    expect(res).toBe(false)
  })
})

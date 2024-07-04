import { Test, TestingModule } from '@nestjs/testing'
import { EntityService } from './entity.service'
import { ManifestService } from '../../../manifest/services/manifest/manifest.service'
import { DataSource } from 'typeorm'

describe('EntityService', () => {
  let service: EntityService
  let dataSource: DataSource

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityService,
        {
          provide: ManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        },
        {
          provide: DataSource,
          useValue: {
            entityMetadatas: [],
            getRepository: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<EntityService>(EntityService)
    dataSource = module.get<DataSource>(DataSource)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getEntityRepository', () => {
    it('should fail if no entity metadata or entity slug is provided', () => {
      expect(() => {
        service.getEntityRepository({})
      }).toThrow()
    })

    it('should return a repository', () => {
      const entityMetadata = {
        target: 'Entity'
      } as any

      const result = service.getEntityRepository({
        entityMetadata
      })

      expect(dataSource.getRepository).toHaveBeenCalledWith('Entity')
    })
  })
})

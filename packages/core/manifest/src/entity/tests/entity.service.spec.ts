import { Test, TestingModule } from '@nestjs/testing'
import { EntityService } from '../services/entity.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { DataSource } from 'typeorm'

describe('EntityService', () => {
  let service: EntityService
  let dataSource: DataSource
  let entityManifestService: EntityManifestService

  const entityMetadatas = [
    {
      targetName: 'Entity',
      columns: []
    }
  ]

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityService,
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        },
        {
          provide: DataSource,
          useValue: {
            entityMetadatas,
            getRepository: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<EntityService>(EntityService)
    dataSource = module.get<DataSource>(DataSource)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getEntityMetadatas', () => {
    it('should get entity metadatas in the correct order', () => {
      jest.spyOn(service, 'sortEntitiesByHierarchy')

      service.getEntityMetadatas()

      expect(service.sortEntitiesByHierarchy).toHaveBeenCalledWith(
        entityMetadatas
      )
    })
  })

  describe('getEntityMetadata', () => {
    it('should fail if no className or slug is provided', () => {
      expect(() => service.getEntityMetadata({})).toThrowError()
    })

    it('should get entity metadata by className', () => {
      const result = service.getEntityMetadata({
        className: 'Entity'
      })

      expect(entityManifestService.getEntityManifest).not.toHaveBeenCalled()
      expect(result.targetName).toBe('Entity')
    })

    it('should get entity metadata by slug', () => {
      jest.spyOn(entityManifestService, 'getEntityManifest').mockReturnValue({
        className: 'Entity'
      } as any)

      const result = service.getEntityMetadata({
        slug: 'entity'
      })

      expect(entityManifestService.getEntityManifest).toHaveBeenCalledWith({
        slug: 'entity',
        fullVersion: true
      })

      expect(result.targetName).toBe('Entity')
    })

    it('should fail if no entity metadata is found', () => {
      jest.spyOn(entityManifestService, 'getEntityManifest').mockReturnValue({
        className: 'AnotherEntity'
      } as any)

      expect(() =>
        service.getEntityMetadata({
          slug: 'entity'
        })
      ).toThrow()
    })
  })

  describe('getEntityRepository', () => {
    it('should return a repository', () => {
      const entityMetadata = {
        target: 'Entity'
      } as any

      service.getEntityRepository({
        entityMetadata
      })

      expect(dataSource.getRepository).toHaveBeenCalledWith('Entity')
    })
  })
})

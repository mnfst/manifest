// TODO: Ensure that the storeFile and storeImage methods are only called once per property.
import { Test, TestingModule } from '@nestjs/testing'

import { SeederService } from '../services/seeder.service'
import { EntityService } from '../../entity/services/entity.service'
import { RelationshipService } from '../../entity/services/relationship.service'
import { DataSource, EntityMetadata } from 'typeorm'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { StorageService } from '../../storage/services/storage.service'

describe('SeederService', () => {
  let service: SeederService
  let storageService: StorageService
  let entityManifestService: EntityManifestService
  let entityService: EntityService
  let relationshipService: RelationshipService
  let dataSource: DataSource

  const dummyEntityMetadatas: EntityMetadata[] = [
    {
      tableName: 'table1'
    },
    {
      tableName: 'table2'
    }
  ] as EntityMetadata[]

  const queryRunner: any = {
    query: jest.fn(() => Promise.resolve())
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeederService,
        {
          provide: EntityService,
          useValue: {
            createEntity: jest.fn(),
            getEntityMetadatas: jest.fn(() => dummyEntityMetadatas)
          }
        },
        {
          provide: RelationshipService,
          useValue: {
            createEntityRelationships: jest.fn()
          }
        },
        {
          provide: StorageService,
          useValue: {
            store: jest.fn()
          }
        },
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        },
        {
          provide: DataSource,
          useValue: {
            getRepository: jest.fn(),
            createQueryRunner: jest.fn(() => queryRunner)
          }
        }
      ]
    }).compile()

    service = module.get<SeederService>(SeederService)
    storageService = module.get<StorageService>(StorageService)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
    entityService = module.get<EntityService>(EntityService)
    relationshipService = module.get<RelationshipService>(RelationshipService)
    dataSource = module.get<DataSource>(DataSource)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('seed', () => {
    it('should truncate all tables escaping table names', async () => {
      jest.spyOn(dataSource, 'createQueryRunner').mockReturnValue(queryRunner)

      await service.seed()

      dummyEntityMetadatas.forEach((entityMetadata) => {
        expect(queryRunner.query).toHaveBeenCalledWith(
          `DELETE FROM [${entityMetadata.tableName}]`
        )
      })
    })
  })
})

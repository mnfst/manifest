// TODO: Ensure that the storeFile and storeImage methods are only called once per property.
import { Test, TestingModule } from '@nestjs/testing'
import { StorageService } from '../../storage/services/storage/storage.service'
import { ManifestService } from '../../manifest/services/manifest.service'
import { SeederService } from '../services/seeder.service'
import { EntityService } from '../../entity/services/entity.service'
import { RelationshipService } from '../../entity/services/relationship.service'
import { DataSource } from 'typeorm'

describe('SeederService', () => {
  let service: SeederService
  let storageService: StorageService
  let manifestService: ManifestService
  let entityService: EntityService
  let relationshipService: RelationshipService
  let dataSource: DataSource

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeederService,
        {
          provide: EntityService,
          useValue: {
            createEntity: jest.fn()
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
          provide: ManifestService,
          useValue: {
            getEntityManifest: jest.fn()
          }
        },
        {
          provide: DataSource,
          useValue: {
            getRepository: jest.fn()
          }
        }
      ]
    }).compile()

    service = module.get<SeederService>(SeederService)
    storageService = module.get<StorageService>(StorageService)
    manifestService = module.get<ManifestService>(ManifestService)
    entityService = module.get<EntityService>(EntityService)
    relationshipService = module.get<RelationshipService>(RelationshipService)
    dataSource = module.get<DataSource>(DataSource)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

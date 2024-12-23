// TODO: Ensure that the storeFile and storeImage methods are only called once per property.
import { Test, TestingModule } from '@nestjs/testing'
import { StorageService } from '../../storage/services/storage/storage.service'
import { SeederService } from '../services/seeder.service'
import { EntityService } from '../../entity/services/entity.service'
import { RelationshipService } from '../../entity/services/relationship.service'
import { DataSource } from 'typeorm'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'

describe('SeederService', () => {
  let service: SeederService
  let storageService: StorageService
  let entityManifestService: EntityManifestService
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
          provide: EntityManifestService,
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
})

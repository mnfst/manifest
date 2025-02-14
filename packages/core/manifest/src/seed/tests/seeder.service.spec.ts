// TODO: Ensure that the storeFile and storeImage methods are only called once per property.
import { Test, TestingModule } from '@nestjs/testing'
import { SHA3 } from 'crypto-js'

import { SeederService } from '../services/seeder.service'
import { EntityService } from '../../entity/services/entity.service'
import { RelationshipService } from '../../entity/services/relationship.service'
import { DataSource, EntityMetadata } from 'typeorm'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { StorageService } from '../../storage/services/storage.service'
import { DEFAULT_ADMIN_CREDENTIALS, DEFAULT_IMAGE_SIZES } from '../../constants'
import { PropType } from '../../../../types/src'

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockResolvedValue('mock file content')
}))

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

  const dummyFilePath = 'test.pdf'

  const dummyImage: { [key: string]: string } = {
    thumbnail: 'test.jpg'
  }

  const queryRunner: any = {
    query: jest.fn(() => Promise.resolve())
  }

  beforeAll(() => {})

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
            store: jest.fn(() => dummyFilePath),
            storeImage: jest.fn(() => dummyImage)
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
            options: { type: 'sqlite' },
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

    it('should restart auto-increment sequences on postgres', async () => {
      ;(dataSource.options as any).type = 'postgres'

      await service.seed()

      dummyEntityMetadatas.forEach((entityMetadata) => {
        expect(queryRunner.query).toHaveBeenCalledWith(
          `TRUNCATE TABLE "${entityMetadata.tableName}" CASCADE`
        )
      })

      dummyEntityMetadatas.forEach((entityMetadata) => {
        expect(queryRunner.query).toHaveBeenCalledWith(
          `ALTER SEQUENCE "${entityMetadata.tableName}_id_seq" RESTART WITH 1`
        )
      })
    })
  })

  describe('seedProperty', () => {
    it('should seed a string', async () => {
      const result = await service.seedProperty(
        { type: PropType.String } as any,
        {} as any
      )

      expect(typeof result).toBe('string')
    })

    it('should seed a number', async () => {
      const result = await service.seedProperty(
        { type: PropType.Number } as any,
        {} as any
      )

      expect(typeof result).toBe('number')
    })

    it('should seed a link', async () => {
      const result = await service.seedProperty(
        { type: PropType.Link } as any,
        {} as any
      )

      expect(typeof result).toBe('string')
      expect(result).toContain('http')
    })

    it('should seed a text', async () => {
      const result = await service.seedProperty(
        { type: PropType.Text } as any,
        {} as any
      )

      expect(typeof result).toBe('string')
    })

    it('should seed a rich text', async () => {
      const result = await service.seedProperty(
        { type: PropType.RichText } as any,
        {} as any
      )

      expect(typeof result).toBe('string')
      expect(result).toContain('<p>')
    })

    it('should seed a money', async () => {
      const result = (await service.seedProperty(
        { type: PropType.Money } as any,
        {} as any
      )) as string

      expect(typeof result).toBe('string')
      expect(result.split('.')[1].length).toBe(2)
    })

    it('should seed a date', async () => {
      const result = await service.seedProperty(
        { type: PropType.Date } as any,
        {} as any
      )

      expect(result).toBeInstanceOf(Date)
    })

    it('should seed a timestamp', async () => {
      const result = await service.seedProperty(
        { type: PropType.Timestamp } as any,
        {} as any
      )

      expect(result).toBeInstanceOf(Date)
    })
    it('should seed an email', async () => {
      const result = await service.seedProperty(
        { type: PropType.Email } as any,
        {} as any
      )

      expect(typeof result).toBe('string')
      expect(result).toContain('@')
    })
    it('should seed a boolean', async () => {
      const result = await service.seedProperty(
        { type: PropType.Boolean } as any,
        {} as any
      )

      expect(typeof result).toBe('boolean')
    })
    it('should seed the "manifest" password', async () => {
      const result = await service.seedProperty(
        { type: PropType.Password } as any,
        {} as any
      )

      expect(typeof result).toBe('string')
      expect(result).toBe(SHA3('manifest').toString())
    })
    it('should seed a choice', async () => {
      const result = await service.seedProperty(
        { type: PropType.Choice, options: { values: ['a', 'b', 'c'] } } as any,
        {} as any
      )

      expect(result).toMatch(/a|b|c/)
    })
    it('should seed a location', async () => {
      const result = await service.seedProperty(
        { type: PropType.Location } as any,
        {} as any
      )

      expect(result).toMatchObject({
        lat: expect.any(Number),
        lng: expect.any(Number)
      })
    })

    it('should seed a file', async () => {
      jest
        .spyOn(service, 'seedFile')
        .mockReturnValue(Promise.resolve(dummyFilePath))

      const result = await service.seedProperty(
        { type: PropType.File, name: 'file' } as any,
        { slug: 'dogs' } as any
      )

      expect(service.seedFile).toHaveBeenCalledWith('dogs', 'file')
      expect(result).toBe(dummyFilePath)
    })

    it('should seed an image', async () => {
      jest
        .spyOn(service, 'seedImage')
        .mockReturnValue(Promise.resolve(dummyImage))

      const result = await service.seedProperty(
        {
          type: PropType.Image,
          name: 'photo',
          options: { sizes: DEFAULT_IMAGE_SIZES }
        } as any,
        { slug: 'dogs' } as any
      )

      expect(service.seedImage).toHaveBeenCalledWith(
        'dogs',
        'photo',
        DEFAULT_IMAGE_SIZES
      )
      expect(result).toBe(dummyImage)
    })
  })

  describe('seedAdmin', () => {
    it('should seed the admin user', async () => {
      const dummyRepository = {
        create: jest.fn(() => ({})),
        save: jest.fn()
      } as any

      await service.seedAdmin(dummyRepository)

      expect(dummyRepository.save).toHaveBeenCalledWith({
        email: DEFAULT_ADMIN_CREDENTIALS.email,
        password: SHA3(DEFAULT_ADMIN_CREDENTIALS.password).toString()
      })
    })
  })
})

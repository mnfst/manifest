import { Test, TestingModule } from '@nestjs/testing'

import { SeederService } from '../services/seeder.service'
import { EntityService } from '../../entity/services/entity.service'
import { RelationshipService } from '../../entity/services/relationship.service'
import { DataSource, EntityMetadata } from 'typeorm'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { StorageService } from '../../storage/services/storage.service'
import {
  DEFAULT_ADMIN_CREDENTIALS,
  DEFAULT_IMAGE_SIZES,
  DEFAULT_MAX_MANY_TO_MANY_RELATIONS
} from '../../constants'
import { PropType, RelationshipManifest } from '../../../../types/src'

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockResolvedValue('mock file content')
}))

jest.mock('bcryptjs', () => ({
  hashSync: jest.fn().mockResolvedValue('hashedPassword')
}))

// TODO: Ensure that the storeFile and storeImage methods are only called once per property.
describe('SeederService', () => {
  let service: SeederService
  let dataSource: DataSource

  let originalConsoleLog: any

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

  beforeAll(() => {
    originalConsoleLog = console.log
    console.log = jest.fn()
  })

  afterAll(() => {
    console.log = originalConsoleLog
  })

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeederService,
        {
          provide: EntityService,
          useValue: {
            createEntity: jest.fn(),
            getEntityMetadatas: jest.fn(() => dummyEntityMetadatas),
            getEntityMetadata: jest.fn(),
            getEntityRepository: jest.fn(() => ({
              find: jest.fn(() =>
                Promise.resolve([
                  {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
                  },
                  {
                    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
                  }
                ])
              )
            }))
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

    it('should truncate all tables on postgres', async () => {
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

    it('should truncate all tables on mysql', async () => {
      ;(dataSource.options as any).type = 'mysql'

      await service.seed()

      dummyEntityMetadatas.forEach((entityMetadata) => {
        expect(queryRunner.query).toHaveBeenCalledWith(
          `TRUNCATE TABLE \`${entityMetadata.tableName}\``
        )
      })
    })

    it('should only seed a table if passed as an argument', async () => {
      jest.spyOn(dataSource, 'createQueryRunner').mockReturnValue(queryRunner)

      await service.seed('table1')

      expect(queryRunner.query).toHaveBeenNthCalledWith(
        2,
        `DELETE FROM [${'table1'}]`
      )
      expect(queryRunner.query).toHaveBeenCalledTimes(3) // 2 for PRAGMA FKs and 1 for DELETE.
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
      const result = (await service.seedProperty(
        { type: PropType.Password } as any,
        {} as any
      )) as string

      expect(typeof result).toBe('string')
      expect(result).toBe('hashedPassword')
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
      const result = await service.seedProperty(
        { type: PropType.File, name: 'file' } as any,
        { slug: 'dogs' } as any
      )

      expect(result).toBe(dummyFilePath)
    })

    it('should seed an image', async () => {
      const result = await service.seedProperty(
        {
          type: PropType.Image,
          name: 'photo',
          options: { sizes: DEFAULT_IMAGE_SIZES }
        } as any,
        { slug: 'dogs' } as any
      )

      expect(result).toBe(dummyImage)
    })
  })

  describe('seedRelationships', () => {
    it('should return an UUID if the relation is many-to-one', async () => {
      const dummyRelationManifest: RelationshipManifest = {
        name: 'owner',
        entity: 'User',
        type: 'many-to-one'
      }

      const seedValue = await service.seedRelationships(dummyRelationManifest)

      expect(typeof seedValue).toBe('string')
      expect(seedValue).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    })
    it('should return a set items with a count between 0 and the default max many-to-many relations', async () => {
      const manyToManyRelationManifest: RelationshipManifest = {
        name: 'users',
        entity: 'User',
        type: 'many-to-many',
        owningSide: true
      }
      const seedValue: { id: string }[] = (await service.seedRelationships(
        manyToManyRelationManifest
      )) as { id: string }[]

      expect(seedValue.length).toBeGreaterThanOrEqual(0)
      expect(seedValue.length).toBeLessThanOrEqual(
        DEFAULT_MAX_MANY_TO_MANY_RELATIONS
      )
      seedValue.forEach((item) => {
        expect(typeof item.id).toBe('string')
        expect(item.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      })
    })

    it('should return an array of items without duplicates in many-to-many relations', async () => {
      const manyToManyRelationManifest: RelationshipManifest = {
        name: 'users',
        entity: 'User',
        type: 'many-to-many',
        owningSide: true
      }
      const seedValue: { id: string }[] = (await service.seedRelationships(
        manyToManyRelationManifest
      )) as { id: string }[]

      const uniqueIds = new Set(seedValue.map((item) => item.id))
      expect(uniqueIds.size).toBe(seedValue.length)
    })
  })

  describe('seedAdmin', () => {
    it('should seed the admin user', async () => {
      const dummyRepository = {
        create: jest.fn(() => ({})),
        save: jest.fn()
      } as any

      await service.seedAdmin(dummyRepository)

      expect(dummyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: DEFAULT_ADMIN_CREDENTIALS.email
        })
      )
    })
  })
})

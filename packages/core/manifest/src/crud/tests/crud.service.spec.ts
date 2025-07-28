import { CrudService } from '../services/crud.service'
import { Test, TestingModule } from '@nestjs/testing'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { PaginationService } from '../services/pagination.service'
import { EntityService } from '../../entity/services/entity.service'
import { ValidationService } from '../../validation/services/validation.service'
import { RelationshipService } from '../../entity/services/relationship.service'
import { EntityManifest, Paginator, PropType } from '../../../../types/src'
import { SelectQueryBuilder } from 'typeorm'
import bcrypt from 'bcryptjs'

describe('CrudService', () => {
  let service: CrudService
  let entityService: EntityService
  let validationService: ValidationService
  let paginationService: PaginationService
  let relationshipService: RelationshipService
  let entityManifestService: EntityManifestService

  const dummyEntityManifest: Partial<EntityManifest> = {
    className: 'Test',
    nameSingular: 'Test',
    namePlural: 'Tests',
    mainProp: 'name',
    slug: 'test',
    relationships: [],
    authenticable: true,
    properties: [
      {
        name: 'name',
        type: PropType.String
      },
      {
        name: 'age',
        type: PropType.Number,
        default: 18
      },
      {
        name: 'color',
        type: PropType.String
      },
      {
        name: 'secretProperty',
        type: PropType.String,
        hidden: true
      },
      {
        name: 'password',
        type: PropType.Password
      },
      {
        name: 'secondPassword',
        type: PropType.Password
      }
    ]
  }

  const dummyItem = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Superman',
    age: 30,
    color: 'blue',
    mentorId: 3
  }

  const dummyPaginator: Paginator<any> = {
    data: [dummyItem],
    currentPage: 1,
    lastPage: 1,
    from: 1,
    to: 1,
    total: 1,
    perPage: 1
  }

  const queryBuilder: SelectQueryBuilder<any> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockReturnValue(Promise.resolve(dummyItem))
  } as any

  const entityMetadata = {
    columns: [
      { propertyName: 'id', isPrimary: true },
      { propertyName: 'name' },
      { propertyName: 'age' },
      { propertyName: 'color' },
      { propertyName: 'secretProperty', isVisible: false },
      { propertyName: 'password', isVisible: false },
      { propertyName: 'secondPassword', isVisible: false }
    ],
    relations: []
  }

  const entityRepository = {
    findOne: jest.fn(() => Promise.resolve(dummyItem)),
    create: jest.fn((item) => item),
    save: jest.fn((item) => item),
    createQueryBuilder: jest.fn(() => queryBuilder),
    delete: jest.fn(() => Promise.resolve({})),
    remove: jest.fn(() => Promise.resolve({})),
    metadata: entityMetadata
  } as any

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrudService,
        {
          provide: EntityManifestService,
          useValue: {
            getEntityManifest: jest.fn(() => dummyEntityManifest)
          }
        },
        {
          provide: PaginationService,
          useValue: {
            paginate: jest.fn(() => Promise.resolve(dummyPaginator))
          }
        },
        {
          provide: EntityService,
          useValue: {
            findOne: jest.fn(),
            getEntityRepository: jest.fn(() => entityRepository),
            getEntityMetadata: jest.fn(() => ({
              relations: []
            }))
          }
        },
        {
          provide: ValidationService,
          useValue: {
            validate: jest.fn(() => [])
          }
        },
        {
          provide: RelationshipService,
          useValue: {
            fetchRelationItemsFromDto: jest.fn(({ itemDto, emptyMissing }) => {
              if (itemDto.mentorId) {
                return { mentor: { id: itemDto.mentorId } }
              }
              if (emptyMissing) {
                return { mentor: null }
              }
              return {}
            })
          }
        }
      ]
    }).compile()

    service = module.get<CrudService>(CrudService)
    entityService = module.get<EntityService>(EntityService)
    validationService = module.get<ValidationService>(ValidationService)
    paginationService = module.get<PaginationService>(PaginationService)
    relationshipService = module.get<RelationshipService>(RelationshipService)
    entityManifestService = module.get<EntityManifestService>(
      EntityManifestService
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('findAll', () => {
    it('should return all entities', async () => {
      const entitySlug = 'test'
      const result = await service.findAll({ entitySlug })
      expect(result).toEqual(dummyPaginator)
    })

    it('should return all entities with pagination', async () => {
      const entitySlug = 'test'
      const result = await service.findAll({
        entitySlug,
        queryParams: { page: '2', perPage: '1' }
      })

      expect(result).toEqual(dummyPaginator)
      expect(paginationService.paginate).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPage: 2,
          resultsPerPage: 1
        })
      )
    })

    it('should order entities', async () => {
      const entitySlug = 'test'
      const result = await service.findAll({
        entitySlug,
        queryParams: { orderBy: 'name' }
      })

      expect(result).toEqual(dummyPaginator)
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('entity.name', 'ASC')
    })

    it('should fail if the order by property is not in the entity', async () => {
      const entitySlug = 'test'
      await expect(
        service.findAll({
          entitySlug,
          queryParams: { orderBy: 'invalid' }
        })
      ).rejects.toThrow()
    })

    it('should be able to order by id', async () => {
      const entitySlug = 'test'
      const result = await service.findAll({
        entitySlug,
        queryParams: { orderBy: 'id' }
      })

      expect(result).toEqual(dummyPaginator)
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('entity.id', 'ASC')
    })

    it('should select only visible properties', async () => {
      const entitySlug = 'test'
      const result = await service.findAll({ entitySlug })

      expect(result).toEqual(dummyPaginator)

      const selectFunctionParams: string[] =
        queryBuilder.select['mock'].calls[0][0]

      expect(selectFunctionParams).not.toContain('entity.secretProperty')
      expect(selectFunctionParams).not.toContain('entity.password')
    })

    it('should load relationships', async () => {
      // TODO: Implement test
    })

    it('should return all entities with filters', async () => {
      const entitySlug = 'test'
      const result = await service.findAll({
        entitySlug,
        queryParams: {
          name_eq: 'Superman',
          age_gte: '25',
          age_lte: '35',
          color_like: 'blue',
          color_in: 'blue,red,green'
        }
      })

      expect(result).toEqual(dummyPaginator)
      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(5)
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'entity.name = :value_0',
        { value_0: 'Superman' }
      )
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'entity.age >= :value_1',
        { value_1: '25' }
      )
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'entity.age <= :value_2',
        { value_2: '35' }
      )
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'entity.color like :value_3',
        { value_3: 'blue' }
      )
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'entity.color in (:...value_4)',
        { value_4: ['blue', 'red', 'green'] }
      )
    })

    it('should throw an error if the filter suffix is invalid', async () => {
      const entitySlug = 'test'
      await expect(
        service.findAll({
          entitySlug,
          queryParams: { age_notASuffix: '30' }
        })
      ).rejects.toThrow()
    })

    it('should throw an error if the filter suffix is not compatible with propertyType', async () => {
      const entitySlug = 'test'

      // Cannot filter by password.
      await expect(
        service.findAll({
          entitySlug,
          queryParams: { password_eq: '30' }
        })
      ).rejects.toThrow()

      // Greater than or equal is not compatible with string.
      await expect(
        service.findAll({
          entitySlug,
          queryParams: { name_gte: '30' }
        })
      ).rejects.toThrow()
    })
  })

  describe('findSelectOptions', () => {
    it('should return all entities as an array of select options', async () => {
      jest
        .spyOn(service, 'findAll')
        .mockReturnValue(Promise.resolve(dummyPaginator))

      const entitySlug = 'test'
      const result = await service.findSelectOptions({ entitySlug })

      expect(result).toEqual([
        { label: dummyItem[dummyEntityManifest.mainProp], id: dummyItem.id }
      ])
    })
  })

  describe('findOne', () => {
    it('should return an entity', async () => {
      const entitySlug = 'test'

      const result = await service.findOne({ entitySlug, id: dummyItem.id })

      expect(result).toEqual(dummyItem)
    })

    it('should throw a 404 error if the entity is not found', async () => {
      const entitySlug = 'test'

      jest
        .spyOn(queryBuilder, 'getOne')
        .mockReturnValue(Promise.resolve(undefined))

      await expect(service.findOne({ entitySlug })).rejects.toThrow()
    })
  })

  describe('store', () => {
    it('should store an entity', async () => {
      const entitySlug = 'test'
      const itemDto = { name: 'test' }

      const result = await service.store(entitySlug, itemDto)

      expect(result.name).toEqual(itemDto.name)
    })

    it('should fill the default values if not provided', async () => {
      const entitySlug = 'test'
      const itemDto = { name: 'test' }

      const result = await service.store(entitySlug, itemDto)

      expect(result.age).toEqual(
        dummyEntityManifest.properties.find((p) => p.name === 'age').default
      )
    })

    it('should throw an error if validation fails', async () => {
      jest.spyOn(validationService, 'validate').mockReturnValue([
        {
          property: 'name',
          constraints: {
            isNotEmpty: 'name should not be empty'
          }
        }
      ])

      const entitySlug = 'test'
      const itemDto = { name: '' }

      expect(service.store(entitySlug, itemDto)).rejects.toThrow()
    })

    it('should encrypt password properties', async () => {
      const entitySlug = 'test'
      const itemDto = {
        name: 'test',
        password: 'password',
        secondPassword: 'password'
      }

      const result = await service.store(entitySlug, itemDto)

      expect(result.password).not.toEqual('password')
      expect(result.secondPassword).not.toEqual('password')
    })

    it('should store relationships', async () => {
      const dummyUuid = '3e4a9c2f-8b1d-4e72-9a5b-c8f3d2e1a6b7'

      const dummyRelations = { mentor: { id: dummyUuid } } as any

      jest
        .spyOn(relationshipService, 'fetchRelationItemsFromDto')
        .mockReturnValue(Promise.resolve(dummyRelations))

      const entitySlug = 'test'
      const itemDto = { name: 'test', mentorId: dummyUuid }

      const result = await service.store(entitySlug, itemDto)

      expect(result.mentor['id']).toEqual(dummyUuid)
    })
  })

  describe('storeEmpty', () => {
    it('should store an entity with empty properties', async () => {
      const entitySlug = 'test'

      const result = await service.storeEmpty(entitySlug)

      expect(result).toBeDefined()
    })
  })

  describe('update (full replacement', () => {
    it('should update an entity', async () => {
      const entitySlug = 'test'
      const itemDto = { name: 'test' }

      const result = await service.update({
        entitySlug,
        id: dummyItem.id,
        itemDto
      })

      expect(result.name).toEqual(itemDto.name)
    })

    it('should throw an error if the entity is not found', async () => {
      const entitySlug = 'test'
      const itemDto = { name: 'test' }

      jest.spyOn(entityService, 'getEntityRepository').mockReturnValue({
        findOne: jest.fn(() => Promise.resolve(null)),
        create: jest.fn((item) => item),
        save: jest.fn((item) => item)
      } as any)

      await expect(
        service.update({ entitySlug, id: dummyItem.id, itemDto })
      ).rejects.toThrow()
    })

    it('should update relationships', async () => {
      const entitySlug = 'test'
      const dummyUuid = '7e5a1d9f-3b6c-4f28-9e4a-b8c1f5d7a3e9'
      const itemDto = { mentorId: dummyUuid }

      const result: any = await service.update({
        entitySlug,
        id: dummyUuid,
        itemDto
      })

      expect(result.mentor.id).toEqual(itemDto.mentorId)
    })

    it('should do a full replacement of properties', async () => {
      const entitySlug = 'test'
      const itemDto = { name: 'test' }

      const result = await service.update({
        entitySlug,
        id: dummyItem.id,
        itemDto
      })

      expect(result.name).toEqual(itemDto.name)
      expect(result.age).toBeUndefined()
    })

    it('should do a full replacement of relationships', async () => {
      const entitySlug = 'test'
      const dummyUuid = '8b4f7d2a-1c9e-4a58-9b7f-e6c3a9d2b5f1'
      const itemWithoutRelation = {}
      const itemWithNewRelation = { mentorId: dummyUuid }

      const resultWithoutRelation = await service.update({
        entitySlug,
        id: dummyUuid,
        itemDto: itemWithoutRelation
      })
      const resultWithNewRelation = await service.update({
        entitySlug,
        id: dummyUuid,
        itemDto: itemWithNewRelation
      })

      expect(resultWithoutRelation.mentor).toBeNull()
      expect(resultWithNewRelation.mentor['id']).toEqual(
        itemWithNewRelation.mentorId
      )
    })

    it('should throw an error if validation fails', async () => {
      jest.spyOn(validationService, 'validate').mockReturnValue([
        {
          property: 'name',
          constraints: {
            isNotEmpty: 'name should not be empty'
          }
        }
      ])

      const entitySlug = 'test'
      const itemDto = { name: '' }

      expect(
        service.update({ entitySlug, id: dummyItem.id, itemDto })
      ).rejects.toThrow()
    })
  })

  describe('update (partial replacement)', () => {
    it('should do a partial replacement of properties', async () => {
      const entitySlug = 'test'
      const itemDto = { name: 'test' }

      const result = await service.update({
        entitySlug,
        id: dummyItem.id,
        itemDto,
        partialReplacement: true
      })

      expect(result.name).toEqual(itemDto.name)
      expect(result.age).toEqual(dummyItem.age)
    })

    it('should replace relations only if specified', async () => {
      const entitySlug = 'test'
      const itemDto = { mentorId: '6c9e2b5f-4a7d-4b19-9c6e-f3a1d8b5c7e9' }
      const itemWithoutRelationDto = { name: 'test' }

      const result = await service.update({
        entitySlug,
        id: dummyItem.id,
        itemDto,
        partialReplacement: true
      })

      const resultWithoutRelation = await service.update({
        entitySlug,
        id: dummyItem.id,
        itemDto: itemWithoutRelationDto,
        partialReplacement: true
      })

      expect(result.mentor['id']).toEqual(itemDto.mentorId)
      expect(result.name).toEqual(dummyItem.name)

      expect(resultWithoutRelation.mentor).toBeUndefined()
      expect(resultWithoutRelation.name).toEqual(itemWithoutRelationDto.name)
    })

    it('should not update the password if not provided', async () => {
      const entitySlug = 'test'
      const itemDto = { name: 'test' }

      jest.spyOn(entityService, 'getEntityRepository').mockReturnValue({
        findOne: jest.fn(() =>
          Promise.resolve(
            Object.assign(
              {
                password: 'hashedPassword'
              },
              dummyItem
            )
          )
        ),
        metadata: entityMetadata,
        create: jest.fn((item) => item),
        save: jest.fn((item) => item)
      } as any)
      jest.spyOn(bcrypt, 'hashSync')

      await service.update({
        entitySlug,
        id: dummyItem.id,
        itemDto,
        partialReplacement: true
      })

      expect(bcrypt.hashSync).not.toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should delete an entity', async () => {
      const entitySlug = 'test'

      const result = await service.delete(entitySlug, dummyItem.id)

      expect(result).toEqual(dummyItem)
    })

    it('should throw an error if the entity is not found', async () => {
      const entitySlug = 'test'

      jest.spyOn(entityService, 'getEntityRepository').mockReturnValue({
        delete: jest.fn(() => Promise.resolve(undefined))
      } as any)

      await expect(service.delete(entitySlug, dummyItem.id)).rejects.toThrow()
    })

    it('should throw an error if the item has parent one-to-many relationships', async () => {
      const entitySlug = 'test'

      jest.spyOn(entityManifestService, 'getEntityManifest').mockReturnValue({
        relations: [{ name: 'parent', type: 'one-to-many' }]
      } as any)

      await expect(service.delete(entitySlug, dummyItem.id)).rejects.toThrow()
    })
  })
})

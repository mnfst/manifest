import { CrudService } from '../services/crud.service'
import { Test, TestingModule } from '@nestjs/testing'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { PaginationService } from '../services/pagination.service'
import { EntityService } from '../../entity/services/entity.service'
import { ValidationService } from '../../validation/services/validation.service'
import { RelationshipService } from '../../entity/services/relationship.service'
import { EntityManifest, Paginator, PropType } from '../../../../types/src'
import { SelectQueryBuilder } from 'typeorm'

describe('CrudService', () => {
  let service: CrudService
  let entityService: EntityService
  let validationService: ValidationService
  let paginationService: PaginationService

  const dummyEntityManifest: Partial<EntityManifest> = {
    className: 'Test',
    nameSingular: 'Test',
    namePlural: 'Tests',
    slug: 'test',
    relationships: [],
    properties: [
      {
        name: 'name',
        type: PropType.String
      },
      {
        name: 'age',
        type: PropType.Number
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
      }
    ]
  }

  const dummyItem = {
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
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis()
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
            getEntityRepository: jest.fn(() => ({
              findOne: jest.fn(() => Promise.resolve(dummyItem)),
              create: jest.fn((item) => item),
              save: jest.fn((item) => item),
              createQueryBuilder: jest.fn(() => queryBuilder)
            })),
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
      // TODO: Implement test
    })
  })

  describe('update', () => {
    it('should update an entity', async () => {
      const entitySlug = 'test'
      const id = 1
      const itemDto = { name: 'test' }

      const result = await service.update({ entitySlug, id, itemDto })

      expect(result.name).toEqual(itemDto.name)
    })

    it('should throw an error if the entity is not found', async () => {
      const entitySlug = 'test'
      const id = 1
      const itemDto = { name: 'test' }

      jest.spyOn(entityService, 'getEntityRepository').mockReturnValue({
        findOne: jest.fn(() => Promise.resolve(null)),
        create: jest.fn((item) => item),
        save: jest.fn((item) => item)
      } as any)

      await expect(
        service.update({ entitySlug, id, itemDto })
      ).rejects.toThrow()
    })

    it('should update relationships', async () => {
      const entitySlug = 'test'
      const id = 1
      const itemDto = { mentorId: 2 }

      const result: any = await service.update({ entitySlug, id, itemDto })

      expect(result.mentor.id).toEqual(itemDto.mentorId)
    })

    it('should do a full replacement of properties', async () => {
      const entitySlug = 'test'
      const id = 1
      const itemDto = { name: 'test' }

      const result = await service.update({ entitySlug, id, itemDto })

      expect(result.name).toEqual(itemDto.name)
      expect(result.age).toBeUndefined()
    })

    it('should do a full replacement of relationships', async () => {
      const entitySlug = 'test'
      const id = 1
      const itemWithoutRelation = {}
      const itemWithNewRelation = { mentorId: 2 }

      const resultWithoutRelation = await service.update({
        entitySlug,
        id,
        itemDto: itemWithoutRelation
      })
      const resultWithNewRelation = await service.update({
        entitySlug,
        id,
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
      const id = 1
      const itemDto = { name: '' }

      expect(service.update({ entitySlug, id, itemDto })).rejects.toThrow()
    })

    describe('update (partial replacement)', () => {
      it('should do a partial replacement of properties', async () => {
        const entitySlug = 'test'
        const id = 1
        const itemDto = { name: 'test' }

        const result = await service.update({
          entitySlug,
          id,
          itemDto,
          partialReplacement: true
        })

        expect(result.name).toEqual(itemDto.name)
        expect(result.age).toEqual(dummyItem.age)
      })

      it('should replace relations only if specified', async () => {
        const entitySlug = 'test'
        const id = 1
        const itemDto = { mentorId: 2 }
        const itemWithoutRelationDto = { name: 'test' }

        const result = await service.update({
          entitySlug,
          id,
          itemDto,
          partialReplacement: true
        })

        const resultWithoutRelation = await service.update({
          entitySlug,
          id,
          itemDto: itemWithoutRelationDto,
          partialReplacement: true
        })

        expect(result.mentor['id']).toEqual(itemDto.mentorId)
        expect(result.name).toEqual(dummyItem.name)

        expect(resultWithoutRelation.mentor).toBeUndefined()
        expect(resultWithoutRelation.name).toEqual(itemWithoutRelationDto.name)
      })
    })
  })
})

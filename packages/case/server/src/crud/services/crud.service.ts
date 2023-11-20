import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { validate } from 'class-validator'
import {
  DeleteResult,
  FindManyOptions,
  FindOptionsWhere,
  In,
  InsertResult,
  Repository
} from 'typeorm'
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata'

import { Paginator } from '../../../../shared/interfaces/paginator.interface'
import { PropertyDescription } from '../../../../shared/interfaces/property-description.interface'
import { SelectOption } from '../../../../shared/interfaces/select-option.interface'
import { BaseEntity } from '../../core-entities/base-entity'
import { ExcelService } from '../../utils/excel.service'
import { EntityMetaService } from './entity-meta.service'

@Injectable()
export class CrudService {
  constructor(
    private entityMetaService: EntityMetaService,
    private excelService: ExcelService
  ) {}

  async findAll({
    entitySlug,
    queryParams
  }: {
    entitySlug: string
    queryParams?: { [key: string]: string | string[] }
  }): Promise<Paginator<BaseEntity> | BaseEntity[] | string> {
    const entityRepository: Repository<BaseEntity> =
      this.entityMetaService.getRepository(entitySlug)

    // Get entity relations.
    const relations: string[] = this.entityMetaService
      .getEntityMetadata(entitySlug)
      .relations.map((relation: RelationMetadata) => relation.propertyName)

    // Dynamic filtering.
    const where: FindOptionsWhere<BaseEntity> = {}

    Object.keys(queryParams || {}).forEach((key: string) => {
      // Check if key is a relation.
      if (relations.includes(key)) {
        // Force array.
        if (typeof queryParams[key] === 'string') {
          queryParams[key] = [queryParams[key] as string]
        }
        // Add relation where clause: { relation: In([1, 2, 3])  }
        where[key] = In(queryParams[key] as string[])
      }
    })

    const findManyOptions: FindManyOptions<BaseEntity> = {
      order: { id: 'DESC' },
      relations,
      where
    }

    // Export results.
    if (queryParams?.export) {
      const items: BaseEntity[] = await entityRepository.find(findManyOptions)
      return this.export(entitySlug, items)
    }

    // Non paginated results.
    if (!queryParams?.page && !queryParams?.perPage) {
      return await entityRepository.find(findManyOptions)
    }

    // Paginated results.
    const currentPage: number = parseInt(queryParams.page as string, 10) || 1
    const perPage: number = parseInt(queryParams.perPage as string, 10) || 10

    findManyOptions.skip = (currentPage - 1) * perPage
    findManyOptions.take = perPage

    const total: number = await entityRepository.count(findManyOptions)
    const results: any[] = await entityRepository.find(findManyOptions)

    const paginator: Paginator<any> = {
      data: results,
      currentPage,
      lastPage: Math.ceil(total / perPage),
      from: findManyOptions.skip + 1,
      to: findManyOptions.skip + perPage,
      total,
      perPage: perPage
    }

    return paginator
  }

  async export(entitySlug: string, items: BaseEntity[]): Promise<string> {
    const props: PropertyDescription[] =
      this.entityMetaService.getPropDescriptions(
        this.entityMetaService.getEntityMetadata(entitySlug)
      )

    const headers: string[] = props.map((prop: any) => prop.label)

    return this.excelService.export(
      headers,
      items.map((item: BaseEntity) =>
        props.map((prop: PropertyDescription) => item[prop.propName])
      ),
      entitySlug,
      true
    )
  }

  async findSelectOptions(entitySlug: string): Promise<SelectOption[]> {
    const items: BaseEntity[] = (await this.findAll({
      entitySlug
    })) as BaseEntity[]

    return items.map((item: BaseEntity) => ({
      id: item.id,
      label:
        item[
          this.entityMetaService.getEntityDefinition(entitySlug).propIdentifier
        ]
    }))
  }

  async findOne(entitySlug: string, id: number) {
    const item = await this.entityMetaService
      .getRepository(entitySlug)
      .findOne({
        where: { id },
        relations: this.entityMetaService
          .getEntityMetadata(entitySlug)
          .relations.map((relation: RelationMetadata) => relation.propertyName)
      })

    if (!item) {
      throw new NotFoundException('Item not found')
    }
    return item
  }

  async store(entitySlug: string, itemDto: any): Promise<InsertResult> {
    const entityRepository: Repository<any> =
      this.entityMetaService.getRepository(entitySlug)

    const newItem: BaseEntity = entityRepository.create(itemDto)

    const errors = await validate(newItem)
    if (errors.length) {
      throw new HttpException(errors, HttpStatus.BAD_REQUEST)
    }

    // If we have relations, we load them to be available in the @BeforeInsert() hook.
    const relations: RelationMetadata[] =
      this.entityMetaService.getEntityMetadata(entitySlug).relations
    if (relations.length) {
      newItem._relations = await this.entityMetaService.loadRelations(
        newItem,
        relations
      )
    }

    return entityRepository.insert(newItem)
  }

  async update(
    entitySlug: string,
    id: number,
    itemDto: any
  ): Promise<BaseEntity> {
    const entityRepository: Repository<any> =
      this.entityMetaService.getRepository(entitySlug)

    const item: BaseEntity = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    const itemToSave = entityRepository.create({
      ...item,
      ...itemDto
    })

    const errors = await validate(itemToSave)
    if (errors.length) {
      throw new HttpException(errors, HttpStatus.BAD_REQUEST)
    }

    return entityRepository.save(itemToSave)
  }

  async delete(entitySlug: string, id: number): Promise<DeleteResult> {
    const entityRepository: Repository<BaseEntity> =
      this.entityMetaService.getRepository(entitySlug)

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    return entityRepository.delete(id)
  }
}

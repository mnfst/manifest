import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { validate } from 'class-validator'
import {
  DeleteResult,
  EntityMetadata,
  FindManyOptions,
  FindOptionsSelect,
  FindOptionsWhere,
  InsertResult,
  Repository
} from 'typeorm'
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata'

import {
  Paginator,
  WhereKeySuffix,
  WhereOperator,
  whereOperatorKeySuffix
} from '@casejs/types'
import { PropType } from '../../../../shared/enums/prop-type.enum'
import { PropertyDescription } from '../../../../shared/interfaces/property-description.interface'
import { SelectOption } from '../../../../shared/interfaces/select-option.interface'
import { BaseEntity } from '../../core-entities/base-entity'
import { ExcelService } from '../../utils/excel.service'
import { HelperService } from '../../utils/helper.service'
import { whereOperatorFunctionsRecord } from '../records/where-operator-functions.record'
import { EntityMetaService } from './entity-meta.service'

@Injectable()
export class CrudService {
  // Query params that should not be treated as a filter.
  specialQueryParams: string[] = [
    'page',
    'perPage',
    'export',
    'order',
    'orderBy'
  ]

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

    const entityMetadata: EntityMetadata =
      this.entityMetaService.getEntityMetadata(entitySlug)

    // Get entity relations.
    const relations: string[] = entityMetadata.relations.map(
      (relation: RelationMetadata) => relation.propertyName
    )

    // Get entity props.
    const props: PropertyDescription[] =
      this.entityMetaService.getPropDescriptions(entityMetadata)

    // Dynamic filtering.
    const where: FindOptionsWhere<BaseEntity> = {}

    Object.entries(queryParams || {})
      .filter(
        ([key, _value]: [string, string | string[]]) =>
          !this.specialQueryParams.includes(key)
      )
      .forEach(([key, value]: [string, string]) => {
        // Check if the key includes one of the available operator suffixes. We reverse array as some suffixes are substrings of others (ex: _gt and _gte).
        const suffix: WhereKeySuffix = Object.values(WhereKeySuffix)
          .reverse()
          .find((suffix) => key.includes(suffix))

        if (!suffix) {
          throw new HttpException(
            'Query param key should include an operator suffix',
            HttpStatus.BAD_REQUEST
          )
        }

        const operator: WhereOperator = HelperService.getRecordKeyByValue(
          whereOperatorKeySuffix,
          suffix
        ) as WhereOperator

        const queryBuilderOperator: Function =
          whereOperatorFunctionsRecord[operator]

        const propName: string = key.replace(suffix, '')

        if (!props.find((prop) => prop.propName === propName)) {
          throw new HttpException(
            `Property ${propName} does not exist in ${entitySlug}`,
            HttpStatus.BAD_REQUEST
          )
        }

        // In operator expects an array so we have to parse it.
        let parsedValue: string[]
        if (operator === WhereOperator.In) {
          parsedValue = JSON.parse(value)
        }

        // Finally and the where query.
        where[propName] = queryBuilderOperator(parsedValue || value)
      })

    const findManyOptions: FindManyOptions<BaseEntity> = {
      order: queryParams?.orderBy
        ? { [queryParams.orderBy as string]: queryParams.order }
        : { id: 'DESC' },
      select: this.getVisiblePropsSelect(props),
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
    const entityMetadata: EntityMetadata =
      this.entityMetaService.getEntityMetadata(entitySlug)

    const relations: string[] = entityMetadata.relations.map(
      (relation: RelationMetadata) => relation.propertyName
    )

    const props: PropertyDescription[] =
      this.entityMetaService.getPropDescriptions(entityMetadata)

    const item = await this.entityMetaService
      .getRepository(entitySlug)
      .findOne({
        where: { id },
        select: this.getVisiblePropsSelect(props),
        relations
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

  /**
   * Returns a select object with all the visible props (non relation).
   *
   * @param props the props of the entity.
   * @returns a select object with all the visible props.
   */

  private getVisiblePropsSelect(
    props: PropertyDescription[]
  ): FindOptionsSelect<BaseEntity> {
    return props.reduce(
      (acc: FindOptionsSelect<BaseEntity>, prop: PropertyDescription) => {
        if (prop.type !== PropType.Relation && !prop.options.isHidden) {
          acc[prop.propName] = true
        }
        return acc
      },
      { id: true }
    )
  }
}

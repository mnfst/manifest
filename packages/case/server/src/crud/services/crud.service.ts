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
  FindOptionsSelect,
  InsertResult,
  Repository,
  SelectQueryBuilder
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

    // Get entity props.
    const props: PropertyDescription[] =
      this.entityMetaService.getPropDescriptions(entityMetadata)

    // Init query builder.
    // TODO: Use query builder for *WHERE, *ORDER *SELECT and finally *RELATIONS and *SELECT IN RELATIONS and RELATIONS OF RELATIONS.
    const query: SelectQueryBuilder<BaseEntity> =
      entityRepository.createQueryBuilder('entity')

    // Dynamic filtering.
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
        query.where(`entity.${propName} ${operator} :value`, {
          value: parsedValue || value
        })
      })

    // Select only visible props (relations are treated separately).
    query.select(
      props
        .filter(
          (prop: PropertyDescription) =>
            prop.type !== PropType.Relation && !prop.options.isHidden
        )
        .map((prop: PropertyDescription) => `entity.${prop.propName}`)
    )

    // Get item relations and select only their visible props.
    entityMetadata.relations.forEach((relation: RelationMetadata) => {
      query.leftJoin(`entity.${relation.propertyName}`, relation.propertyName)

      const relationProps: PropertyDescription[] =
        this.entityMetaService.getPropDescriptions(
          relation.inverseEntityMetadata
        )

      query.addSelect(
        relationProps
          .filter(
            (prop: PropertyDescription) =>
              prop.type !== PropType.Relation && !prop.options.isHidden
          )
          .map(
            (prop: PropertyDescription) =>
              `${relation.propertyName}.${prop.propName}`
          )
      )
    })

    // Add order by.
    if (queryParams.orderBy) {
      if (!props.find((prop) => prop.propName === queryParams.orderBy)) {
        throw new HttpException(
          `Property ${queryParams.orderBy} does not exist in ${entitySlug} and thus cannot be used for ordering`,
          HttpStatus.BAD_REQUEST
        )
      }

      query.orderBy(
        `entity.${queryParams.orderBy}`,
        queryParams.order === 'DESC' ? 'DESC' : 'ASC'
      )
    }

    // Export results.
    if (queryParams?.export) {
      const items: BaseEntity[] = await query.getMany()
      return this.export(entitySlug, items)
    }

    // Non paginated results.
    if (!queryParams?.page && !queryParams?.perPage) {
      return query.getMany()
    }

    // Paginated results.
    const currentPage: number = parseInt(queryParams.page as string, 10) || 1
    const perPage: number = parseInt(queryParams.perPage as string, 10) || 10

    const skip: number = (currentPage - 1) * perPage
    const take: number = perPage

    const total: number = await query.getCount()
    const results: any[] = await query.skip(skip).take(take).getMany()

    const paginator: Paginator<any> = {
      data: results,
      currentPage,
      lastPage: Math.ceil(total / perPage),
      from: skip + 1,
      to: skip + perPage,
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

  // TODO: Do as in findAll() and use query builder to match constraints.
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

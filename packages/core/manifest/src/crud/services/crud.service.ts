import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException
} from '@nestjs/common'

import {
  DeleteResult,
  EntityMetadata,
  InsertResult,
  Repository,
  SelectQueryBuilder
} from 'typeorm'

import { BaseEntity } from '@mnfst/types'
import { validate } from 'class-validator'
import { EntityService } from '../../entity/services/entity/entity.service'
import { ManifestService } from '../../manifest/services/manifest/manifest.service'

import {
  EntityManifest,
  Paginator,
  PropType,
  PropertyManifest,
  RelationshipManifest,
  SelectOption,
  WhereKeySuffix,
  WhereOperator,
  whereOperatorKeySuffix
} from '@mnfst/types'
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata'
import {
  DEFAULT_RESULTS_PER_PAGE,
  QUERY_PARAMS_RESERVED_WORDS
} from '../../constants'
import { HelperService } from './helper.service'
import { PaginationService } from './pagination.service'

@Injectable()
export class CrudService {
  constructor(
    private readonly entityService: EntityService,
    private readonly manifestService: ManifestService,
    private readonly paginationService: PaginationService
  ) {}

  /**
   * Returns a paginated list of entities.
   *
   * @param entitySlug the entity slug.
   * @param queryParams the filter and pagination query params.
   *
   * @returns A paginated list of entities.
   **/
  async findAll({
    entitySlug,
    queryParams
  }: {
    entitySlug: string
    queryParams?: { [key: string]: string | string[] }
  }) {
    const entityManifest: EntityManifest =
      this.manifestService.getEntityManifest({
        slug: entitySlug
      })

    const entityMetadata: EntityMetadata = this.entityService.getEntityMetadata(
      {
        className: entityManifest.className
      }
    )

    const entityRepository: Repository<BaseEntity> =
      this.entityService.getEntityRepository({ entityMetadata })

    let query: SelectQueryBuilder<BaseEntity> =
      entityRepository.createQueryBuilder('entity')

    // Select only visible props.
    query.select(
      this.getVisibleProps({
        props: entityManifest.properties
      })
    )

    // Load relations.
    this.loadRelations({
      query,
      entityMetadata,
      belongsTo: entityManifest.belongsTo,
      requestedRelations: queryParams?.relations?.toString().split(',')
    })

    // Apply filters.
    this.filterQuery({
      query,
      queryParams,
      entityManifest
    })

    // Apply ordering.
    if (queryParams?.orderBy) {
      if (
        !entityManifest.properties.find(
          (prop: PropertyManifest) =>
            prop.name === queryParams.orderBy && !prop.hidden
        )
      ) {
        throw new HttpException(
          `Property ${queryParams.orderBy} does not exist in ${entitySlug} and thus cannot be used for ordering`,
          HttpStatus.BAD_REQUEST
        )
      }
      query.orderBy(
        `entity.${queryParams.orderBy}`,
        queryParams.order === 'DESC' ? 'DESC' : 'ASC'
      )
    } else {
      query.orderBy('entity.id', 'DESC')
    }

    // Paginate.
    return this.paginationService.paginate({
      query,
      currentPage: parseInt(queryParams.page as string, 10) || 1,
      resultsPerPage:
        parseInt(queryParams.perPage as string, 10) || DEFAULT_RESULTS_PER_PAGE
    })
  }

  async findSelectOptions({
    entitySlug,
    queryParams
  }: {
    entitySlug: string
    queryParams?: { [key: string]: string | string[] }
  }): Promise<SelectOption[]> {
    const items: Paginator<BaseEntity> = await this.findAll({
      entitySlug,
      queryParams: Object.assign({}, queryParams, { perPage: -1 })
    })

    const entityManifest: EntityManifest =
      this.manifestService.getEntityManifest({
        slug: entitySlug
      })

    return items.data.map((item: BaseEntity) => ({
      id: item.id,
      label: item[entityManifest.mainProp]
    }))
  }

  async findOne({
    entitySlug,
    id,
    queryParams
  }: {
    entitySlug: string
    id: number
    queryParams?: { [key: string]: string | string[] }
  }) {
    const entityManifest: EntityManifest =
      this.manifestService.getEntityManifest({
        slug: entitySlug
      })

    const entityMetadata: EntityMetadata = this.entityService.getEntityMetadata(
      {
        className: entityManifest.className
      }
    )

    const query: SelectQueryBuilder<BaseEntity> = this.entityService
      .getEntityRepository({ entityMetadata })
      .createQueryBuilder('entity')
      .select(this.getVisibleProps({ props: entityManifest.properties }))
      .where('entity.id = :id', { id })

    this.loadRelations({
      query,
      entityMetadata,
      belongsTo: entityManifest.belongsTo,
      requestedRelations: queryParams?.relations?.toString().split(',')
    })

    const item: BaseEntity = await query.getOne()

    if (!item) {
      throw new NotFoundException('Item not found')
    }
    return item
  }

  async store(entitySlug: string, itemDto: any): Promise<InsertResult> {
    const entityRepository: Repository<any> =
      this.entityService.getEntityRepository({ entitySlug })

    const newItem: BaseEntity = entityRepository.create(itemDto)

    const errors = await validate(newItem)
    if (errors.length) {
      throw new HttpException(errors, HttpStatus.BAD_REQUEST)
    }

    return entityRepository.insert(newItem)
  }

  async update(
    entitySlug: string,
    id: number,
    itemDto: any
  ): Promise<BaseEntity> {
    const entityRepository: Repository<BaseEntity> =
      this.entityService.getEntityRepository({ entitySlug })

    const item: BaseEntity = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    const itemToSave: BaseEntity = entityRepository.create({
      ...item,
      ...itemDto
    } as BaseEntity)

    const errors = await validate(itemToSave)
    if (errors.length) {
      throw new HttpException(errors, HttpStatus.BAD_REQUEST)
    }

    return entityRepository.save(itemToSave)
  }

  async delete(entitySlug: string, id: number): Promise<DeleteResult> {
    const entityRepository: Repository<BaseEntity> =
      this.entityService.getEntityRepository({
        entitySlug
      })

    const item = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    return entityRepository.delete(id)
  }

  /**
   * Returns a list of visible props to be used in a select query.
   *
   * @param props the props of the entity.
   * @returns the list of visible props.
   */
  private getVisibleProps({
    props,
    alias = 'entity'
  }: {
    props: PropertyManifest[]
    alias?: string
  }): string[] {
    // Id is always visible.
    const visibleProps: string[] = [`${alias}.id`]

    props
      .filter((prop) => !prop.hidden)
      .forEach((prop) => visibleProps.push(`${alias}.${prop.name}`))

    return visibleProps
  }

  /**
   * Recursively loads relations and their visible props.
   *
   * @param query the query builder.
   * @param entityMetadata the entity metadata.
   * @param belongsTo the belongsTo relationships.
   * @param requestedRelations the requested relations.
   * @param alias the alias of the entity.
   *
   * @returns the query builder with the relations loaded.
   */
  private loadRelations({
    query,
    entityMetadata,
    belongsTo,
    requestedRelations,
    alias = 'entity'
  }: {
    query: SelectQueryBuilder<BaseEntity>
    entityMetadata: EntityMetadata
    belongsTo: RelationshipManifest[]
    requestedRelations?: string[]
    alias?: string
  }): SelectQueryBuilder<BaseEntity> {
    // Get item relations and select only their visible props.
    entityMetadata.relations.forEach((relation: RelationMetadata) => {
      const relationshipManifest: RelationshipManifest = belongsTo.find(
        (belongsTo: RelationshipManifest) =>
          belongsTo.name === relation.propertyName
      )

      // Only eager relations are loaded.
      if (
        !relationshipManifest.eager &&
        !requestedRelations?.includes(relation.propertyName)
      ) {
        return
      }

      const aliasName: string = HelperService.camelCaseTwoStrings(
        alias,
        relation.propertyName
      )

      query.leftJoin(`${alias}.${relation.propertyName}`, aliasName)

      const relationEntityManifest: EntityManifest =
        this.manifestService.getEntityManifest({
          className: relation.inverseEntityMetadata.targetName
        })

      query.addSelect(
        this.getVisibleProps({
          props: relationEntityManifest.properties,
          alias: aliasName
        })
      )

      // Load relations of relations.
      const relationEntityMetadata: EntityMetadata =
        this.entityService.getEntityMetadata({
          className: relation.inverseEntityMetadata.targetName
        })

      if (relationEntityMetadata.relations.length) {
        query = this.loadRelations({
          query,
          entityMetadata: relationEntityMetadata,
          belongsTo: relationEntityManifest.belongsTo,
          requestedRelations: requestedRelations?.map(
            (requestedRelation: string) =>
              requestedRelation.replace(`${relation.propertyName}.`, '')
          ),
          alias: aliasName
        })
      }
    })

    return query
  }

  /**
   * Filters the query.
   *
   * @param query the query builder.
   * @param queryParams the filter and pagination query params.
   * @param entityManifest the entity manifest.
   * @param entityMetadata the entity metadata.
   *
   * @returns the query builder with the filters applied.
   */
  private filterQuery({
    query,
    queryParams,
    entityManifest
  }: {
    query: SelectQueryBuilder<BaseEntity>
    queryParams?: { [key: string]: string | string[] }
    entityManifest: EntityManifest
  }): SelectQueryBuilder<BaseEntity> {
    Object.entries(queryParams || {})
      .filter(
        ([key, _value]: [string, string | string[]]) =>
          !QUERY_PARAMS_RESERVED_WORDS.includes(key)
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

        const prop: PropertyManifest = entityManifest.properties.find(
          (prop: PropertyManifest) => prop.name === propName && !prop.hidden
        )

        const relation: RelationshipManifest = entityManifest.belongsTo.find(
          (belongsTo: RelationshipManifest) =>
            belongsTo.name === propName.split('.')[0]
        )

        if (!prop && !relation) {
          throw new HttpException(
            `Property ${propName} does not exist in ${entityManifest.className}`,
            HttpStatus.BAD_REQUEST
          )
        }

        let whereKey: string

        if (relation) {
          const aliasName: string = HelperService.camelCaseTwoStrings(
            'entity',
            relation.name
          )
          whereKey = `${aliasName}.${propName.split('.')[1]}`
        } else {
          whereKey = `entity.${propName}`
        }

        // Allow "true" and "false" to be used for boolean props for convenience.
        if (prop && prop.type === PropType.Boolean) {
          if (value === 'true') {
            value = '1'
          } else if (value === 'false') {
            value = '0'
          }
        }

        // Finally and the where query. "In" is a bit special as it expects an array of values.
        if (operator === WhereOperator.In) {
          query.where(`${whereKey} ${operator} (:...value)`, {
            value: JSON.parse(`[${value}]`)
          })
        } else {
          query.where(`${whereKey} ${operator} :value`, {
            value
          })
        }
      })

    return query
  }
}

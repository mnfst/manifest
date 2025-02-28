import bcrypt from 'bcrypt'
import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException
} from '@nestjs/common'

import { camelize, getRecordKeyByValue } from '@repo/common'

import { EntityMetadata, Repository, SelectQueryBuilder } from 'typeorm'

import { BaseEntity } from '@repo/types'
import { ValidationError } from 'class-validator'
import { EntityService } from '../../entity/services/entity.service'

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
} from '@repo/types'
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata'
import {
  DEFAULT_RESULTS_PER_PAGE,
  QUERY_PARAMS_RESERVED_WORDS,
  SALT_ROUNDS
} from '../../constants'

import { PaginationService } from './pagination.service'
import { ValidationService } from '../../validation/services/validation.service'
import { RelationshipService } from '../../entity/services/relationship.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'

@Injectable()
export class CrudService {
  constructor(
    private readonly entityService: EntityService,
    private readonly entityManifestService: EntityManifestService,
    private readonly paginationService: PaginationService,
    private readonly validationService: ValidationService,
    private readonly relationshipService: RelationshipService
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
    queryParams,
    fullVersion
  }: {
    entitySlug: string
    queryParams?: { [key: string]: string | string[] }
    fullVersion?: boolean
  }) {
    const entityManifest: EntityManifest =
      this.entityManifestService.getEntityManifest({
        slug: entitySlug,
        fullVersion
      })

    const entityMetadata: EntityMetadata = this.entityService.getEntityMetadata(
      {
        className: entityManifest.className
      }
    )

    const entityRepository: Repository<BaseEntity> =
      this.entityService.getEntityRepository({ entityMetadata })

    const query: SelectQueryBuilder<BaseEntity> =
      entityRepository.createQueryBuilder('entity')

    // Select only visible props.
    query.select(
      this.getVisibleProps({
        props: entityManifest.properties,
        fullVersion
      })
    )

    // Load relations.
    this.loadRelations({
      query,
      entityMetadata,
      relationships: entityManifest.relationships,
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
        queryParams.orderBy !== 'id' &&
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
      currentPage: parseInt(queryParams?.page as string, 10) || 1,
      resultsPerPage:
        parseInt(queryParams?.perPage as string, 10) || DEFAULT_RESULTS_PER_PAGE
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
      this.entityManifestService.getEntityManifest({
        slug: entitySlug
      })

    return items.data.map((item: BaseEntity) => ({
      id: item.id,
      label: item[entityManifest.mainProp] as string
    }))
  }

  /**
   * Returns a single entity.
   *
   * @param entitySlug the entity slug.
   * @param id the entity id.
   * @param queryParams the filter and pagination query params.
   * @param fullVersion whether to return the full version of the entity.
   *
   * @returns the entity.
   */

  async findOne({
    entitySlug,
    id,
    queryParams,
    fullVersion
  }: {
    entitySlug: string
    id: number
    queryParams?: { [key: string]: string | string[] }
    fullVersion?: boolean
  }) {
    const entityManifest: EntityManifest =
      this.entityManifestService.getEntityManifest({
        slug: entitySlug,
        fullVersion
      })

    const entityMetadata: EntityMetadata = this.entityService.getEntityMetadata(
      {
        className: entityManifest.className
      }
    )

    const query: SelectQueryBuilder<BaseEntity> = this.entityService
      .getEntityRepository({ entityMetadata })
      .createQueryBuilder('entity')
      .select(
        this.getVisibleProps({
          props: entityManifest.properties,
          fullVersion
        })
      )
      .where('entity.id = :id', { id })

    this.loadRelations({
      query,
      entityMetadata,
      relationships: entityManifest.relationships,
      requestedRelations: queryParams?.relations?.toString().split(',')
    })

    const item: BaseEntity = await query.getOne()

    if (!item) {
      throw new NotFoundException('Item not found')
    }
    return item
  }

  async store(
    entitySlug: string,
    itemDto: Partial<BaseEntity>
  ): Promise<BaseEntity> {
    const entityRepository: Repository<BaseEntity> =
      this.entityService.getEntityRepository({ entitySlug })

    const entityManifest: EntityManifest =
      this.entityManifestService.getEntityManifest({
        slug: entitySlug,
        fullVersion: true
      })

    const newItem: BaseEntity = entityRepository.create(itemDto)
    const relationItems: { [key: string]: BaseEntity | BaseEntity[] } =
      await this.relationshipService.fetchRelationItemsFromDto({
        itemDto,
        relationships: entityManifest.relationships
          .filter((r) => r.type !== 'one-to-many')
          .filter((r) => r.type !== 'many-to-many' || r.owningSide)
      })

    if (entityManifest.authenticable && itemDto.password) {
      newItem.password = bcrypt.hashSync(
        itemDto['password'] as string,
        SALT_ROUNDS
      )
    }

    const errors: ValidationError[] = this.validationService.validate(
      newItem,
      entityManifest
    )

    if (errors.length) {
      throw new HttpException(errors, HttpStatus.BAD_REQUEST)
    }

    return entityRepository.save({ ...newItem, ...relationItems })
  }

  /**
   * Creates an empty item bypassing validation.
   *
   * @param entitySlug the entity slug.
   *
   * @returns the created item.
   */
  async storeEmpty(entitySlug: string): Promise<BaseEntity> {
    const entityRepository: Repository<BaseEntity> =
      this.entityService.getEntityRepository({ entitySlug })

    return entityRepository.save({})
  }

  /*
   * Updates an item doing a FULL REPLACEMENT of the item properties and relations unless partialReplacement is set to true.
   *
   * @param entitySlug the entity slug.
   * @param id the item id.
   * @param itemDto the item dto.
   * @param partialReplacement whether to do a partial replacement.
   *
   * @returns the updated item.
   */
  async update({
    entitySlug,
    id,
    itemDto,
    partialReplacement
  }: {
    entitySlug: string
    id: number
    itemDto: Partial<BaseEntity>
    partialReplacement?: boolean
  }): Promise<BaseEntity> {
    const entityManifest: EntityManifest =
      this.entityManifestService.getEntityManifest({
        slug: entitySlug,
        fullVersion: true
      })

    const entityRepository: Repository<BaseEntity> =
      this.entityService.getEntityRepository({ entitySlug })

    const item: BaseEntity = await entityRepository.findOne({ where: { id } })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    const relationItems: { [key: string]: BaseEntity | BaseEntity[] } =
      await this.relationshipService.fetchRelationItemsFromDto({
        itemDto,
        relationships: entityManifest.relationships
          .filter((r) => r.type !== 'one-to-many')
          .filter((r) => r.type !== 'many-to-many' || r.owningSide),
        emptyMissing: !partialReplacement
      })

    // On partial replacement, only update the provided props.
    if (partialReplacement) {
      itemDto = { ...item, ...itemDto }

      // Remove undefined values to keep the existing values.
      Object.keys(relationItems).forEach((key: string) => {
        if (
          relationItems[key] === undefined ||
          relationItems[key]?.length === 0
        ) {
          delete relationItems[key]
        }
      })
    }

    const updatedItem: BaseEntity = entityRepository.create({ id, ...itemDto })

    // Hash password if it exists.
    if (entityManifest.authenticable && itemDto.password) {
      updatedItem.password = bcrypt.hashSync(
        itemDto['password'] as string,
        SALT_ROUNDS
      )
    } else if (entityManifest.authenticable && !itemDto.password) {
      delete updatedItem.password
    }

    const errors = this.validationService.validate(
      updatedItem,
      entityManifest,
      {
        isUpdate: true
      }
    )

    if (errors.length) {
      throw new HttpException(errors, HttpStatus.BAD_REQUEST)
    }

    return entityRepository.save({ ...updatedItem, ...relationItems })
  }

  /**
   * Deletes an item.
   *
   * @param entitySlug the entity slug.
   * @param id the item id.
   *
   * @returns the deleted item.
   */
  async delete(entitySlug: string, id: number): Promise<BaseEntity> {
    const entityRepository: Repository<BaseEntity> =
      this.entityService.getEntityRepository({
        entitySlug
      })

    const oneToManyRelationships: RelationshipManifest[] =
      this.entityManifestService
        .getEntityManifest({
          slug: entitySlug
        })
        .relationships.filter((r) => r.type === 'one-to-many')

    const item = await entityRepository.findOne({
      where: { id },
      relations: oneToManyRelationships.map((r) => r.name)
    })

    if (!item) {
      throw new NotFoundException('Item not found')
    }

    // Throw an error if the item has related items in a one-to-many relationship.
    if (oneToManyRelationships.length) {
      oneToManyRelationships.forEach((relationship: RelationshipManifest) => {
        const relatedItems: BaseEntity[] = item[
          relationship.name
        ] as BaseEntity[]

        if (relatedItems.length) {
          throw new HttpException(
            `Cannot delete item as it has related ${relationship.name}. Please delete the related items first.`,
            HttpStatus.BAD_REQUEST
          )
        }
      })
    }

    await entityRepository.delete(id)

    return item
  }

  /**
   * Returns a list of visible props to be used in a select query.
   *
   * @param props the props of the entity.
   * @returns the list of visible props.
   */
  private getVisibleProps({
    props,
    alias = 'entity',
    fullVersion
  }: {
    props: PropertyManifest[]
    alias?: string
    fullVersion?: boolean
  }): string[] {
    // Id is always visible.
    const visibleProps: string[] = [`${alias}.id`]

    props
      .filter((prop) => prop.name !== 'password') // Never return password.
      .filter((prop) => fullVersion || !prop.hidden)
      .forEach((prop) => visibleProps.push(`${alias}.${prop.name}`))

    return visibleProps
  }

  /**
   * Recursively loads relations and their visible props.
   *
   * @param query the query builder.
   * @param entityMetadata the entity metadata.
   * @param relationships the relationships.
   * @param requestedRelations the requested relations.
   * @param alias the alias of the entity.
   *
   * @returns the query builder with the relations loaded.
   */
  private loadRelations({
    query,
    entityMetadata,
    relationships,
    requestedRelations,
    alias = 'entity'
  }: {
    query: SelectQueryBuilder<BaseEntity>
    entityMetadata: EntityMetadata
    relationships: RelationshipManifest[]
    requestedRelations?: string[]
    alias?: string
  }): SelectQueryBuilder<BaseEntity> {
    // Get item relations and select only their visible props.
    entityMetadata.relations.forEach((relationMetadata: RelationMetadata) => {
      const relationshipManifest: RelationshipManifest = relationships.find(
        (relationship: RelationshipManifest) =>
          relationship.name === relationMetadata.propertyName
      )

      // Only eager or requested relations are loaded.
      if (
        !relationshipManifest.eager &&
        !requestedRelations?.includes(relationMetadata.propertyName)
      ) {
        return
      }

      const aliasName: string = camelize([alias, relationMetadata.propertyName])

      query.leftJoin(`${alias}.${relationMetadata.propertyName}`, aliasName)

      const relationEntityManifest: EntityManifest =
        this.entityManifestService.getEntityManifest({
          className: relationMetadata.inverseEntityMetadata.targetName
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
          className: relationMetadata.inverseEntityMetadata.targetName
        })

      if (relationEntityMetadata.relations.length) {
        query = this.loadRelations({
          query,
          entityMetadata: relationEntityMetadata,
          relationships: relationEntityManifest.relationships,
          requestedRelations: requestedRelations
            ?.filter(
              (requestedRelation: string) =>
                requestedRelation !== relationMetadata.propertyName
            ) // Remove the current relation from the requested relations to avoid infinite recursion.
            .map(
              (requestedRelation: string) =>
                requestedRelation.replace(
                  `${relationMetadata.propertyName}.`,
                  ''
                ) // Remove the current relation prefix.
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
        ([key]: [string, string | string[]]) =>
          !QUERY_PARAMS_RESERVED_WORDS.includes(key)
      )
      .forEach(([key, value]: [string, string], index: number) => {
        // Check if the key includes one of the available operator suffixes. We reverse array as some suffixes are substrings of others (ex: _gt and _gte).
        const suffix: WhereKeySuffix = Object.values(WhereKeySuffix)
          .reverse()
          .find((suffix) => key.includes(suffix))

        if (!suffix) {
          throw new HttpException(
            'Query param key should include an operator suffix like _eq, _gt, _lt, _in, etc.',
            HttpStatus.BAD_REQUEST
          )
        }

        const operator: WhereOperator = getRecordKeyByValue(
          whereOperatorKeySuffix,
          suffix
        ) as WhereOperator
        const propName: string = key.replace(suffix, '')

        const prop: PropertyManifest = entityManifest.properties.find(
          (prop: PropertyManifest) => prop.name === propName && !prop.hidden
        )

        const relation: RelationshipManifest =
          entityManifest.relationships.find(
            (relationship: RelationshipManifest) =>
              relationship.name === propName.split('.')[0]
          )

        if (!prop && !relation) {
          throw new HttpException(
            `Property ${propName} does not exist in ${entityManifest.className}`,
            HttpStatus.BAD_REQUEST
          )
        }

        let whereKey: string

        if (relation) {
          const aliasName: string = camelize(['entity', relation.name])
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

        // "In" is a bit special as it expects an array of values.
        if (operator === WhereOperator.In) {
          value = JSON.parse(`[${value}]`)
        }

        // Finally and the where query.
        query.andWhere(`${whereKey} ${operator} :value_${index}`, {
          [`value_${index}`]: value
        })
      })

    return query
  }
}

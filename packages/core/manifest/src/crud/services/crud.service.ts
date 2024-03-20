import { Injectable } from '@nestjs/common'

import { EntityMetadata, Repository, SelectQueryBuilder } from 'typeorm'
import { EntityService } from '../../entity/services/entity/entity.service'
import { BaseEntity } from '../../entity/types/base-entity.interface'
import { ManifestService } from '../../manifest/services/manifest/manifest.service'
import { EntityManifest } from '../../manifest/typescript/manifest-types'
import { PaginationService } from './pagination.service'

@Injectable()
export class CrudService {
  /**
   * The special query params that are not used for filtering.
   */
  specialQueryParams: string[] = [
    'page',
    'perPage',
    'order',
    'orderBy',
    'relations'
  ]

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

    console.log(entityManifest)

    const entityMetadata: EntityMetadata = this.entityService.getEntityMetadata(
      entityManifest.className
    )

    const entityRepository: Repository<BaseEntity> =
      this.entityService.getEntityRepository(entityMetadata)

    const query: SelectQueryBuilder<BaseEntity> =
      entityRepository.createQueryBuilder('entity')

    return this.paginationService.paginate({
      query,
      currentPage: parseInt(queryParams.page as string, 10) || 1
    })

    // // Dynamic filtering.
    // Object.entries(queryParams || {})
    //   .filter(
    //     ([key, _value]: [string, string | string[]]) =>
    //       !this.specialQueryParams.includes(key)
    //   )
    //   .forEach(([key, value]: [string, string]) => {
    //     // Check if the key includes one of the available operator suffixes. We reverse array as some suffixes are substrings of others (ex: _gt and _gte).
    //     const suffix: WhereKeySuffix = Object.values(WhereKeySuffix)
    //       .reverse()
    //       .find((suffix) => key.includes(suffix))
    //     if (!suffix) {
    //       throw new HttpException(
    //         'Query param key should include an operator suffix',
    //         HttpStatus.BAD_REQUEST
    //       )
    //     }
    //     const operator: WhereOperator = HelperService.getRecordKeyByValue(
    //       whereOperatorKeySuffix,
    //       suffix
    //     ) as WhereOperator
    //     const propName: string = key.replace(suffix, '')
    //     const prop: PropertyDescription = props.find(
    //       (prop: PropertyDescription) => prop.propName === propName
    //     )
    //     if (!prop) {
    //       throw new HttpException(
    //         `Property ${propName} does not exist in ${entitySlug}`,
    //         HttpStatus.BAD_REQUEST
    //       )
    //     }
    //     // Allow "true" and "false" to be used for boolean props for convenience.
    //     if (prop.type === PropType.Boolean) {
    //       if (value === 'true') {
    //         value = '1'
    //       } else if (value === 'false') {
    //         value = '0'
    //       }
    //     }
    //     // Finally and the where query. In is a bit special as it expects an array of values.
    //     if (operator === WhereOperator.In) {
    //       query.where(`entity.${propName} ${operator} (:...value)`, {
    //         value: JSON.parse(`[${value}]`)
    //       })
    //     } else {
    //       query.where(`entity.${propName} ${operator} :value`, {
    //         value
    //       })
    //     }
    //   })
    // query.select(this.getVisibleProps({ props }))
    // query = this.loadRelations({
    //   query,
    //   entityMetadata,
    //   props,
    //   requestedRelations: queryParams?.relations?.toString().split(',')
    // })
    // // Add order by.
    // if (queryParams?.orderBy) {
    //   if (!props.find((prop) => prop.propName === queryParams.orderBy)) {
    //     throw new HttpException(
    //       `Property ${queryParams.orderBy} does not exist in ${entitySlug} and thus cannot be used for ordering`,
    //       HttpStatus.BAD_REQUEST
    //     )
    //   }
    //   query.orderBy(
    //     `entity.${queryParams.orderBy}`,
    //     queryParams.order === 'DESC' ? 'DESC' : 'ASC'
    //   )
    // }
  }

  // async findSelectOptions(entitySlug: string): Promise<SelectOption[]> {
  //   const items: BaseEntity[] = (await this.findAll({
  //     entitySlug
  //   })) as BaseEntity[]

  //   return items.map((item: BaseEntity) => ({
  //     id: item.id,
  //     label:
  //       item[
  //         this.entityMetaService.getEntityDefinition(entitySlug).propIdentifier
  //       ]
  //   }))
  // }

  // async findOne(entitySlug: string, id: number) {
  //   const entityMetadata: EntityMetadata =
  //     this.entityMetaService.getEntityMetadata(entitySlug)

  //   const relations: string[] = entityMetadata.relations.map(
  //     (relation: RelationMetadata) => relation.propertyName
  //   )

  //   const props: PropertyDescription[] =
  //     this.entityMetaService.getPropDescriptions(entityMetadata)

  //   const query: SelectQueryBuilder<BaseEntity> = this.entityMetaService
  //     .getRepository(entitySlug)
  //     .createQueryBuilder('entity')

  //   this.loadRelations({
  //     query,
  //     entityMetadata,
  //     props,
  //     requestedRelations: relations
  //   })

  //   const item: BaseEntity = await query
  //     .select(this.getVisibleProps({ props }))
  //     .where('entity.id = :id', { id })
  //     .getOne()

  //   if (!item) {
  //     throw new NotFoundException('Item not found')
  //   }
  //   return item
  // }

  // async store(entitySlug: string, itemDto: any): Promise<InsertResult> {
  //   const entityRepository: Repository<any> =
  //     this.entityMetaService.getRepository(entitySlug)

  //   const newItem: BaseEntity = entityRepository.create(itemDto)

  //   const errors = await validate(newItem)
  //   if (errors.length) {
  //     throw new HttpException(errors, HttpStatus.BAD_REQUEST)
  //   }

  //   return entityRepository.insert(newItem)
  // }

  // async update(
  //   entitySlug: string,
  //   id: number,
  //   itemDto: any
  // ): Promise<BaseEntity> {
  //   const entityRepository: Repository<any> =
  //     this.entityMetaService.getRepository(entitySlug)

  //   const item: BaseEntity = await entityRepository.findOne({ where: { id } })

  //   if (!item) {
  //     throw new NotFoundException('Item not found')
  //   }

  //   const itemToSave = entityRepository.create({
  //     ...item,
  //     ...itemDto
  //   })

  //   const errors = await validate(itemToSave)
  //   if (errors.length) {
  //     throw new HttpException(errors, HttpStatus.BAD_REQUEST)
  //   }

  //   return entityRepository.save(itemToSave)
  // }

  // async delete(entitySlug: string, id: number): Promise<DeleteResult> {
  //   const entityRepository: Repository<BaseEntity> =
  //     this.entityMetaService.getRepository(entitySlug)

  //   const item = await entityRepository.findOne({ where: { id } })

  //   if (!item) {
  //     throw new NotFoundException('Item not found')
  //   }

  //   return entityRepository.delete(id)
  // }

  // /**
  //  * Returns a list of visible props to be used in a select query.
  //  *
  //  * @param props the props of the entity.
  //  * @returns the list of visible props.
  //  */
  // private getVisibleProps({
  //   props,
  //   alias = 'entity'
  // }: {
  //   props: PropertyDescription[]
  //   alias?: string
  // }): string[] {
  //   // Id is always visible.
  //   const visibleProps: string[] = [`${alias}.id`]

  //   props
  //     .filter(
  //       (prop: PropertyDescription) =>
  //         prop.type !== PropType.Relation && !prop.options.isHidden
  //     )
  //     .forEach((prop: PropertyDescription) =>
  //       visibleProps.push(`${alias}.${prop.propName}`)
  //     )

  //   return visibleProps
  // }

  // /**
  //  * Recursively loads relations and their visible props.
  //  *
  //  * @param query the query builder.
  //  * @param entityMetadata the entity metadata.
  //  * @param props the entity props.
  //  * @param queryParams the query params.
  //  *
  //  * @returns the query builder with the relations loaded.
  //  */
  // private loadRelations({
  //   query,
  //   entityMetadata,
  //   props,
  //   requestedRelations,
  //   alias = 'entity'
  // }: {
  //   query: SelectQueryBuilder<BaseEntity>
  //   entityMetadata: EntityMetadata
  //   props: PropertyDescription[]
  //   requestedRelations?: string[]
  //   alias?: string
  // }): SelectQueryBuilder<BaseEntity> {
  //   // Get item relations and select only their visible props.
  //   entityMetadata.relations.forEach((relation: RelationMetadata) => {
  //     const relationDescription: PropertyDescription = props.find(
  //       (prop: PropertyDescription) => prop.propName === relation.propertyName
  //     )
  //     // Only eager relations are loaded.
  //     if (
  //       !(relationDescription.options as RelationPropertyOptions).eager &&
  //       !requestedRelations?.includes(relation.propertyName)
  //     ) {
  //       return
  //     }

  //     query.leftJoin(`${alias}.${relation.propertyName}`, relation.propertyName)

  //     const relationProps: PropertyDescription[] =
  //       this.entityMetaService.getPropDescriptions(
  //         relation.inverseEntityMetadata
  //       )

  //     query.addSelect(
  //       this.getVisibleProps({
  //         props: relationProps,
  //         alias: relation.propertyName
  //       })
  //     )

  //     // Load relations of relations.
  //     const relationEntityMetadata: EntityMetadata =
  //       this.entityMetaService.getEntityMetadata(
  //         relation.inverseEntityMetadata.name
  //       )

  //     const relationRelations: RelationMetadata[] =
  //       relationEntityMetadata.relations

  //     if (relationRelations.length) {
  //       query = this.loadRelations({
  //         query,
  //         entityMetadata: relationEntityMetadata,
  //         props: relationProps,
  //         requestedRelations: requestedRelations?.map(
  //           (requestedRelation: string) =>
  //             requestedRelation.replace(`${relation.propertyName}.`, '')
  //         ),
  //         alias: relation.propertyName
  //       })
  //     }
  //   })

  //   return query
  // }
}

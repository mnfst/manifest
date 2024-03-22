import { BaseEntity } from '@casejs/types'
import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, Repository } from 'typeorm'
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata'
import { ManifestService } from '../../../manifest/services/manifest/manifest.service'

@Injectable()
export class EntityService {
  constructor(
    private dataSource: DataSource,
    private manifestService: ManifestService
  ) {}

  /**
   * Get the metadata for all entities.
   *
   * @returns The metadata for all entities.
   *
   * */
  getEntityMetadatas(): EntityMetadata[] {
    return this.sortEntitiesByHierarchy(this.dataSource.entityMetadatas)
  }

  /**
   * Get the metadata for an entity.
   *
   * @param className The class name of the entity to get the metadata for.
   * @param slug The slug of the entity to get the metadata for.
   *
   * @returns The metadata for the entity.
   */
  getEntityMetadata({
    className,
    slug
  }: {
    className?: string
    slug?: string
  }): EntityMetadata {
    if (!className && !slug) {
      throw new Error('Either className or slug must be provided')
    }

    if (slug) {
      className = this.manifestService.getEntityManifest({ slug }).className
    }

    const entityMetadata: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) => entity.targetName === className
    )

    if (!entityMetadata) {
      throw new Error(`Entity ${className} not found`)
    }

    return entityMetadata
  }

  /**
   * Sort entities by hierarchy in order to performer operations like seed them in the correct order.
   * An entity with a foreign key to another entity should be seeded after the entity it references.
   *
   * @param entities The entities to sort.
   *
   * @returns The sorted entities
   *
   * */
  sortEntitiesByHierarchy(entities: EntityMetadata[]): EntityMetadata[] {
    const orderedEntities: EntityMetadata[] = []

    entities.forEach((entity: EntityMetadata) => {
      const parentRelationColumns: ColumnMetadata[] = entity.columns.filter(
        (column: ColumnMetadata) =>
          column.relationMetadata?.relationType === 'many-to-one'
      )

      if (!parentRelationColumns.length && !orderedEntities.includes(entity)) {
        orderedEntities.push(entity)
      } else {
        parentRelationColumns.forEach((relationColumn: ColumnMetadata) => {
          const parentEntity: EntityMetadata =
            relationColumn.relationMetadata.inverseEntityMetadata

          if (!orderedEntities.includes(parentEntity)) {
            const entityIndex: number = orderedEntities.indexOf(entity) || 0
            orderedEntities.splice(entityIndex, 0, parentEntity)
          }

          if (!orderedEntities.includes(entity)) {
            orderedEntities.push(entity)
          }
        })
      }
    })

    return orderedEntities
  }

  /**
   * Get the TypeORM repository for an entity.
   *
   * @param entityMetadata The entity to get the repository for.
   *
   * @returns The repository for the entity.
   *
   * */
  getEntityRepository(entityMetadata: EntityMetadata): Repository<BaseEntity> {
    return this.dataSource.getRepository(entityMetadata.target)
  }
}

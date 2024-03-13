import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata } from 'typeorm'
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata'

@Injectable()
export class EntityMetaService {
  constructor(private dataSource: DataSource) {}

  /**
   * Get the metadata for all entities.
   *
   * @returns The metadata for all entities.
   *
   * */
  getEntityMetadata(): EntityMetadata[] {
    return this.sortEntitiesByHierarchy(this.dataSource.entityMetadatas)
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
      const relationColumns: ColumnMetadata[] = entity.columns.filter(
        (column: ColumnMetadata) => column.relationMetadata
      )

      if (!relationColumns.length) {
        orderedEntities.push(entity)
      } else {
        relationColumns.forEach((relationColumn: ColumnMetadata) => {
          const relatedEntity: EntityMetadata =
            relationColumn.relationMetadata.entityMetadata

          if (orderedEntities.includes(relatedEntity)) {
            orderedEntities.splice(
              orderedEntities.indexOf(relatedEntity),
              0,
              entity
            )
          } else {
            orderedEntities.push(entity)
          }
        })
      }
    })

    return orderedEntities
  }

  getEntityRepository(entity: EntityMetadata) {
    return this.dataSource.getRepository(entity.target)
  }
}

import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, Repository } from 'typeorm'
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata'
import { PropType } from '~shared/enums/prop-type.enum'
import { EntityDescription } from '~shared/interfaces/entity-description.interface'
import { PropertyDescription } from '~shared/interfaces/property-description.interface'

@Injectable()
export class AppRulesService {
  constructor(private dataSource: DataSource) {}

  // Return a list of entities and their metadata and rules.
  getAppEntities(): EntityDescription[] {
    return this.dataSource.entityMetadatas.map((entity: EntityMetadata) => ({
      className: entity.name,
      definition: (entity.inheritanceTree[0] as any).definition,
      props: this.getEntityProps(entity)
    }))
  }

  getAppSettings() {
    return {
      appName: 'CASE Starter',
      description: 'A starter project for CASE',
      logo: 'TODO: Add logo',
      favicon: 'TODO: Add favicon',
      theme: 'TODO: Add theme'
    }
  }

  getEntityProps(entity: EntityMetadata): PropertyDescription[] {
    // Get metadata from entity (based on decorators). We are basically creating a new entity instance to get the metadata (there is probably a better way to do this).
    const entityRepository: Repository<any> = this.getRepository(
      entity.tableName
    )
    const newItem = entityRepository.create()

    return entity.columns
      .filter((column: ColumnMetadata) => column.propertyName !== 'id')
      .map((column: ColumnMetadata) => {
        const propDescription: PropertyDescription = {
          propName: column.propertyName,
          label: Reflect.getMetadata(`${column.propertyName}:label`, newItem),
          type: Reflect.getMetadata(`${column.propertyName}:type`, newItem),
          options: Reflect.getMetadata(
            `${column.propertyName}:options`,
            newItem
          )
        }

        if (propDescription.type === PropType.Relation) {
          // Convert class to string to use in the client.
          propDescription.options.entityName = (
            propDescription.options.entity as any
          )?.name
        }

        return propDescription
      })
  }

  // Refactor: This code is duplicated (3 times). We should refactor this into a shared service.
  private getRepository(entityTableName: string): Repository<any> {
    const entity: EntityMetadata = this.dataSource.entityMetadatas.find(
      (entity: EntityMetadata) => entity.tableName === entityTableName
    )

    if (!entity) {
      throw new Error('Entity not found')
    }

    return this.dataSource.getRepository(entity.target)
  }
}

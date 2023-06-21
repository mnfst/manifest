import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata, Repository } from 'typeorm'

@Injectable()
export class AppRulesService {
  constructor(private dataSource: DataSource) {}

  // Return a list of entities and their metadata and rules.
  getAppEntities() {
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

  getEntityProps(entity: EntityMetadata) {
    // Get metadata from entity (based on decorators). We are basically creating a new entity instance to get the metadata (there is probably a better way to do this).
    const entityRepository: Repository<any> = this.getRepository(
      entity.tableName
    )
    const newItem = entityRepository.create()

    return entity.columns.map((column) => {
      const propType = Reflect.getMetadata(
        `${column.propertyName}:type`,
        newItem
      )
      const propName = Reflect.getMetadata(
        `${column.propertyName}:name`,
        newItem
      )

      return {
        name: propName,
        type: propType
      }
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

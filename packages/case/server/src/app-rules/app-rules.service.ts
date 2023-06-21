import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata } from 'typeorm'

@Injectable()
export class AppRulesService {
  constructor(private dataSource: DataSource) {}

  // Return a list of entities and their metadata and rules.
  getAppEntities() {
    return this.dataSource.entityMetadatas.map((entity: EntityMetadata) => {
      return {
        className: entity.name,
        definition: (entity.inheritanceTree[0] as any).definition
      }
    })
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
}

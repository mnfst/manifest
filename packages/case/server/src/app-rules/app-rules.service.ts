import { Injectable } from '@nestjs/common'
import { DataSource, EntityMetadata } from 'typeorm'

@Injectable()
export class AppRulesService {
  dataSource: DataSource

  constructor() {
    this.dataSource = new DataSource({
      type: 'sqlite',
      database: 'db/case.sqlite',
      entities: [__dirname + './../**/*.entity{.ts,.js}']
    })
    this.dataSource.initialize()
  }

  // Return a list of entities and their metadata and rules.
  getAppEntities() {
    return this.dataSource.entityMetadatas.map((entity: EntityMetadata) => {
      return {
        name: entity.name,
        rules: this.getEntityRules(entity),
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

  // TODO: Return a list of rules for a given entity.
  private getEntityRules(entity: EntityMetadata) {
    const props: string[] = entity.columns
      .filter((column) => column.databaseName !== 'id')
      .map((column) => column.propertyName)

    const entityRules = {
      create: {
        fields: props,
        rules: []
      },
      read: {
        fields: [],
        rules: []
      },
      update: {
        fields: props,
        rules: []
      },
      delete: {
        fields: [],
        rules: []
      }
    }

    return entityRules
  }
}

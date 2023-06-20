import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { join } from 'path'
import { DataSource } from 'typeorm'

import { AppRulesModule } from './app-rules/app-rules.module'
import { DynamicEntityModule } from './dynamic-entity/dynamic-entity.module'

const devMode: boolean = process.argv[2] === 'dev'

const databasePath: string = devMode
  ? './db/case.sqlite'
  : join(__dirname, '../../../../db/case.sqlite')

const entitiesFolders: string[] = [
  devMode
    ? 'dist/dev-entities/*.entity.js'
    : join(__dirname, '../../../../../entities/*.entity{.ts,.js}'),
  'dist/core-entities/*.entity.js'
]

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: databasePath,
      entities: entitiesFolders,
      synchronize: true
    }),
    AppRulesModule,
    DynamicEntityModule
  ]
})
export class AppModule {
  constructor(private dataSource: DataSource) {
    console.info('CASE app starting...', {
      devMode,
      databasePath: databasePath,
      entities: this.dataSource.entityMetadatas.map(
        (entity) => entity.tableName
      ),
      entitiesFolders: entitiesFolders
    })
  }
}

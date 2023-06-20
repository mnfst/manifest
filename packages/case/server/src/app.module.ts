import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { join } from 'path'
import { DataSource } from 'typeorm'

import { AppRulesModule } from './app-rules/app-rules.module'
import { DynamicEntityModule } from './dynamic-entity/dynamic-entity.module'

const devMode: boolean = process.argv[2] === 'dev'

const databasePath: string = `${process.cwd()}/db/case.sqlite`

const entitiesFolders: string[] = [
  devMode
    ? 'dist/entities/*.entity.js'
    : `${process.cwd()}/entities/*.entity{.ts,.js}`,
  join(__dirname, '../dist/core-entities/*.entity.js')
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
      databasePath,
      entities: this.dataSource.entityMetadatas.map(
        (entity) => entity.tableName
      ),
      entitiesFolders: entitiesFolders
    })
  }
}

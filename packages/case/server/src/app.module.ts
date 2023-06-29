import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import * as chalk from 'chalk'
import * as cliTable from 'cli-table'
import { join } from 'path'
import { DataSource } from 'typeorm'

import { AppRulesModule } from './app-rules/app-rules.module'
import { DynamicEntityModule } from './dynamic-entity/dynamic-entity.module'

const devMode: boolean = process.argv[2] === 'dev'

const databasePath: string = `${process.cwd()}/db/case.sqlite`
const entityFolders: string[] = [
  devMode
    ? 'dist/server/src/entities/*.entity.js'
    : `${process.cwd()}/entities/*.entity{.ts,.js}`,
  join(__dirname, '../src/core-entities/*.entity.js')
]

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: databasePath,
      entities: entityFolders,
      synchronize: true
    }),
    AppRulesModule,
    DynamicEntityModule
  ]
})
export class AppModule {
  constructor(private dataSource: DataSource) {
    const table = new cliTable({
      head: []
    })

    table.push(
      ['client URL', chalk.green('http://localhost:3000')],
      ['API URL', chalk.green('http://localhost:3000/api')],
      ['databasePath', chalk.green(databasePath)],
      [
        'entities',
        chalk.green(
          this.dataSource.entityMetadatas.map((entity) => entity.tableName)
        )
      ],
      ['entityFolders', chalk.green(entityFolders)],
      ['devMode', chalk.green(devMode)]
    )

    console.log(table.toString())
    console.log('\n')
    console.log(
      chalk.blue(
        '🎉 CASE app successfully started! See it at',
        chalk.underline.blue('http://localhost:3000')
      )
    )
  }
}

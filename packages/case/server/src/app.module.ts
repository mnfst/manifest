import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import * as chalk from 'chalk'
import * as cliTable from 'cli-table'
import { join } from 'path'
import { DataSource } from 'typeorm'

import { AppConfigModule } from './app-config/app-config.module'
import { AuthModule } from './auth/auth.module'
import configuration from './configuration'
import { DynamicEntityModule } from './dynamic-entity/dynamic-entity.module'
import { FileUploadModule } from './file-upload/file-upload.module'

const contributionMode: boolean = process.argv[2] === 'contribution'

const databasePath: string = `${process.cwd()}/db/case.sqlite`

const entityFolders: string[] = [
  contributionMode
    ? 'dist/server/src/entities/*.entity.js'
    : `${process.cwd()}/entities/*.entity{.ts,.js}`,
  join(__dirname, '../src/core-entities/*.entity.js')
]

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: contributionMode
        ? '../_contribution-root/.env.contribution'
        : `${process.cwd()}/.env`
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: databasePath,
      entities: entityFolders,
      synchronize: true
    }),
    AppConfigModule,
    DynamicEntityModule,
    AuthModule,
    FileUploadModule
  ]
})
export class AppModule {
  constructor(
    private dataSource: DataSource,
    private configService: ConfigService
  ) {
    if (!process.argv[1].includes('seed')) {
      this.logAppInfo()
    }
  }

  logAppInfo() {
    const port: number = this.configService.get('port')

    const table = new cliTable({
      head: []
    })

    table.push(
      ['client URL', chalk.green(`http://localhost:${port}`)],
      ['API URL', chalk.green(`http://localhost:${port}/api`)],
      ['database path', chalk.green(databasePath)],
      [
        'entities',
        chalk.green(
          this.dataSource.entityMetadatas.map((entity) => entity.tableName)
        )
      ],
      ['entity folder', chalk.green(entityFolders[0])],
      ['contribution mode', chalk.green(contributionMode)]
    )

    console.log(table.toString())
    console.log()
    console.log(
      chalk.blue(
        '🎉 CASE app successfully started! See it at',
        chalk.underline.blue(`http://localhost:${port}`)
      )
    )
  }
}

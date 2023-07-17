import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import * as chalk from 'chalk'
import * as cliTable from 'cli-table'
import { DataSource } from 'typeorm'

import { AppConfigModule } from './app-config/app-config.module'
import { AuthModule } from './auth/auth.module'
import configuration from './configuration'
import { DynamicEntityModule } from './dynamic-entity/dynamic-entity.module'
import { FileUploadModule } from './file-upload/file-upload.module'

const contributionMode: boolean = process.argv[2] === 'contribution'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: contributionMode
        ? '../_contribution-root/.env.contribution'
        : `${process.cwd()}/.env`
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        configService.get('database'),
      inject: [ConfigService]
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
    const databaseConfig: any = this.configService.get('database')

    const table = new cliTable({
      head: []
    })

    table.push(
      ['client URL', chalk.green(`http://localhost:${port}`)],
      ['database path', chalk.green(databaseConfig.database)],
      [
        'entities',
        chalk.green(
          this.dataSource.entityMetadatas.map((entity) => entity.tableName)
        )
      ],
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

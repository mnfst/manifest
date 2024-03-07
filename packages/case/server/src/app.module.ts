import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import * as chalk from 'chalk'
import * as cliTable from 'cli-table'
import { DataSource } from 'typeorm'

import { AppConfigModule } from './app-config/app-config.module'
import { AuthModule } from './auth/auth.module'
import configuration from './configuration'
import { CrudModule } from './crud/crud.module'
import { HealthModule } from './health/health.module'

const contributionMode: boolean = process.argv[2] === 'contribution'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: contributionMode
        ? `${process.cwd()}/src/_contribution-root/.env.contribution`
        : `${process.cwd()}/.env`
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        configService.get('database'),
      inject: [ConfigService]
    }),
    CrudModule,
    AuthModule,
    AppConfigModule,
    HealthModule
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
    const nodeEnv: string = this.configService.get('nodeEnv')
    const appRoot: string = this.configService.get('appRoot')

    const table = new cliTable({
      head: []
    })

    if (!contributionMode) {
      table.push(['Admin panel', chalk.green(`http://localhost:${port}`)])
    }

    table.push(
      ['REST API', chalk.green(`http://localhost:${port}/api`)],
      ['DB path', chalk.green(databaseConfig.database.replace(appRoot, ''))],
      [
        'entities',
        chalk.green(
          this.dataSource.entityMetadatas
            .map((entity) => entity.tableName)
            .join(', ')
        )
      ],
      ['node env', chalk.green(nodeEnv)]
    )

    if (contributionMode) {
      table.push(['contribution mode', chalk.green('true')])
    }

    console.log(table.toString())
    console.log()

    if (!contributionMode) {
      if (nodeEnv === 'production') {
        console.log(
          chalk.blue(
            `🎉 CASE app successfully started on production mode on port ${port}`
          )
        )
      } else {
        console.log(
          chalk.blue(
            '🎉 CASE app successfully started! See your admin panel: ',
            chalk.underline.blue(`http://localhost:${port}`)
          )
        )
        if (this.dataSource.entityMetadatas.length <= 1) {
          console.log()
          console.log(
            chalk.blue(
              '✨ You can now add your own entities: ',
              chalk.underline.blue(`https://docs.case.app/entities`)
            )
          )
        }
      }
    } else {
      console.log(
        chalk.blue(
          '🛠️  CASE server app successfully started in contributor mode! Do not forget to launch the client app too',
          chalk.underline.blue(`http://localhost:${port}`)
        )
      )
    }
    console.log()
  }
}

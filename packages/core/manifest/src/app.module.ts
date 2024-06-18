import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { TypeOrmModule } from '@nestjs/typeorm'
import { EntitySchema } from 'typeorm'
import { AuthModule } from './auth/auth.module'
import databaseConfig from './config/database'
import generalConfig from './config/general'
import pathsConfig from './config/paths'
import { CrudModule } from './crud/crud.module'
import { EntityModule } from './entity/entity.module'
import { EntityLoaderService } from './entity/services/entity-loader/entity-loader.service'
import { LoggerModule } from './logger/logger.module'
import { LoggerService } from './logger/logger.service'
import { ManifestModule } from './manifest/manifest.module'
import { SeedModule } from './seed/seed.module'
import { HealthModule } from './health/health.module'
import { BetterSqlite3ConnectionOptions } from 'typeorm/driver/better-sqlite3/BetterSqlite3ConnectionOptions'
import { OpenApiModule } from './open-api/open-api.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [generalConfig, databaseConfig, pathsConfig]
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, EntityModule],
      useFactory: (
        configService: ConfigService,
        entityLoaderService: EntityLoaderService
      ) => {
        const databaseConfig: BetterSqlite3ConnectionOptions =
          configService.get('database')

        const entities: EntitySchema[] = entityLoaderService.loadEntities()

        return Object.assign(databaseConfig, { entities })
      },
      inject: [ConfigService, EntityLoaderService]
    }),
    ManifestModule,
    EntityModule,
    SeedModule,
    CrudModule,
    AuthModule,
    LoggerModule,
    HealthModule,
    OpenApiModule
  ]
})
export class AppModule {
  constructor(private loggerService: LoggerService) {}

  async onModuleInit() {
    await this.init()
  }

  private async init() {
    const isSeed: boolean = process.argv[1].includes('seed')
    const isTest: boolean = process.env.NODE_ENV === 'test'
    const isProduction: boolean = process.env.NODE_ENV === 'production'

    if (!isSeed && !isTest && !isProduction) {
      this.loggerService.initMessage()
    }
  }
}

import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { TypeOrmModule } from '@nestjs/typeorm'
import { EntitySchema } from 'typeorm'
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'
import { AuthModule } from './auth/auth.module'
import databaseConfig from './config/database'
import generalConfig from './config/general'
import pathsConfig from './config/paths'
import yamlConfig from './config/yaml'
import { CrudModule } from './crud/crud.module'
import { EntityModule } from './entity/entity.module'
import { EntityLoaderService } from './entity/services/entity-loader/entity-loader.service'
import { LoggerModule } from './logger/logger.module'
import { LoggerService } from './logger/logger.service'
import { ManifestModule } from './manifest/manifest.module'
import { SeedModule } from './seed/seed.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [generalConfig, databaseConfig, yamlConfig, pathsConfig]
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, EntityModule],
      useFactory: (
        configService: ConfigService,
        entityLoaderService: EntityLoaderService
      ) => {
        const databaseConfig: SqliteConnectionOptions =
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
    HealthModule
  ]
})
export class AppModule {
  constructor(private loggerService: LoggerService) {}

  async onModuleInit() {
    await this.init()
  }

  private async init() {
    const isSeed: boolean = process.argv[1].includes('seed')

    if (!isSeed) {
      this.loggerService.initMessage()
    }
  }
}

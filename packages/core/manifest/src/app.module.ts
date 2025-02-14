import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { TypeOrmModule } from '@nestjs/typeorm'
import { EntitySchema } from 'typeorm'
import { AuthModule } from './auth/auth.module'
import databaseConfig from './config/database'
import generalConfig from './config/general'
import storageConfig from './config/storage'
import pathsConfig from './config/paths'
import { CrudModule } from './crud/crud.module'
import { EntityModule } from './entity/entity.module'
import { EntityLoaderService } from './entity/services/entity-loader.service'
import { LoggerModule } from './logger/logger.module'
import { LoggerService } from './logger/logger.service'
import { ManifestModule } from './manifest/manifest.module'
import { SeedModule } from './seed/seed.module'
import { HealthModule } from './health/health.module'
import { OpenApiModule } from './open-api/open-api.module'
import { ValidationModule } from './validation/validation.module'
import { UploadModule } from './upload/upload.module'
import { StorageModule } from './storage/storage.module'
import { ManifestService } from './manifest/services/manifest.service'
import { HookModule } from './hook/hook.module'
import { EndpointModule } from './endpoint/endpoint.module'
import { PolicyModule } from './policy/policy.module'
import { HandlerModule } from './handler/handler.module'
import { SdkModule } from './sdk/sdk.module'
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.contribution'],
      load: [generalConfig, databaseConfig, pathsConfig, storageConfig]
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, EntityModule, ManifestModule],
      useFactory: async (
        configService: ConfigService,
        entityLoaderService: EntityLoaderService,
        manifestService: ManifestService
      ) => {
        const isPostgres: boolean =
          configService.get('DB_CONNECTION') === 'postgres'

        let databaseConfig: SqliteConnectionOptions | PostgresConnectionOptions

        if (isPostgres) {
          databaseConfig = configService.get('database').postgres
        } else {
          databaseConfig = configService.get('database').sqlite
        }

        await manifestService.loadManifest(
          configService.get('paths').manifestFile
        )
        const entities: EntitySchema[] =
          entityLoaderService.loadEntities(isPostgres)

        return Object.assign(databaseConfig, { entities })
      },
      inject: [ConfigService, EntityLoaderService, ManifestService]
    }),
    ManifestModule,
    EntityModule,
    SeedModule,
    CrudModule,
    AuthModule,
    LoggerModule,
    HealthModule,
    OpenApiModule,
    ValidationModule,
    UploadModule,
    StorageModule,
    HookModule,
    EndpointModule,
    PolicyModule,
    HandlerModule,
    SdkModule
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

    if (!isSeed && !isTest) {
      this.loggerService.initMessage()
    }
  }
}

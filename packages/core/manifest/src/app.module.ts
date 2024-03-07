import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { TypeOrmModule } from '@nestjs/typeorm'
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'
import databaseConfig from './config/database'
import yamlConfig from './config/yaml'
import { EntityLoaderModule } from './entity-loader/entity-loader.module'
import { EntityLoaderService } from './entity-loader/services/entity-loader/entity-loader.service'
import { ManifestModule } from './manifest/manifest.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, yamlConfig]
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, EntityLoaderModule],
      useFactory: (
        configService: ConfigService,
        entityLoaderService: EntityLoaderService
      ) => {
        const databaseConfig: SqliteConnectionOptions =
          configService.get('database')

        const entities = entityLoaderService.loadEntities()

        console.log(entities)

        return databaseConfig
      },
      inject: [ConfigService, EntityLoaderService]
    }),
    ManifestModule,
    EntityLoaderModule
  ]
})
export class AppModule {}

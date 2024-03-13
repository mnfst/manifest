import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { TypeOrmModule } from '@nestjs/typeorm'
import { EntitySchema } from 'typeorm'
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'
import databaseConfig from './config/database'
import yamlConfig from './config/yaml'
import { EntityModule } from './entity/entity.module'
import { EntityLoaderService } from './entity/services/entity-loader/entity-loader.service'
import { ManifestModule } from './manifest/manifest.module'
import { SeedModule } from './seed/seed.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, yamlConfig]
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, EntityModule],
      useFactory: (
        configService: ConfigService,
        EntityLoaderService: EntityLoaderService
      ) => {
        const databaseConfig: SqliteConnectionOptions =
          configService.get('database')

        const entities: EntitySchema[] = EntityLoaderService.loadEntities()

        return Object.assign(databaseConfig, { entities })
      },
      inject: [ConfigService, EntityLoaderService]
    }),
    ManifestModule,
    EntityModule,
    SeedModule
  ]
})
export class AppModule {}

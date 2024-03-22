import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { TypeOrmModule } from '@nestjs/typeorm'
import { EntitySchema } from 'typeorm'
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'
import { AuthModule } from './auth/auth.module'
import databaseConfig from './config/database'
import yamlConfig from './config/yaml'
import { CrudModule } from './crud/crud.module'
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
    AuthModule
  ]
})
export class AppModule {}

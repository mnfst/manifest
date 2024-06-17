import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm'
import { EntityLoaderService } from '../../src/entity/services/entity-loader/entity-loader.service'

export const mockTypeOrmOptions: TypeOrmModuleAsyncOptions = {
  useFactory: (entityLoaderService: EntityLoaderService) => ({
    type: 'sqlite',
    database: ':memory:',
    entities: entityLoaderService.loadEntities()
  }),
  inject: [EntityLoaderService]
}

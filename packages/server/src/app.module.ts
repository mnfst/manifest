import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AppRulesController } from './app-rules/app-rules.controller'
import { AppRulesService } from './app-rules/app-rules.service'
import { DynamicEntityController } from './dynamic-entity/dynamic-entity.controller'
import { DynamicEntityService } from './dynamic-entity/dynamic-entity.service'

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      // TODO: TMP for dev
      database: 'db/case.sqlite',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      // database: __dirname + '../../../../../db/case.sqlite',
      // entities: [join(__dirname, '../../../../entities/*.entity{.ts,.js}')],
      synchronize: true
    })
  ],
  controllers: [DynamicEntityController, AppRulesController],
  providers: [DynamicEntityService, AppRulesService]
  // TODO: Integrate Dynamic CRUD Module from frameworkless POC
})
export class AppModule {}

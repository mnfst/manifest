import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { join } from 'path'

import { AppRulesController } from './app-rules/app-rules.controller'
import { AppRulesService } from './app-rules/app-rules.service'
import { DynamicEntityController } from './dynamic-entity/dynamic-entity.controller'
import { DynamicEntityService } from './dynamic-entity/dynamic-entity.service'

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: __dirname + '../../../../../../db/case.sqlite',
      entities: [join(__dirname, '../../../../../entities/*.entity{.ts,.js}')],
      synchronize: true
    })
  ],
  controllers: [DynamicEntityController, AppRulesController],
  providers: [DynamicEntityService, AppRulesService]
})
export class AppModule {}

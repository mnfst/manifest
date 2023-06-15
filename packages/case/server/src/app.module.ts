import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { join } from 'path'

import { AppRulesModule } from './app-rules/app-rules.module'
import { DynamicEntityModule } from './dynamic-entity/dynamic-entity.module'

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      // database: __dirname + '../../../../../../db/case.sqlite',
      database: 'db/case.sqlite',
      entities: [
        // join(__dirname, '../../../../../entities/*.entity{.ts,.js}'),
        'dist/core-entities/*.entity.js'
      ],
      synchronize: true
    }),
    AppRulesModule,
    DynamicEntityModule
  ]
})
export class AppModule {}

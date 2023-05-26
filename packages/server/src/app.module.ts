import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
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
  controllers: [DynamicEntityController],
  providers: [DynamicEntityService]
  // TODO: Integrate Dynamic CRUD Module from frameworkless POC
})
export class AppModule {}

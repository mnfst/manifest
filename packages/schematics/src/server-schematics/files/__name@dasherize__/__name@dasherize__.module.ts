import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PaginationService } from '@case-app/nest-library'

import { <%= classify(name) %>Controller } from './<%= dasherize(name) %>.controller'
import { <%= classify(name) %>Service } from './<%= dasherize(name) %>.service'
import { <%= classify(name) %> } from './<%= dasherize(name) %>.entity'

@Module({
  imports: [TypeOrmModule.forFeature([<%= classify(name) %>])],
  controllers: [<%= classify(name) %>Controller],
  providers: [<%= classify(name) %>Service, PaginationService],
})
export class <%= classify(name) %>Module {}

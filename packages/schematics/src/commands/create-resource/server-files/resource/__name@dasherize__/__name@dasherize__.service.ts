import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DeleteResult, Repository, UpdateResult } from 'typeorm'

import { Paginator, PaginationService } from '@case-app/nest-library'
import { <%= classify(name) %> } from './<%= dasherize(name) %>.entity'
import { CreateUpdate<%= classify(name) %>Dto } from './dtos/create-update-<%= dasherize(name) %>.dto'

@Injectable()
export class <%= classify(name) %>Service {
constructor(
    @InjectRepository(<%= classify(name) %>)
    private readonly repository: Repository<<%= classify(name) %>>,
    private paginationService: PaginationService
  ) {}

  async index({
    page,
    orderBy,
    orderByDesc,
    withoutPagination
  }: {
    page?: string
    orderBy?: string
    orderByDesc?: boolean
    withoutPagination?: boolean
  }): Promise<Paginator<<%= classify(name) %>> | <%= classify(name) %>[]> {
    const query = this.repository
      .createQueryBuilder('<%= camelize(name) %>')
 
    if (orderBy) {
      query.orderBy(
        orderBy.includes('.') ? orderBy : '<%= camelize(name) %>.' + orderBy,
        orderByDesc ? 'DESC' : 'ASC'
      )
    } 

    if (withoutPagination) {
      return await query.getMany()
    }

    return await this.paginationService.paginate({
      query,
      currentPage: page ? parseInt(page, 10) : 1
    })
  }

  async show(id: number): Promise<<%= classify(name) %>> {
    const <%= camelize(name) %> = await this.repository.findOneOrFail({ where: { id } })

    return <%= camelize(name) %>
  }

  async store(<%= camelize(name) %>Dto: CreateUpdate<%= classify(name) %>Dto): Promise<<%= classify(name) %>> {
    const <%= camelize(name) %>: <%= classify(name) %> = this.repository.create(<%= camelize(name) %>Dto)
    return await this.repository.save(<%= camelize(name) %>)
  }

  async update(
    id: number,
    <%= camelize(name) %>Dto: CreateUpdate<%= classify(name) %>Dto
  ): Promise<UpdateResult> {
    const <%= camelize(name) %>: <%= classify(name) %> = this.repository.create(<%= camelize(name) %>Dto)

    return await this.repository.update(id, <%= camelize(name) %>)
  }

  async destroy(id: number): Promise<DeleteResult> {
    const <%= camelize(name) %>: <%= classify(name) %> = await this.repository.findOneOrFail({ where: { id } })

    return await this.repository.delete(<%= camelize(name) %>.id)
  }
}

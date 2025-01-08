import { BaseEntity, Paginator } from '@repo/types'
import { Injectable } from '@nestjs/common'
import { SelectQueryBuilder } from 'typeorm'

@Injectable()
export class PaginationService {
  /**
   * Paginate a query.
   *
   * @param query The query to paginate.
   * @param resultsPerPage The number of results to return per page.
   * @param currentPage The current page.
   *
   * @returns A promise that resolves to a Paginator object.
   *
   **/
  async paginate({
    query,
    resultsPerPage,
    currentPage
  }: {
    query?: SelectQueryBuilder<BaseEntity>
    currentPage: number
    resultsPerPage?: number
  }): Promise<Paginator<BaseEntity>> {
    const offset: number = (currentPage - 1) * resultsPerPage

    const total: number = await query.getCount()
    const results: BaseEntity[] = await query
      .skip(offset)
      .take(resultsPerPage)
      .getMany()

    return {
      data: results,
      currentPage,
      lastPage: Math.ceil(total / resultsPerPage),
      from: offset + 1,
      to: offset + resultsPerPage,
      total,
      perPage: resultsPerPage
    }
  }
}

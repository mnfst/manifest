import { BaseEntity, Paginator } from '@casejs/types'
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
   * @param transformResult A function to transform each result.
   * @param asyncTransformResult An async function to transform each result.
   *
   * @returns A promise that resolves to a Paginator object.
   *
   **/
  async paginate({
    query,
    resultsPerPage,
    currentPage,
    transformResult,
    asyncTransformResult
  }: {
    query?: SelectQueryBuilder<BaseEntity>
    currentPage: number
    resultsPerPage?: number
    transformResult?: (result: BaseEntity) => BaseEntity
    asyncTransformResult?: (result: BaseEntity) => Promise<BaseEntity>
  }): Promise<Paginator<BaseEntity>> {
    const offset: number = (currentPage - 1) * resultsPerPage
    let total: number
    let results: BaseEntity[]

    total = await query.getCount()
    results = await query.skip(offset).take(resultsPerPage).getMany()

    // Apply individual function transformResult() on each result if provided.
    if (transformResult) {
      results.forEach((result: any) => {
        result = transformResult(result)
      })
    }
    if (asyncTransformResult) {
      results = await Promise.all(
        results.map((result) =>
          asyncTransformResult(result).then((res: any) => res)
        )
      )
    }

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

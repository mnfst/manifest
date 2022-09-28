import { Injectable } from '@nestjs/common'
import { SelectQueryBuilder } from 'typeorm'
import { caseConstants } from '../case.constants'
import { Paginator } from '../interfaces/paginator.interface'

@Injectable()
export class PaginationService {
  async paginate({
    query,
    items,
    resultsPerPage = caseConstants.defaultResultsPerPage,
    currentPage,
    transformResult,
    asyncTransformResult
  }: {
    query?: SelectQueryBuilder<any>
    items?: any[]
    resultsPerPage?: number
    currentPage: number
    transformResult?: (result: any) => any
    asyncTransformResult?: (result: any) => Promise<any>
  }): Promise<Paginator<any>> {
    const offset: number = (currentPage - 1) * resultsPerPage
    let total: number
    let results: any[]

    if (query) {
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
    } else if (items) {
      // Return a paginator of an array of items.
      total = items.length
      results = items.slice(offset, offset + resultsPerPage)
    } else {
      new Error(
        'Please supply whether a Query or an array of Items to paginate.'
      )
    }

    const paginator: Paginator<any> = {
      data: results,
      currentPage,
      lastPage: Math.ceil(total / resultsPerPage),
      from: offset + 1,
      to: offset + resultsPerPage,
      total,
      perPage: resultsPerPage
    }

    return paginator
  }
}

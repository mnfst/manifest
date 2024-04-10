import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom } from 'rxjs'

import { BaseEntity, Paginator, SelectOption } from '@manifest-yml/types'
import { environment } from '../../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class CrudService {
  baseUrl = environment.apiBaseUrl + '/dynamic'

  constructor(private http: HttpClient) {}

  list(
    entitySlug: string,
    options?: { filters?: { [k: string]: string }; relations?: string[] }
  ): Promise<Paginator<BaseEntity>> {
    const queryParams: {
      [key: string]: any
    } = {
      page: options.filters?.['page'] || 1,
      perPage: 20
    }

    // Add filters with _eq suffix.
    Object.keys(options.filters || {}).forEach((key: string) => {
      if (key !== 'page') {
        queryParams[`${key}_eq`] = options.filters[key]
      }
    })

    if (options.relations) {
      queryParams['relations'] = options.relations.join(',')
    }

    return firstValueFrom(
      this.http.get<Paginator<BaseEntity>>(`${this.baseUrl}/${entitySlug}`, {
        params: queryParams
      })
    )
  }

  listSelectOptions(entitySlug: string): Promise<SelectOption[]> {
    return firstValueFrom(
      this.http.get<SelectOption[]>(
        `${this.baseUrl}/${entitySlug}/select-options`
      )
    )
  }

  show(entitySlug: string, id: number): Promise<BaseEntity> {
    return firstValueFrom(
      this.http.get<BaseEntity>(`${this.baseUrl}/${entitySlug}/${id}`)
    )
  }

  create(
    entitySlug: string,
    data: any
  ): Promise<{ identifiers: { id: number }[] }> {
    return firstValueFrom(
      this.http.post<{ identifiers: { id: number }[] }>(
        `${this.baseUrl}/${entitySlug}`,
        data
      )
    )
  }

  update(entitySlug: string, id: number, data: any): Promise<BaseEntity> {
    return firstValueFrom(
      this.http.put<BaseEntity>(`${this.baseUrl}/${entitySlug}/${id}`, data)
    )
  }

  delete(entitySlug: string, id: number): Promise<any> {
    return firstValueFrom(
      this.http.delete(`${this.baseUrl}/${entitySlug}/${id}`)
    )
  }
}

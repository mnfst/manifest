import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom } from 'rxjs'

import { Params } from '@angular/router'
import { BaseEntity, Paginator, SelectOption } from '@casejs/types'
import { environment } from '../../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class CrudService {
  baseUrl = environment.apiBaseUrl + '/dynamic'

  constructor(private http: HttpClient) {}

  list(entitySlug: string, params?: Params): Promise<Paginator<BaseEntity>> {
    const queryParams: {
      [key: string]: any
    } = {
      page: params?.['page'] || 1,
      perPage: 20
    }

    // Add filters with _eq suffix.
    Object.keys(params || {}).forEach((key: string) => {
      if (key !== 'page') {
        queryParams[`${key}_eq`] = params[key]
      }
    })

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

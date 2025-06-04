import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom } from 'rxjs'

import { BaseEntity, Paginator, SelectOption } from '@repo/types'
import { environment } from '../../../../environments/environment'
import { Params } from '@angular/router'

@Injectable({
  providedIn: 'root'
})
export class CrudService {
  collectionBaseUrl = environment.apiBaseUrl + '/collections'
  singleBaseUrl = environment.apiBaseUrl + '/singles'

  constructor(private http: HttpClient) {}

  list(
    entitySlug: string,
    options?: { filters?: { [k: string]: string }; relations?: string[] }
  ): Promise<Paginator<BaseEntity>> {
    const queryParams: Params = {
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
      this.http.get<Paginator<BaseEntity>>(
        `${this.collectionBaseUrl}/${entitySlug}`,
        {
          params: queryParams
        }
      )
    )
  }

  listSelectOptions(entitySlug: string): Promise<SelectOption[]> {
    return firstValueFrom(
      this.http.get<SelectOption[]>(
        `${this.collectionBaseUrl}/${entitySlug}/select-options`
      )
    )
  }

  show(
    entitySlug: string,
    id: string,
    options?: { relations?: string[] }
  ): Promise<BaseEntity> {
    return firstValueFrom(
      this.http.get<BaseEntity>(
        `${this.collectionBaseUrl}/${entitySlug}/${id}`,
        {
          params: {
            relations: options?.relations?.join(',')
          }
        }
      )
    )
  }

  /**
   * Fetch a single type record.
   *
   * @param entitySlug The entity slug.
   *
   * @returns The record.
   */
  showSingle(entitySlug: string): Promise<BaseEntity> {
    return firstValueFrom(
      this.http.get<BaseEntity>(`${this.singleBaseUrl}/${entitySlug}`)
    )
  }

  create(entitySlug: string, data: unknown): Promise<{ id: string }> {
    return firstValueFrom(
      this.http.post<{ id: string }>(
        `${this.collectionBaseUrl}/${entitySlug}`,
        data
      )
    )
  }

  update(entitySlug: string, id: string, data: unknown): Promise<BaseEntity> {
    return firstValueFrom(
      this.http.put<BaseEntity>(
        `${this.collectionBaseUrl}/${entitySlug}/${id}`,
        data
      )
    )
  }

  /**
   * Update a single type record.
   *
   * @param entitySlug The entity slug.
   * @param data The data to update.
   *
   * @returns The updated record.
   */
  updateSingle(entitySlug: string, data: unknown): Promise<BaseEntity> {
    return firstValueFrom(
      this.http.put<BaseEntity>(`${this.singleBaseUrl}/${entitySlug}`, data)
    )
  }

  delete(entitySlug: string, id: string): Promise<BaseEntity> {
    return firstValueFrom(
      this.http.delete<BaseEntity>(
        `${this.collectionBaseUrl}/${entitySlug}/${id}`
      )
    )
  }
}

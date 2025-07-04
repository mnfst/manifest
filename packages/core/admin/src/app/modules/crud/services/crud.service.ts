import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom } from 'rxjs'

import { BaseEntity, Paginator, SelectOption } from '@repo/types'
import { environment } from '../../../../environments/environment'
import { Params } from '@angular/router'
import { FlashMessageService } from '../../shared/services/flash-message.service'

@Injectable({
  providedIn: 'root'
})
export class CrudService {
  collectionBaseUrl = environment.apiBaseUrl + '/collections'
  singleBaseUrl = environment.apiBaseUrl + '/singles'

  constructor(
    private http: HttpClient,
    private flashMessageService: FlashMessageService
  ) {}

  /**
   * Wrapper method to handle promises with flash messages
   */
  private async handleRequest<T>(promise: Promise<T>): Promise<T> {
    try {
      const result = await promise

      return result
    } catch (error) {
      // Add your flash message service here
      // this.flashMessageService.error(message)
      this.flashMessageService.error(
        (error as HttpErrorResponse).error?.message || 'An error occurred'
      )
      throw error
    }
  }

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

    const promise: Promise<Paginator<BaseEntity>> = firstValueFrom(
      this.http.get<Paginator<BaseEntity>>(
        `${this.collectionBaseUrl}/${entitySlug}`,
        {
          params: queryParams
        }
      )
    )
    return this.handleRequest(promise)
  }

  listSelectOptions(entitySlug: string): Promise<SelectOption[]> {
    const promise: Promise<SelectOption[]> = firstValueFrom(
      this.http.get<SelectOption[]>(
        `${this.collectionBaseUrl}/${entitySlug}/select-options`
      )
    )

    return this.handleRequest(promise)
  }

  show(
    entitySlug: string,
    id: string,
    options?: { relations?: string[] }
  ): Promise<BaseEntity> {
    const promise: Promise<BaseEntity> = firstValueFrom(
      this.http.get<BaseEntity>(
        `${this.collectionBaseUrl}/${entitySlug}/${id}`,
        {
          params: {
            relations: options?.relations?.join(',')
          }
        }
      )
    )

    return this.handleRequest(promise)
  }

  /**
   * Fetch a single type record.
   *
   * @param entitySlug The entity slug.
   *
   * @returns The record.
   */
  showSingle(entitySlug: string): Promise<BaseEntity> {
    const promise: Promise<BaseEntity> = firstValueFrom(
      this.http.get<BaseEntity>(`${this.singleBaseUrl}/${entitySlug}`)
    )

    return this.handleRequest(promise)
  }

  create(entitySlug: string, data: unknown): Promise<{ id: string }> {
    const promise: Promise<{ id: string }> = firstValueFrom(
      this.http.post<{ id: string }>(
        `${this.collectionBaseUrl}/${entitySlug}`,
        data
      )
    )
    return this.handleRequest(promise)
  }

  update(entitySlug: string, id: string, data: unknown): Promise<BaseEntity> {
    const promise: Promise<BaseEntity> = firstValueFrom(
      this.http.put<BaseEntity>(
        `${this.collectionBaseUrl}/${entitySlug}/${id}`,
        data
      )
    )

    return this.handleRequest(promise)
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
    const promise: Promise<BaseEntity> = firstValueFrom(
      this.http.put<BaseEntity>(`${this.singleBaseUrl}/${entitySlug}`, data)
    )
    return this.handleRequest(promise)
  }

  delete(entitySlug: string, id: string): Promise<BaseEntity> {
    const promise: Promise<BaseEntity> = firstValueFrom(
      this.http.delete<BaseEntity>(
        `${this.collectionBaseUrl}/${entitySlug}/${id}`
      )
    )

    return this.handleRequest(promise)
  }
}

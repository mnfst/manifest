import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, firstValueFrom, map, shareReplay } from 'rxjs'

import { environment } from '../../environments/environment'
import { SelectOption } from '~shared/interfaces/select-option.interface'
import { Paginator } from '~shared/interfaces/paginator.interface'
import { EntityMeta } from '~shared/interfaces/entity-meta.interface'

@Injectable({
  providedIn: 'root'
})
export class DynamicEntityService {
  serviceUrl = environment.apiBaseUrl + '/dynamic'
  private entityMetas$: Observable<EntityMeta[]>

  constructor(private http: HttpClient) {}

  loadEntityMeta(): Observable<EntityMeta[]> {
    if (!this.entityMetas$) {
      this.entityMetas$ = this.http.get<any>(`${this.serviceUrl}/meta`).pipe(
        shareReplay(1),
        map((res: EntityMeta[]) => res)
      )
    }
    return this.entityMetas$
  }

  list(entitySlug: string, params?: any): Promise<Paginator<any>> {
    return firstValueFrom(
      this.http.get(`${this.serviceUrl}/${entitySlug}`, {
        params
      })
    ) as Promise<Paginator<any>>
  }

  listSelectOptions(entitySlug: string): Promise<SelectOption[]> {
    return firstValueFrom(
      this.http.get(`${this.serviceUrl}/${entitySlug}/select-options`)
    ) as Promise<SelectOption[]>
  }

  show(entitySlug: string, id: number): Promise<any> {
    return firstValueFrom(
      this.http.get(`${this.serviceUrl}/${entitySlug}/${id}`)
    )
  }

  create(entitySlug: string, data: any): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.serviceUrl}/${entitySlug}`, data)
    )
  }

  update(entitySlug: string, id: number, data: any): Promise<any> {
    return firstValueFrom(
      this.http.put(`${this.serviceUrl}/${entitySlug}/${id}`, data)
    )
  }

  delete(entitySlug: string, id: number): Promise<any> {
    return firstValueFrom(
      this.http.delete(`${this.serviceUrl}/${entitySlug}/${id}`)
    )
  }
}

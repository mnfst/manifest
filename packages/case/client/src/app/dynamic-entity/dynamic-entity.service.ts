import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom } from 'rxjs'

import { environment } from '../../environments/environment'
import { SelectOption } from '~shared/interfaces/select-option.interface'
import { Paginator } from '~shared/interfaces/paginator.interface'

@Injectable({
  providedIn: 'root'
})
export class DynamicEntityService {
  apiBaseUrl = environment.apiBaseUrl

  constructor(private http: HttpClient) {}

  list(entitySlug: string, params?: any): Promise<Paginator<any>> {
    return firstValueFrom(
      this.http.get(`${this.apiBaseUrl}/dynamic/${entitySlug}`, {
        params
      })
    ) as Promise<Paginator<any>>
  }

  listSelectOptions(entitySlug: string): Promise<SelectOption[]> {
    return firstValueFrom(
      this.http.get(`${this.apiBaseUrl}/dynamic/${entitySlug}/select-options`)
    ) as Promise<SelectOption[]>
  }

  show(entitySlug: string, id: number): Promise<any> {
    return firstValueFrom(
      this.http.get(`${this.apiBaseUrl}/dynamic/${entitySlug}/${id}`)
    )
  }

  create(entitySlug: string, data: any): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.apiBaseUrl}/dynamic/${entitySlug}`, data)
    )
  }

  update(entitySlug: string, id: number, data: any): Promise<any> {
    return firstValueFrom(
      this.http.put(`${this.apiBaseUrl}/dynamic/${entitySlug}/${id}`, data)
    )
  }

  delete(entitySlug: string, id: number): Promise<any> {
    return firstValueFrom(
      this.http.delete(`${this.apiBaseUrl}/dynamic/${entitySlug}/${id}`)
    )
  }
}

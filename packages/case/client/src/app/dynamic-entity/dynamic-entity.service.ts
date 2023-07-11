import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom } from 'rxjs'

import { environment } from '../../environments/environment'
import { SelectOption } from '~shared/interfaces/select-option.interface'

@Injectable({
  providedIn: 'root'
})
export class DynamicEntityService {
  apiBaseUrl = environment.apiBaseUrl

  constructor(private http: HttpClient) {}

  list(entityName: string, params?: any): Promise<any[]> {
    return firstValueFrom(
      this.http.get(`${this.apiBaseUrl}/dynamic/${entityName}`, {
        params
      })
    ) as Promise<any[]>
  }

  listSelectOptions(entityName: string): Promise<SelectOption[]> {
    return firstValueFrom(
      this.http.get(`${this.apiBaseUrl}/dynamic/${entityName}/select-options`)
    ) as Promise<SelectOption[]>
  }

  show(entityName: string, id: number): Promise<any> {
    return firstValueFrom(
      this.http.get(`${this.apiBaseUrl}/dynamic/${entityName}/${id}`)
    )
  }

  create(entityName: string, data: any): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.apiBaseUrl}/dynamic/${entityName}`, data)
    )
  }

  update(entityName: string, id: number, data: any): Promise<any> {
    return firstValueFrom(
      this.http.put(`${this.apiBaseUrl}/dynamic/${entityName}/${id}`, data)
    )
  }

  delete(entityName: string, id: number): Promise<any> {
    return firstValueFrom(
      this.http.delete(`${this.apiBaseUrl}/dynamic/${entityName}/${id}`)
    )
  }
}

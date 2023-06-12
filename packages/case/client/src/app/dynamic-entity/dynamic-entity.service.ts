import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { environment } from '../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class DynamicEntityService {
  apiBaseUrl = environment.apiBaseUrl

  constructor(private http: HttpClient) {}

  list(entityName: string) {
    return this.http.get(`${this.apiBaseUrl}/dynamic/${entityName}`)
  }

  show(entityName: string, id: number) {
    return this.http.get(`${this.apiBaseUrl}/dynamic/${entityName}/${id}`)
  }

  create(entityName: string, data: any) {
    return this.http.post(`${this.apiBaseUrl}/dynamic/${entityName}`, data)
  }

  update(entityName: string, id: number, data: any) {
    return this.http.put(`${this.apiBaseUrl}/dynamic/${entityName}/${id}`, data)
  }

  delete(entityName: string, id: number) {
    return this.http.delete(`${this.apiBaseUrl}/dynamic/${entityName}/${id}`)
  }
}

import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'

@Injectable({
  providedIn: 'root'
})
export class DynamicEntityService {
  constructor(private http: HttpClient) {}

  list(entityName: string) {
    return this.http.get(`/api/dynamic/${entityName}`)
  }

  show(entityName: string, id: number) {
    return this.http.get(`/api/dynamic/${entityName}/${id}`)
  }

  create(entityName: string, data: any) {
    return this.http.post(`/api/dynamic/${entityName}`, data)
  }

  update(entityName: string, id: number, data: any) {
    return this.http.put(`/api/dynamic/${entityName}/${id}`, data)
  }

  delete(entityName: string, id: number) {
    return this.http.delete(`/api/dynamic/${entityName}/${id}`)
  }
}

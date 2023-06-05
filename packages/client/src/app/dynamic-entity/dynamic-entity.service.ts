import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'

@Injectable({
  providedIn: 'root'
})
export class DynamicEntityService {
  constructor(private http: HttpClient) {}

  list(entityName: string) {
    return this.http.get(`http://localhost:3000/dynamic/${entityName}`)
  }

  show(entityName: string, id: number) {
    return this.http.get(`http://localhost:3000/dynamic/${entityName}/${id}`)
  }
}

import { Injectable } from '@angular/core'
import { EntityManifest } from '../../../../../../types/src'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../../../environments/environment'
import { Observable } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class EntityManifestService {
  constructor(private http: HttpClient) {}

  create(entityManifestDto: EntityManifest): Observable<EntityManifest> {
    return this.http.post<EntityManifest>(
      `${environment.apiBaseUrl}/manifest-writer/entities`,
      entityManifestDto
    )
  }

  update(entityManifestDto: EntityManifest): Observable<EntityManifest> {
    return this.http.put<EntityManifest>(
      `${environment.apiBaseUrl}/manifest-writer/entities/${entityManifestDto.className}`,
      entityManifestDto
    )
  }

  delete(className: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiBaseUrl}/manifest-writer/entities/${className}`
    )
  }
}

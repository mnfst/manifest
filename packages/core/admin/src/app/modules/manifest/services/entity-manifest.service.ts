import { Injectable } from '@angular/core'
import { EntityManifest } from '../../../../../../types/src'
import { HttpClient } from '@angular/common/http'
import { firstValueFrom } from 'rxjs'
import { environment } from '../../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class EntityManifestService {
  constructor(private http: HttpClient) {}

  create(entityManifestDto: EntityManifest): Promise<EntityManifest> {
    return firstValueFrom(
      this.http.post<EntityManifest>(
        `${environment.apiBaseUrl}/manifest-writer/entities`,
        entityManifestDto
      )
    )
  }

  update(entityManifestDto: EntityManifest): Promise<EntityManifest> {
    return firstValueFrom(
      this.http.put<EntityManifest>(
        `${environment.apiBaseUrl}/manifest-writer/entities/${entityManifestDto.className}`,
        entityManifestDto
      )
    )
  }

  delete(className: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `${environment.apiBaseUrl}/manifest-writer/entities/${className}`
      )
    )
  }
}

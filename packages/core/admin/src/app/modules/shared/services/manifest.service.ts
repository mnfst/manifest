import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AppManifest, EntityManifest } from '@casejs/types'
import { firstValueFrom } from 'rxjs'
import { environment } from '../../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class ManifestService {
  private manifestPromise: Promise<AppManifest> | null = null

  constructor(private http: HttpClient) {}

  /**
   * Gets the manifest. If the manifest has already been fetched, it returns the cached manifest.
   *
   * @returns A Promise of the manifest.
   **/
  getManifest(): Promise<AppManifest> {
    if (!this.manifestPromise) {
      this.manifestPromise = firstValueFrom(
        this.http.get<AppManifest>(`${environment.apiBaseUrl}/manifest`)
      )
    }
    return this.manifestPromise
  }

  /**
   * Gets the manifest for a specific entity.
   *
   * @param entitySlug The slug of the entity.
   *
   * @returns A Promise of the EntityManifest.
   **/
  getEntityManifest(entitySlug: string): Promise<EntityManifest> {
    return firstValueFrom(
      this.http.get<EntityManifest>(
        `${environment.apiBaseUrl}/manifest/entities/${entitySlug}`
      )
    )
  }
}

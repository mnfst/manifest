import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AppManifest, EntityManifest } from '@repo/types'
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
  async getEntityManifest({
    slug,
    className
  }: {
    slug?: string
    className?: string
  }): Promise<EntityManifest> {
    if (!slug && !className) {
      throw new Error('Either slug or className must be provided')
    }

    if (this.manifestPromise) {
      return this.manifestPromise.then((manifest) => {
        return Object.values(manifest.entities).find(
          (entity) => entity.slug === slug || entity.className === className
        )
      })
    }

    return firstValueFrom(
      this.http.get<EntityManifest>(
        `${environment.apiBaseUrl}/manifest/entities/${slug}`
      )
    )
  }
}

import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { AppManifest, EntityManifest } from '@repo/types'
import { filter, firstValueFrom, switchMap } from 'rxjs'
import { environment } from '../../../../environments/environment'
import { AuthService } from '../../auth/auth.service'

@Injectable({
  providedIn: 'root'
})
export class ManifestService {
  private manifestPromise: Promise<AppManifest> | null = null

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  /**
   * Gets the manifest. If the manifest has already been fetched, it returns the cached manifest.
   *
   * @returns A Promise of the manifest.
   **/
  getManifest(): Promise<AppManifest> {
    if (!this.manifestPromise) {
      this.manifestPromise = firstValueFrom(
        this.authService.currentUser$.pipe(
          filter((user) => !!user),
          switchMap(() =>
            this.http.get<AppManifest>(`${environment.apiBaseUrl}/manifest`)
          )
        )
      ).catch((error) => {
        this.manifestPromise = null
        throw error
      })
    }
    return this.manifestPromise
  }

  /**
   * Gets the app name
   *
   * @returns A Promise of the app name.
   */
  async getAppName(): Promise<string> {
    return firstValueFrom(
      this.http.get<{ name: string }>(
        `${environment.apiBaseUrl}/manifest/app-name`
      )
    )
      .then((response) => response.name)
      .catch((error) => {
        throw error
      })
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

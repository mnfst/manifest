import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { environment } from '../../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class VersionService {
  constructor(private http: HttpClient) {}

  checkForUpdates({
    currentVersion,
    currentEnv,
    disableTelemetry = false
  }: {
    currentVersion: string
    currentEnv: string
    disableTelemetry?: boolean
  }): Promise<{ latestVersion: string; isUpdateAvailable: boolean }> {
    const params: { [key: string]: string } = {
      currentVersion,
      currentEnv
    }
    if (disableTelemetry) {
      params['disableTelemetry'] = disableTelemetry.toString()
    }

    return firstValueFrom(
      this.http.get<{ latestVersion: string }>(
        `${environment.platformBaseUrl}/version/check`,
        {
          params
        }
      )
    )
      .then((response) => {
        const isUpdateAvailable = response.latestVersion !== currentVersion
        return {
          latestVersion: response.latestVersion,
          isUpdateAvailable
        }
      })
      .catch((error) => {
        console.error('Error checking for updates:', error)
        throw error
      })
  }
}

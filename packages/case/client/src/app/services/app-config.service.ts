import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, map, shareReplay } from 'rxjs'
import { AppConfig } from '~shared/interfaces/app-config.interface'

import { environment } from '../../environments/environment'

/*
 * This service allows to fetch all app settings from the server for SSOT (Single Source of Truth).
 */
@Injectable({
  providedIn: 'root'
})
export class AppConfigService {
  serviceUrl: string = environment.apiBaseUrl + '/config/app'
  private appConfig$: Observable<AppConfig>

  constructor(private http: HttpClient) {}

  public loadAppConfig(): Observable<AppConfig> {
    if (!this.appConfig$) {
      this.appConfig$ = this.http.get<any>(this.serviceUrl).pipe(
        shareReplay(1),
        map((res: { appConfig: AppConfig }) => res.appConfig)
      )
    }
    return this.appConfig$
  }
}

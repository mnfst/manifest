import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Observable, shareReplay } from 'rxjs'

import { environment } from '../../environments/environment'
import { EntityDescription } from '~shared/interfaces/entity-description.interface'
import { AppSettings } from '~shared/interfaces/app-settings.interface'

/*
 * This service allows to fetch all app settings from the server for SSOT (Single Source of Truth).
 */
@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly ENV_URL = environment.apiBaseUrl + '/app-rules/settings'
  private settings$:
    | Observable<{ entities: EntityDescription; settings: AppSettings }>
    | undefined

  constructor(private http: HttpClient) {}

  public loadSettings(): Observable<any> {
    if (!this.settings$) {
      this.settings$ = this.http.get<any>(this.ENV_URL).pipe(shareReplay(1))
    }
    return this.settings$
  }
}

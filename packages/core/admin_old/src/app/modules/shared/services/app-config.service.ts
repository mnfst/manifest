import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { firstValueFrom, ReplaySubject } from 'rxjs'
import { AppConfig } from '~shared/interfaces/app-config.interface'

import { environment } from '../../../../environments/environment'

/*
 * This service allows to fetch all app settings from the server for SSOT (Single Source of Truth).
 */
@Injectable({
  providedIn: 'root'
})
export class AppConfigService {
  appConfig: ReplaySubject<AppConfig> = new ReplaySubject<AppConfig>(1)

  private serviceUrl: string = environment.apiBaseUrl + '/config'

  constructor(private http: HttpClient) {}

  public getAppConfig(): Promise<AppConfig> {
    return firstValueFrom(this.http.get<any>(this.serviceUrl))
  }
}

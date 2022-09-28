import { Inject, Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { FlashMessageService } from './flash-message.service'
import { CaseConfig } from '../interfaces/case-config.interface'

// Check regularly if a new version is available and force reload is it is the case.
@Injectable({
  providedIn: 'root'
})
export class VersionService {
  version: number

  // Seconds of interval between API calls.
  interval = 500

  constructor(
    private http: HttpClient,
    private flashMessageService: FlashMessageService,
    @Inject('CASE_CONFIG_TOKEN') private config: CaseConfig
  ) {}

  checkForNewVersions() {
    setInterval(() => {
      this.http
        .get(`${this.config.apiBaseUrl}/version.json`)
        .subscribe((res: { version: number }) => {
          this.version = parseFloat(localStorage.getItem('version'))

          // If remote version is higher than local version, we force reload the front.
          if (!this.version || this.version < res.version) {
            this.version = res.version
            localStorage.setItem('version', res.version.toString())

            this.flashMessageService.info(
              `Une nouvelle version de ${this.config.appName} est disponible ! Rafraichissez la page de votre navigateur pour être à jour.`,
              true
            )
          }
        })
    }, this.interval * 1000)
  }
}
